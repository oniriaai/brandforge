import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';

@ApiTags('templates')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  @Get()
  getAll(@Query('platform') platform?: string) {
    if (platform) return this.service.getByPlatform(platform);
    return this.service.getRegistry();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
