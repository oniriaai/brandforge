import * as fs from 'fs';
import * as path from 'path';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import {
  BackgroundSelectionResult,
  BrandKit,
  ContentAnalysisResult,
  LayoutGenerationResult,
  Platform,
  RenderedAsset,
} from '../types';
import { buildInstagramTree } from './build-instagram-tree';

const interRegularPath = require.resolve(
  '@fontsource/inter/files/inter-latin-400-normal.woff',
);
const interBoldPath = require.resolve(
  '@fontsource/inter/files/inter-latin-700-normal.woff',
);

export class SatoriRenderer {
  private fontsLoaded = false;
  private regularFont!: Buffer;
  private boldFont!: Buffer;

  constructor(private readonly outputDir: string) {}

  async renderImage(input: {
    jobId: string;
    platform: Platform;
    content: ContentAnalysisResult;
    background: BackgroundSelectionResult;
    layout: LayoutGenerationResult;
    brandKit: BrandKit;
  }): Promise<RenderedAsset> {
    await this.ensureFonts();
    await fs.promises.mkdir(this.outputDir, { recursive: true });

    const size = this.getDimensions(input.platform);
    const element = buildInstagramTree({
      width: size.width,
      height: size.height,
      content: input.content,
      background: input.background,
      layout: input.layout,
      brandKit: input.brandKit,
    });

    const svg = await satori(element, {
      width: size.width,
      height: size.height,
      fonts: [
        {
          name: 'Inter',
          data: this.regularFont,
          style: 'normal',
          weight: 400,
        },
        {
          name: 'Inter',
          data: this.boldFont,
          style: 'normal',
          weight: 700,
        },
      ],
    });

    const png = new Resvg(svg).render().asPng();
    const filename = `${input.jobId}.png`;
    const filePath = path.join(this.outputDir, filename);
    await fs.promises.writeFile(filePath, png);

    return {
      filename,
      filePath,
      relativeUrl: `/v1/assets/${filename}`,
      width: size.width,
      height: size.height,
    };
  }

  private getDimensions(platform: Platform): { width: number; height: number } {
    if (platform === 'instagram_feed_4x5') {
      return { width: 1080, height: 1350 };
    }
    return { width: 1080, height: 1080 };
  }

  private async ensureFonts(): Promise<void> {
    if (this.fontsLoaded) {
      return;
    }
    this.regularFont = await fs.promises.readFile(interRegularPath);
    this.boldFont = await fs.promises.readFile(interBoldPath);
    this.fontsLoaded = true;
  }
}
