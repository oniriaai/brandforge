import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign, CampaignStatus } from './entities/campaign.entity';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private readonly repo: Repository<Campaign>,
  ) {}

  async create(dto: CreateCampaignDto): Promise<Campaign> {
    const campaign = this.repo.create(dto);
    return this.repo.save(campaign);
  }

  async findAll(): Promise<Campaign[]> {
    return this.repo.find({
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Campaign> {
    const campaign = await this.repo.findOne({
      where: { id },
      relations: ['posts'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async update(id: string, dto: UpdateCampaignDto): Promise<Campaign> {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async archive(id: string): Promise<Campaign> {
    await this.findOne(id);
    await this.repo.update(id, { status: CampaignStatus.ARCHIVED });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const campaign = await this.findOne(id);
    await this.repo.remove(campaign);
  }
}
