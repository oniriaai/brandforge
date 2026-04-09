import { ImageJob, JobStatus } from '../types';
import { NotFoundError } from '../errors';

export class JobStore {
  private readonly jobs = new Map<string, ImageJob>();

  create(job: ImageJob): ImageJob {
    this.jobs.set(job.id, job);
    return job;
  }

  getOrThrow(jobId: string): ImageJob {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundError(`Job ${jobId} not found`);
    }
    return job;
  }

  update(jobId: string, updater: (existing: ImageJob) => ImageJob): ImageJob {
    const existing = this.getOrThrow(jobId);
    const updated = updater(existing);
    this.jobs.set(jobId, updated);
    return updated;
  }

  listPendingApproval(): ImageJob[] {
    return [...this.jobs.values()].filter((job) => job.status === 'pending_approval');
  }

  listByStatus(status: JobStatus): ImageJob[] {
    return [...this.jobs.values()].filter((job) => job.status === status);
  }
}
