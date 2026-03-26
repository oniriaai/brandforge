import { IsString, IsEnum, IsOptional } from 'class-validator';
import { AssetType } from '../entities/brand-asset.entity';
import { DesignStyle } from '../entities/brand-config.entity';

export class CreateBrandAssetDto {
  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsEnum(AssetType)
  type: AssetType;
}

export class UpdateBrandConfigDto {
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  accentColor?: string;

  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @IsOptional()
  @IsString()
  textColor?: string;

  @IsOptional()
  @IsString()
  headingFont?: string;

  @IsOptional()
  @IsString()
  bodyFont?: string;

  @IsOptional()
  @IsString()
  logoAssetId?: string;

  @IsOptional()
  @IsEnum(DesignStyle)
  designStyle?: DesignStyle;
}
