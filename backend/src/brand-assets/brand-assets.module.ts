import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BrandAsset } from './entities/brand-asset.entity';
import { BrandConfig } from './entities/brand-config.entity';
import { BrandAssetsService } from './brand-assets.service';
import { BrandAssetsController } from './brand-assets.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BrandAsset, BrandConfig])],
  controllers: [BrandAssetsController],
  providers: [BrandAssetsService],
  exports: [BrandAssetsService],
})
export class BrandAssetsModule {}
