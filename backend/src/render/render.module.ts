import { Module } from '@nestjs/common';
import { RenderService } from './render.service';
import { RenderController } from './render.controller';
import { TemplatesModule } from '../templates/templates.module';
import { ContentModule } from '../content/content.module';
import { BrandAssetsModule } from '../brand-assets/brand-assets.module';

@Module({
  imports: [TemplatesModule, ContentModule, BrandAssetsModule],
  controllers: [RenderController],
  providers: [RenderService],
  exports: [RenderService],
})
export class RenderModule {}
