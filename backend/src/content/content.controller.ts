import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { CreatePostDto, UpdatePostDto } from './dto/content.dto';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private readonly service: ContentService) {}

  @Post()
  create(@Body() dto: CreatePostDto) {
    return this.service.create(dto);
  }

  @Get()
  findByCampaign(@Query('campaignId', ParseUUIDPipe) campaignId: string) {
    return this.service.findByCampaign(campaignId);
  }

  @Get('favorites')
  getFavorites(@Query('campaignId', ParseUUIDPipe) campaignId: string) {
    return this.service.getFavorites(campaignId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.service.update(id, dto);
  }

  @Put(':id/favorite')
  toggleFavorite(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.toggleFavorite(id);
  }

  @Get(':id/versions')
  getVersions(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getVersions(id);
  }

  @Post(':id/versions/:versionId/restore')
  restoreVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.service.restoreVersion(id, versionId);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
