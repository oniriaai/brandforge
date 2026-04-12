import { Module } from '@nestjs/common';
import { AiImageAgentController } from './ai-image-agent.controller';
import { AiImageAgentService } from './ai-image-agent.service';
import { ContentModule } from '../content/content.module';
import { BrandAssetsModule } from '../brand-assets/brand-assets.module';

@Module({
  imports: [ContentModule, BrandAssetsModule],
  controllers: [AiImageAgentController],
  providers: [AiImageAgentService],
})
export class AiImageAgentModule {}
