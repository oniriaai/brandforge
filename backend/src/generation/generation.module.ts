import { Module } from '@nestjs/common';
import { GenerationService } from './generation.service';
import { GenerationController } from './generation.controller';
import { OpenAIService } from './openai.service';
import { ContentModule } from '../content/content.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { BrandAssetsModule } from '../brand-assets/brand-assets.module';

@Module({
  imports: [ContentModule, CampaignsModule, BrandAssetsModule],
  controllers: [GenerationController],
  providers: [GenerationService, OpenAIService],
  exports: [GenerationService],
})
export class GenerationModule {}
