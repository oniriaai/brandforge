import { Injectable, BadRequestException } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { ContentService } from '../content/content.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { BrandAssetsService } from '../brand-assets/brand-assets.service';
import {
  GenerateContentDto,
  RefineContentDto,
} from './dto/generation.dto';
import { ContentPost } from '../content/entities/content-post.entity';

@Injectable()
export class GenerationService {
  constructor(
    private readonly openai: OpenAIService,
    private readonly contentService: ContentService,
    private readonly campaignsService: CampaignsService,
    private readonly brandAssetsService: BrandAssetsService,
  ) {}

  async generate(dto: GenerateContentDto): Promise<ContentPost[]> {
    const campaign = await this.campaignsService.findOne(dto.campaignId);
    let brandConfig = null;
    try {
      brandConfig = await this.brandAssetsService.getGlobalConfig();
    } catch {
      // No brand config yet — that's fine
    }

    const variants = await this.openai.generateVariants(dto, campaign, brandConfig);
    const posts: ContentPost[] = [];

    for (const variant of variants) {
      this.validateContent(variant);
      const post = await this.contentService.create({
        campaignId: dto.campaignId,
        platform: dto.platform,
        marketingAngle: variant.marketingAngle,
        objective: dto.objective,
        targetAudience: variant.targetAudience,
        hook: variant.hook,
        body: variant.body,
        cta: variant.cta,
        caption: variant.caption,
        headline: variant.headline,
        subheadline: variant.subheadline,
        painPoint: variant.painPoint,
        valueProposition: variant.valueProposition,
        tone: variant.tone,
      });
      posts.push(post);
    }

    return posts;
  }

  async refine(dto: RefineContentDto): Promise<ContentPost> {
    const post = await this.contentService.findOne(dto.postId);
    const campaign = await this.campaignsService.findOne(post.campaignId);

    const refined = await this.openai.refineContent(post, dto.instruction, campaign);

    const updatedFields: Partial<ContentPost> = {};
    if (refined.hook) updatedFields.hook = refined.hook;
    if (refined.headline) updatedFields.headline = refined.headline;
    if (refined.subheadline) updatedFields.subheadline = refined.subheadline;
    if (refined.body) updatedFields.body = refined.body;
    if (refined.cta) updatedFields.cta = refined.cta;
    if (refined.caption) updatedFields.caption = refined.caption;
    if (refined.painPoint) updatedFields.painPoint = refined.painPoint;
    if (refined.valueProposition) updatedFields.valueProposition = refined.valueProposition;
    if (refined.tone) updatedFields.tone = refined.tone;

    return this.contentService.saveRefinedContent(
      dto.postId,
      updatedFields,
      dto.instruction,
    );
  }

  private validateContent(content: { hook: string; cta: string; body: string }): void {
    if (!content.hook || content.hook.trim().length < 5) {
      throw new BadRequestException('Generated content has an invalid hook');
    }
    if (!content.cta || content.cta.trim().length < 3) {
      throw new BadRequestException('Generated content is missing a CTA');
    }
    if (!content.body || content.body.trim().length < 10) {
      throw new BadRequestException('Generated content body is too short');
    }
  }
}
