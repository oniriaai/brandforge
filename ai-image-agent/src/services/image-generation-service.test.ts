import assert from 'node:assert/strict';
import test from 'node:test';
import { ImageGenerationService } from './image-generation-service';
import { ConflictError } from '../errors';
import { JobStore } from '../store/job-store';
import { ImageJob, JobStatus } from '../types';

function createService(store: JobStore): ImageGenerationService {
  return new ImageGenerationService(
    {} as any,
    store,
    {} as any,
    'http://localhost:4100',
  );
}

function createSeedJob(status: JobStatus): ImageJob {
  const now = new Date().toISOString();
  const hasAsset = status !== 'draft_generated';

  return {
    id: `job-${status}-${Math.random().toString(36).slice(2, 8)}`,
    status,
    input: {
      inputText: 'Launch our spring Instagram campaign for premium skincare.',
      designGuidelines:
        'Use bold hierarchy, short CTA, and keep high text contrast on background.',
      platform: 'instagram_feed_1x1',
      brandKit: {
        primaryColor: '#1D4ED8',
        secondaryColor: '#1E3A8A',
        accentColor: '#F59E0B',
        backgroundColor: '#FFFFFF',
        textColor: '#111827',
        headingFont: 'Inter',
        bodyFont: 'Inter',
      },
    },
    asset: hasAsset
      ? {
          filename: 'seed.png',
          filePath: '/tmp/seed.png',
          relativeUrl: '/v1/assets/seed.png',
          width: 1080,
          height: 1080,
        }
      : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

test('approve transitions pending_approval to approved', () => {
  const store = new JobStore();
  const service = createService(store);
  const job = createSeedJob('pending_approval');
  store.create(job);

  const approved = service.approve(job.id, 'quality-reviewer');
  assert.equal(approved.status, 'approved');
  assert.equal(approved.approval?.reviewer, 'quality-reviewer');
});

test('reject transitions pending_approval to rejected and stores reason', () => {
  const store = new JobStore();
  const service = createService(store);
  const job = createSeedJob('pending_approval');
  store.create(job);

  const rejected = service.reject(job.id, 'quality-reviewer', 'Headline is off-brand');
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.approval?.reviewer, 'quality-reviewer');
  assert.equal(rejected.approval?.reason, 'Headline is off-brand');
});

test('deliver requires approved status', () => {
  const store = new JobStore();
  const service = createService(store);
  const job = createSeedJob('pending_approval');
  store.create(job);

  assert.throws(
    () => service.deliver(job.id),
    (error: unknown) =>
      error instanceof ConflictError &&
      error.message.includes('only approved jobs can be delivered'),
  );
});

test('deliver transitions approved to delivered and returns delivery URL', () => {
  const store = new JobStore();
  const service = createService(store);
  const job = createSeedJob('approved');
  store.create(job);

  const delivered = service.deliver(job.id);
  assert.equal(delivered.status, 'delivered');
  assert.equal(delivered.deliveryUrl, 'http://localhost:4100/v1/assets/seed.png');

  const persisted = service.getJob(job.id);
  assert.equal(persisted.status, 'delivered');
});

test('deliver fails when approved job has no rendered asset', () => {
  const store = new JobStore();
  const service = createService(store);
  const job = { ...createSeedJob('approved'), asset: undefined };
  store.create(job);

  assert.throws(
    () => service.deliver(job.id),
    (error: unknown) =>
      error instanceof ConflictError &&
      error.message.includes('has no rendered asset to deliver'),
  );
});
