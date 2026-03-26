import { IsString, IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Platform, MarketingAngle, PostObjective } from '../../content/entities/content-post.entity';

export class GenerateContentDto {
  @IsString()
  campaignId: string;

  @IsEnum(Platform)
  platform: Platform;

  @IsEnum(PostObjective)
  objective: PostObjective;

  @IsOptional()
  @IsEnum(MarketingAngle)
  marketingAngle?: MarketingAngle;

  @IsOptional()
  @IsString()
  targetAudience?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  additionalContext?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  variants?: number;
}

export class RefineContentDto {
  @IsString()
  postId: string;

  @IsString()
  instruction: string;
}

export interface GeneratedContent {
  hook: string;
  headline: string;
  subheadline: string;
  body: string;
  cta: string;
  caption: string;
  painPoint: string;
  valueProposition: string;
  tone: string;
  marketingAngle: MarketingAngle;
  targetAudience: string;
}
