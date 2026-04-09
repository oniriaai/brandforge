import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, Matches, ValidateNested } from 'class-validator';

export enum AgentPlatform {
  INSTAGRAM_FEED_1X1 = 'instagram_feed_1x1',
  INSTAGRAM_FEED_4X5 = 'instagram_feed_4x5',
}

export class AgentBrandKitDto {
  @Matches(/^#([A-Fa-f0-9]{6})$/)
  primaryColor: string;

  @Matches(/^#([A-Fa-f0-9]{6})$/)
  secondaryColor: string;

  @Matches(/^#([A-Fa-f0-9]{6})$/)
  accentColor: string;

  @Matches(/^#([A-Fa-f0-9]{6})$/)
  backgroundColor: string;

  @Matches(/^#([A-Fa-f0-9]{6})$/)
  textColor: string;

  @IsString()
  @IsNotEmpty()
  headingFont: string;

  @IsString()
  @IsNotEmpty()
  bodyFont: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;
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

  @ValidateNested()
  @Type(() => AgentBrandKitDto)
  brandKit: AgentBrandKitDto;
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
