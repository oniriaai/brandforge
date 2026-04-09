import * as fs from 'fs';
import express, { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { loadConfig } from './config';
import { AppError, ConflictError } from './errors';
import { createModel } from './llm';
import { SatoriRenderer } from './render/satori-renderer';
import { ImageGenerationService } from './services/image-generation-service';
import { JobStore } from './store/job-store';
import {
  approvalSchema,
  generateImageSchema,
  rejectionSchema,
} from './validation';

const config = loadConfig();
fs.mkdirSync(config.renderOutputDir, { recursive: true });

const model = createModel(config);
const jobStore = new JobStore();
const renderer = new SatoriRenderer(config.renderOutputDir);
const generationService = new ImageGenerationService(
  model,
  jobStore,
  renderer,
  config.deliveryBaseUrl,
);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/v1/assets', express.static(config.renderOutputDir));

const asyncHandler =
  <T extends Request>(handler: (req: T, res: Response, next: NextFunction) => Promise<void>) =>
  (req: T, res: Response, next: NextFunction) =>
    Promise.resolve(handler(req, res, next)).catch(next);

const requireApprovedForDelivery = (
  req: Request<{ jobId: string }>,
  _res: Response,
  next: NextFunction,
) => {
  const job = generationService.getJob(req.params.jobId);
  if (job.status !== 'approved' && job.status !== 'delivered') {
    throw new ConflictError(
      `Job ${job.id} is ${job.status}; approval is required before delivery.`,
    );
  }
  next();
};

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ai-image-agent' });
});

app.post(
  '/v1/images/generate',
  asyncHandler(async (req, res) => {
    const payload = generateImageSchema.parse(req.body);
    const result = await generationService.generateImage(payload);
    res.status(201).json(result);
  }),
);

app.get(
  '/v1/images/:jobId',
  asyncHandler(async (req, res) => {
    const job = generationService.getJob(req.params.jobId);
    res.json(job);
  }),
);

app.get(
  '/v1/approvals/pending',
  asyncHandler(async (_req, res) => {
    const jobs = generationService.getPendingApprovals();
    res.json(jobs);
  }),
);

app.post(
  '/v1/approvals/:jobId/approve',
  asyncHandler(async (req, res) => {
    const payload = approvalSchema.parse(req.body);
    const job = generationService.approve(req.params.jobId, payload.reviewer);
    res.json(job);
  }),
);

app.post(
  '/v1/approvals/:jobId/reject',
  asyncHandler(async (req, res) => {
    const payload = rejectionSchema.parse(req.body);
    const job = generationService.reject(
      req.params.jobId,
      payload.reviewer,
      payload.reason,
    );
    res.json(job);
  }),
);

app.get(
  '/v1/images/:jobId/deliver',
  requireApprovedForDelivery,
  asyncHandler(async (req, res) => {
    const result = generationService.deliver(req.params.jobId);
    res.json(result);
  }),
);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'ValidationError',
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.name, message: err.message });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unexpected error';
  res.status(500).json({ error: 'InternalServerError', message });
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`ai-image-agent running on http://localhost:${config.port}`);
});
