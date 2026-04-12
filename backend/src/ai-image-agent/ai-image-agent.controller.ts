import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AiImageAgentService } from './ai-image-agent.service';
import {
  AgentApproveDto,
  AgentBrandKitDto,
  AgentGenerateDto,
  AgentRejectDto,
  AgentSelectVariantDto,
  AgentSuggestDto,
} from './dto/agent.dto';
import { ContentService } from '../content/content.service';
import { BrandAssetsService } from '../brand-assets/brand-assets.service';
import { BrandConfig } from '../brand-assets/entities/brand-config.entity';

const FALLBACK_BRAND_KIT: Required<Pick<
  AgentBrandKitDto,
  | 'primaryColor'
  | 'secondaryColor'
  | 'accentColor'
  | 'backgroundColor'
  | 'textColor'
  | 'headingFont'
  | 'bodyFont'
>> = {
  primaryColor: '#4F46E5',
  secondaryColor: '#9333EA',
  accentColor: '#F59E0B',
  backgroundColor: '#FFFFFF',
  textColor: '#111827',
  headingFont: 'Inter',
  bodyFont: 'Inter',
};
const HEX_COLOR_PATTERN = /^#([A-Fa-f0-9]{6})$/;

@ApiTags('ai-image-agent')
@Controller('ai-image-agent')
export class AiImageAgentController {
  constructor(
    private readonly service: AiImageAgentService,
    private readonly contentService: ContentService,
    private readonly brandAssetsService: BrandAssetsService,
  ) {}

  private static firstNonEmpty(...values: Array<string | null | undefined>): string | undefined {
    return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim();
  }

  private buildMergedBrandKit(
    override: AgentBrandKitDto | undefined,
    config: BrandConfig,
    logoUrl?: string,
  ): Required<Omit<AgentBrandKitDto, 'logoUrl'>> & { logoUrl?: string } {
    const pickColor = (
      overrideColor: string | undefined,
      globalColor: string | null,
      fallbackColor: string,
    ) => {
      if (overrideColor && HEX_COLOR_PATTERN.test(overrideColor)) return overrideColor;
      if (globalColor && HEX_COLOR_PATTERN.test(globalColor)) return globalColor;
      return fallbackColor;
    };

    return {
      primaryColor: pickColor(
        override?.primaryColor,
        config.primaryColor,
        FALLBACK_BRAND_KIT.primaryColor,
      ),
      secondaryColor: pickColor(
        override?.secondaryColor,
        config.secondaryColor,
        FALLBACK_BRAND_KIT.secondaryColor,
      ),
      accentColor: pickColor(
        override?.accentColor,
        config.accentColor,
        FALLBACK_BRAND_KIT.accentColor,
      ),
      backgroundColor: pickColor(
        override?.backgroundColor,
        config.backgroundColor,
        FALLBACK_BRAND_KIT.backgroundColor,
      ),
      textColor: pickColor(
        override?.textColor,
        config.textColor,
        FALLBACK_BRAND_KIT.textColor,
      ),
      headingFont:
        AiImageAgentController.firstNonEmpty(
          override?.headingFont,
          config.headingFont,
          FALLBACK_BRAND_KIT.headingFont,
        ) || FALLBACK_BRAND_KIT.headingFont,
      bodyFont:
        AiImageAgentController.firstNonEmpty(
          override?.bodyFont,
          config.bodyFont,
          FALLBACK_BRAND_KIT.bodyFont,
        ) || FALLBACK_BRAND_KIT.bodyFont,
      logoUrl:
        AiImageAgentController.firstNonEmpty(override?.logoUrl, logoUrl) || undefined,
    };
  }

  @Post('posts/:postId/generate')
  async generate(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Req() req: Request,
    @Body() dto: AgentGenerateDto,
  ) {
    const config = await this.brandAssetsService.getGlobalConfig();
    const logoAsset = await this.brandAssetsService.getLogoAsset();
    const logoUrl = logoAsset
      ? `${req.protocol}://${req.get('host')}/api/brand-assets/logo`
      : undefined;
    const mergedBrandKit = this.buildMergedBrandKit(dto.brandKit, config, logoUrl);
    const designGuidelines = [dto.designGuidelines, `Design style preset: ${config.designStyle}.`]
      .filter(Boolean)
      .join(' ');

    return this.service.generateForPost(postId, {
      ...dto,
      designGuidelines,
      brandKit: mergedBrandKit,
    });
  }

  @Get('posts/:postId/jobs')
  getPostJobs(@Param('postId', ParseUUIDPipe) postId: string) {
    return this.service.listPostJobs(postId);
  }

  @Get('posts/:postId/jobs/:jobId')
  getPostJob(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.service.getPostJob(postId, jobId);
  }

  @Get('posts/:postId/jobs/:jobId/component-spec')
  getComponentSpec(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.service.getJobComponentSpec(postId, jobId);
  }

  @Post('posts/:postId/jobs/:jobId/suggest')
  suggestChanges(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('jobId') jobId: string,
    @Body() dto: AgentSuggestDto,
  ) {
    return this.service.suggestChanges(postId, jobId, dto);
  }

  @Post('posts/:postId/jobs/:jobId/select-variant')
  selectVariant(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('jobId') jobId: string,
    @Body() dto: AgentSelectVariantDto,
  ) {
    return this.service.selectVariant(postId, jobId, dto);
  }

  @Get('posts/:postId/approvals/pending')
  getPendingApprovals(@Param('postId', ParseUUIDPipe) postId: string) {
    return this.service.getPendingApprovals(postId);
  }

  @Post('posts/:postId/approvals/:jobId/approve')
  approve(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('jobId') jobId: string,
    @Body() dto: AgentApproveDto,
  ) {
    return this.service.approve(postId, jobId, dto);
  }

  @Post('posts/:postId/approvals/:jobId/reject')
  reject(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('jobId') jobId: string,
    @Body() dto: AgentRejectDto,
  ) {
    return this.service.reject(postId, jobId, dto);
  }

  @Get('posts/:postId/jobs/:jobId/deliver')
  async deliver(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('jobId') jobId: string,
  ) {
    const result = await this.service.deliver(postId, jobId);
    await this.contentService.updateRenderedImageUrl(postId, result.deliveryUrl);
    return result;
  }
}
