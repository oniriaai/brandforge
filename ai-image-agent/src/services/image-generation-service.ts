import { randomUUID } from 'crypto';
import { ChatOpenAI } from '@langchain/openai';
import { ConflictError } from '../errors';
import {
  GenerateImageRequest,
  GenerateImageResponse,
  ImageJob,
} from '../types';
import { runContentAnalysisAgent } from '../agents/content-analysis-agent';
import { runBackgroundSelectionAgent } from '../agents/background-selection-agent';
import { runLayoutGenerationAgent } from '../agents/layout-generation-agent';
import { SatoriRenderer } from '../render/satori-renderer';
import { JobStore } from '../store/job-store';

export class ImageGenerationService {
  constructor(
    private readonly model: ChatOpenAI,
    private readonly jobStore: JobStore,
    private readonly renderer: SatoriRenderer,
    private readonly deliveryBaseUrl: string,
  ) {}

  async generateImage(input: GenerateImageRequest): Promise<GenerateImageResponse> {
    const now = new Date().toISOString();
    const jobId = randomUUID();

    const baseJob: ImageJob = {
      id: jobId,
      status: 'draft_generated',
      input,
      createdAt: now,
      updatedAt: now,
    };
    this.jobStore.create(baseJob);

    const content = await runContentAnalysisAgent(
      this.model,
      input.inputText,
      input.designGuidelines,
      input.brandKit,
    );

    const background = await runBackgroundSelectionAgent(
      this.model,
      content,
      input.designGuidelines,
      input.brandKit,
    );

    const layout = await runLayoutGenerationAgent(
      this.model,
      input.platform,
      content,
      background,
    );

    const asset = await this.renderer.renderImage({
      jobId,
      platform: input.platform,
      content,
      background,
      layout,
      brandKit: input.brandKit,
    });

    const updated = this.jobStore.update(jobId, (existing) => ({
      ...existing,
      content,
      background,
      layout,
      asset,
      status: 'pending_approval',
      updatedAt: new Date().toISOString(),
    }));

    return {
      jobId: updated.id,
      status: updated.status,
      previewUrl: `${this.deliveryBaseUrl}${asset.relativeUrl}`,
    };
  }

  getJob(jobId: string): ImageJob {
    return this.jobStore.getOrThrow(jobId);
  }

  getPendingApprovals(): ImageJob[] {
    return this.jobStore.listPendingApproval();
  }

  approve(jobId: string, reviewer: string): ImageJob {
    return this.jobStore.update(jobId, (job) => {
      if (job.status !== 'pending_approval') {
        throw new ConflictError(
          `Job ${job.id} is ${job.status}; only pending_approval can be approved.`,
        );
      }

      return {
        ...job,
        status: 'approved',
        approval: {
          reviewer,
          reviewedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      };
    });
  }

  reject(jobId: string, reviewer: string, reason: string): ImageJob {
    return this.jobStore.update(jobId, (job) => {
      if (job.status !== 'pending_approval') {
        throw new ConflictError(
          `Job ${job.id} is ${job.status}; only pending_approval can be rejected.`,
        );
      }

      return {
        ...job,
        status: 'rejected',
        approval: {
          reviewer,
          reason,
          reviewedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      };
    });
  }

  deliver(jobId: string): { deliveryUrl: string; status: string } {
    const job = this.jobStore.getOrThrow(jobId);

    if (job.status !== 'approved' && job.status !== 'delivered') {
      throw new ConflictError(
        `Job ${job.id} is ${job.status}; only approved jobs can be delivered.`,
      );
    }

    const updated =
      job.status === 'approved'
        ? this.jobStore.update(jobId, (current) => ({
            ...current,
            status: 'delivered',
            updatedAt: new Date().toISOString(),
          }))
        : job;

    if (!updated.asset) {
      throw new ConflictError(`Job ${updated.id} has no rendered asset to deliver.`);
    }

    return {
      deliveryUrl: `${this.deliveryBaseUrl}${updated.asset.relativeUrl}`,
      status: updated.status,
    };
  }
}
