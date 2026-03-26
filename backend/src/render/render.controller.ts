import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import * as path from 'path';
import { RenderService } from './render.service';
import { TemplatesService } from '../templates/templates.service';
import { ContentService } from '../content/content.service';
import { BrandAssetsService } from '../brand-assets/brand-assets.service';
import { RenderPostDto } from './dto/render-post.dto';

@ApiTags('render')
@Controller('render')
export class RenderController {
  constructor(
    private readonly renderService: RenderService,
    private readonly templatesService: TemplatesService,
    private readonly contentService: ContentService,
    private readonly brandAssetsService: BrandAssetsService,
  ) {}

  private async resolveLogoUrl(): Promise<string> {
    try {
      const config = await this.brandAssetsService.getGlobalConfig();
      if (config.logoAssetId) {
        return `/api/brand-assets/logo`;
      }
    } catch {}
    return '';
  }

  @Post()
  async renderPost(@Body() dto: RenderPostDto) {
    const post = await this.contentService.findOne(dto.postId);
    const template = this.templatesService.getById(dto.templateId);
    if (!template) throw new NotFoundException('Template not found');

    let brandConfig = null;
    try {
      brandConfig = await this.brandAssetsService.getGlobalConfig();
    } catch {}

    const logoUrl = await this.resolveLogoUrl();

    const html = this.templatesService.renderTemplate(dto.templateId, {
      headline: post.headline || '',
      subheadline: post.subheadline || '',
      body: post.body,
      cta: post.cta,
      hook: post.hook,
      logoUrl,
    }, brandConfig);

    const imageUrl = await this.renderService.renderToImage(
      html,
      template.width,
      template.height,
    );

    await this.contentService.update(post.id, { templateId: dto.templateId, renderedImageUrl: imageUrl });

    return { imageUrl, templateId: dto.templateId };
  }

  @Get('image/:filename')
  serveImage(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = path.basename(filename);
    const filePath = path.join(process.cwd(), 'rendered', safeName);
    res.sendFile(filePath);
  }

  @Post('preview')
  async previewHtml(@Body() dto: RenderPostDto) {
    const post = await this.contentService.findOne(dto.postId);
    const template = this.templatesService.getById(dto.templateId);
    if (!template) throw new NotFoundException('Template not found');

    let brandConfig = null;
    try {
      brandConfig = await this.brandAssetsService.getGlobalConfig();
    } catch {}

    const logoUrl = await this.resolveLogoUrl();

    const html = this.templatesService.renderTemplate(dto.templateId, {
      headline: post.headline || '',
      subheadline: post.subheadline || '',
      body: post.body,
      cta: post.cta,
      hook: post.hook,
      logoUrl,
    }, brandConfig);

    return { html, width: template.width, height: template.height };
  }
}
