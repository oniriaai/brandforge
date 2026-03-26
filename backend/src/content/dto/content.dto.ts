import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import {
  Platform,
  MarketingAngle,
  PostObjective,
} from '../entities/content-post.entity';

export class CreatePostDto {
  @IsString()
  campaignId: string;

  @IsEnum(Platform)
  platform: Platform;

  @IsEnum(MarketingAngle)
  marketingAngle: MarketingAngle;

  @IsEnum(PostObjective)
  objective: PostObjective;

  @IsString()
  targetAudience: string;

  @IsString()
  hook: string;

  @IsString()
  body: string;

  @IsString()
  cta: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsString()
  subheadline?: string;

  @IsOptional()
  @IsString()
  painPoint?: string;

  @IsOptional()
  @IsString()
  valueProposition?: string;

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsString()
  templateId?: string;
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  hook?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  cta?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsString()
  subheadline?: string;

  @IsOptional()
  @IsString()
  painPoint?: string;

  @IsOptional()
  @IsString()
  valueProposition?: string;

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  renderedImageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}

export class RefinePostDto {
  @IsString()
  instruction: string;
}
