import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { SatoriRenderer } from './satori-renderer';

const content = {
  hook: 'Stop wasting budget',
  headline: 'Turn product updates into high-converting Instagram posts',
  body: 'Generate campaign-ready visuals in minutes with strict brand consistency.',
  cta: 'Start your campaign',
  tone: 'bold',
  visualIntent: 'high contrast conversion-focused hero composition',
  keywordSignals: ['conversion', 'brand consistency', 'speed'],
};

const background = {
  gradientStart: '#1D4ED8',
  gradientEnd: '#1E3A8A',
  overlayOpacity: 0.14,
  highlightColor: '#F59E0B',
  moodSummary: 'Energetic and premium',
};

const layout = {
  textAlign: 'left' as const,
  headlineSize: 86,
  bodySize: 30,
  ctaSize: 24,
  padding: 70,
  lineClampHeadline: 2,
  lineClampBody: 3,
  ctaStyle: 'solid' as const,
};

const brandKit = {
  primaryColor: '#1D4ED8',
  secondaryColor: '#1E3A8A',
  accentColor: '#F59E0B',
  backgroundColor: '#FFFFFF',
  textColor: '#FFFFFF',
  headingFont: 'Inter',
  bodyFont: 'Inter',
};

test('satori renderer creates 1:1 png with expected dimensions', async (t) => {
  const outputDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ai-image-agent-'));
  t.after(async () => {
    await fs.promises.rm(outputDir, { recursive: true, force: true });
  });

  const renderer = new SatoriRenderer(outputDir);
  const rendered = await renderer.renderImage({
    jobId: randomUUID(),
    platform: 'instagram_feed_1x1',
    content,
    background,
    layout,
    brandKit,
  });

  const stat = await fs.promises.stat(rendered.filePath);
  assert.equal(rendered.width, 1080);
  assert.equal(rendered.height, 1080);
  assert.equal(path.extname(rendered.filePath), '.png');
  assert.ok(stat.size > 0);
});

test('satori renderer creates 4:5 png with expected dimensions', async (t) => {
  const outputDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ai-image-agent-'));
  t.after(async () => {
    await fs.promises.rm(outputDir, { recursive: true, force: true });
  });

  const renderer = new SatoriRenderer(outputDir);
  const rendered = await renderer.renderImage({
    jobId: randomUUID(),
    platform: 'instagram_feed_4x5',
    content,
    background,
    layout,
    brandKit,
  });

  const stat = await fs.promises.stat(rendered.filePath);
  assert.equal(rendered.width, 1080);
  assert.equal(rendered.height, 1350);
  assert.equal(path.extname(rendered.filePath), '.png');
  assert.ok(stat.size > 0);
});
