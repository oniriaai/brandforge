import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export enum AgentPlatform {
  INSTAGRAM_FEED_1X1 = 'instagram_feed_1x1',
  INSTAGRAM_FEED_4X5 = 'instagram_feed_4x5',
}

export enum AgentDesignProvider {
  INTERNAL = 'internal',
  STITCH = 'stitch',
  TWENTYFIRST = 'twentyfirst',
  EXTERNAL_SUBAGENT = 'external_subagent',
}

export enum AgentProviderMode {
  AUTO = 'auto',
  INTERNAL_ONLY = 'internal_only',
  EXTERNAL_PREFERRED = 'external_preferred',
}

export class AgentBrandKitDto {
  @IsOptional()
  @Matches(/^#([A-Fa-f0-9]{6})$/)
  primaryColor?: string;

  @IsOptional()
  @Matches(/^#([A-Fa-f0-9]{6})$/)
  secondaryColor?: string;

  @IsOptional()
  @Matches(/^#([A-Fa-f0-9]{6})$/)
  accentColor?: string;

  @IsOptional()
  @Matches(/^#([A-Fa-f0-9]{6})$/)
  backgroundColor?: string;

  @IsOptional()
  @Matches(/^#([A-Fa-f0-9]{6})$/)
  textColor?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  headingFont?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  bodyFont?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;
}

export class AgentProviderPreferencesDto {
  @IsOptional()
  @IsEnum(AgentProviderMode)
  mode?: AgentProviderMode;

  @IsOptional()
  @ArrayMaxSize(4)
  @IsEnum(AgentDesignProvider, { each: true })
  preferredProviders?: AgentDesignProvider[];
}

export class AgentGenerateDto {
  @IsString()
  @IsNotEmpty()
  inputText: string;

  @IsString()
  @IsNotEmpty()
  designGuidelines: string;

  @IsEnum(AgentPlatform)
  platform: AgentPlatform;

  @IsOptional()
  @ValidateNested()
  @Type(() => AgentBrandKitDto)
  brandKit?: AgentBrandKitDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  variantCount?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AgentProviderPreferencesDto)
  providerPreferences?: AgentProviderPreferencesDto;
}

export class AgentApproveDto {
  @IsString()
  @IsNotEmpty()
  reviewer: string;
}

export class AgentRejectDto {
  @IsString()
  @IsNotEmpty()
  reviewer: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class AgentSuggestDto {
  @IsString()
  @IsNotEmpty()
  reviewer: string;

  @IsString()
  @IsNotEmpty()
  instruction: string;
}

export class AgentSelectVariantDto {
  @IsUUID()
  variantId: string;
}
