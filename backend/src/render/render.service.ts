import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as puppeteer from 'puppeteer-core';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuid } from 'uuid';

@Injectable()
export class RenderService {
  private readonly logger = new Logger(RenderService.name);
  private readonly outputDir: string;
  private readonly executablePath: string;

  constructor(private config: ConfigService) {
    this.outputDir = path.resolve(process.cwd(), 'rendered');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    this.executablePath =
      this.config.get('PUPPETEER_EXECUTABLE_PATH') ||
      '/usr/bin/chromium-browser';
  }

  async renderToImage(
    html: string,
    width: number,
    height: number,
  ): Promise<string> {
    const browser = await puppeteer.launch({
      executablePath: this.executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width, height, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const filename = `${uuid()}.png`;
      const filePath = path.join(this.outputDir, filename);

      await page.screenshot({
        path: filePath,
        type: 'png',
        clip: { x: 0, y: 0, width, height },
      });

      this.logger.log(`Rendered image: ${filename}`);
      return `/rendered/${filename}`;
    } finally {
      await browser.close();
    }
  }
}
