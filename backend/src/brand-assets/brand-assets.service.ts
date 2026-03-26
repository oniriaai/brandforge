import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrandAsset, AssetType } from './entities/brand-asset.entity';
import { BrandConfig } from './entities/brand-config.entity';
import { UpdateBrandConfigDto } from './dto/brand-asset.dto';

@Injectable()
export class BrandAssetsService {
  constructor(
    @InjectRepository(BrandAsset)
    private readonly assetRepo: Repository<BrandAsset>,
    @InjectRepository(BrandConfig)
    private readonly configRepo: Repository<BrandConfig>,
  ) {}

  async uploadAsset(
    type: string,
    file: Express.Multer.File,
  ): Promise<BrandAsset> {
    // If uploading a logo, remove previous logo assets
    if (type === 'logo') {
      const existing = await this.assetRepo.find({ where: { type: AssetType.LOGO } });
      if (existing.length > 0) {
        await this.assetRepo.remove(existing);
      }
    }

    const asset = this.assetRepo.create({
      type: type as BrandAsset['type'],
      filename: file.originalname,
      storagePath: file.path,
      mimeType: file.mimetype,
    });
    const saved = await this.assetRepo.save(asset);

    // If logo, auto-link to global config
    if (type === 'logo') {
      const config = await this.getGlobalConfig();
      config.logoAssetId = saved.id;
      await this.configRepo.save(config);
    }

    return saved;
  }

  async findAll(): Promise<BrandAsset[]> {
    return this.assetRepo.find({ order: { createdAt: 'DESC' } });
  }

  async removeAsset(id: string): Promise<void> {
    const asset = await this.assetRepo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found');
    // If removing a logo, clear logoAssetId from config
    if (asset.type === AssetType.LOGO) {
      const config = await this.getGlobalConfig();
      if (config.logoAssetId === id) {
        config.logoAssetId = null;
        await this.configRepo.save(config);
      }
    }
    await this.assetRepo.remove(asset);
  }

  async getGlobalConfig(): Promise<BrandConfig> {
    let config = await this.configRepo.findOne({ where: { name: 'default' } });
    if (!config) {
      config = this.configRepo.create({ name: 'default' });
      config = await this.configRepo.save(config);
    }
    return config;
  }

  async updateGlobalConfig(dto: UpdateBrandConfigDto): Promise<BrandConfig> {
    const config = await this.getGlobalConfig();
    Object.assign(config, dto);
    return this.configRepo.save(config);
  }

  async getLogoAsset(): Promise<BrandAsset | null> {
    const config = await this.getGlobalConfig();
    if (!config.logoAssetId) return null;
    return this.assetRepo.findOne({ where: { id: config.logoAssetId } });
  }
}
