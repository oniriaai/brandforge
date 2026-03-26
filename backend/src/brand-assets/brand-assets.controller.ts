import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuid } from 'uuid';
import { Response } from 'express';
import { BrandAssetsService } from './brand-assets.service';
import { UpdateBrandConfigDto } from './dto/brand-asset.dto';

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'image/webp',
  'font/ttf',
  'font/otf',
  'font/woff',
  'font/woff2',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@ApiTags('brand-assets')
@Controller('brand-assets')
export class BrandAssetsController {
  constructor(private readonly service: BrandAssetsService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const name = uuid() + extname(file.originalname);
          cb(null, name);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type'), false);
        }
      },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string,
  ) {
    return this.service.uploadAsset(type, file);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeAsset(id);
  }

  @Get('config')
  getConfig() {
    return this.service.getGlobalConfig();
  }

  @Put('config')
  updateConfig(@Body() dto: UpdateBrandConfigDto) {
    return this.service.updateGlobalConfig(dto);
  }

  @Get('logo')
  async serveLogo(@Res() res: Response) {
    const asset = await this.service.getLogoAsset();
    if (!asset) throw new NotFoundException('No logo uploaded');
    res.sendFile(asset.storagePath, { root: process.cwd() });
  }
}
