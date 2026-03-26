import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentPost } from './entities/content-post.entity';
import { ContentVersion } from './entities/content-version.entity';
import { CreatePostDto, UpdatePostDto } from './dto/content.dto';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(ContentPost)
    private readonly postRepo: Repository<ContentPost>,
    @InjectRepository(ContentVersion)
    private readonly versionRepo: Repository<ContentVersion>,
  ) {}

  async create(dto: CreatePostDto): Promise<ContentPost> {
    const post = this.postRepo.create(dto);
    const saved = await this.postRepo.save(post);
    await this.createVersionSnapshot(saved, null);
    return saved;
  }

  async findByCampaign(campaignId: string): Promise<ContentPost[]> {
    return this.postRepo.find({
      where: { campaignId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<ContentPost> {
    const post = await this.postRepo.findOne({
      where: { id },
      relations: ['versions'],
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async update(id: string, dto: UpdatePostDto): Promise<ContentPost> {
    const post = await this.findOne(id);
    Object.assign(post, dto);
    post.currentVersion += 1;
    const saved = await this.postRepo.save(post);
    await this.createVersionSnapshot(saved, null);
    return saved;
  }

  async toggleFavorite(id: string): Promise<ContentPost> {
    const post = await this.findOne(id);
    post.isFavorite = !post.isFavorite;
    return this.postRepo.save(post);
  }

  async getFavorites(campaignId: string): Promise<ContentPost[]> {
    return this.postRepo.find({
      where: { campaignId, isFavorite: true },
      order: { updatedAt: 'DESC' },
    });
  }

  async getVersions(postId: string): Promise<ContentVersion[]> {
    return this.versionRepo.find({
      where: { postId },
      order: { versionNumber: 'DESC' },
    });
  }

  async restoreVersion(postId: string, versionId: string): Promise<ContentPost> {
    const version = await this.versionRepo.findOne({ where: { id: versionId, postId } });
    if (!version) throw new NotFoundException('Version not found');
    const post = await this.findOne(postId);
    const snapshot = version.contentSnapshot as Record<string, unknown>;
    Object.assign(post, snapshot);
    post.currentVersion += 1;
    const saved = await this.postRepo.save(post);
    await this.createVersionSnapshot(saved, 'Restored from v' + version.versionNumber);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const post = await this.findOne(id);
    await this.postRepo.remove(post);
  }

  async createVersionSnapshot(post: ContentPost, refinementPrompt: string | null): Promise<ContentVersion> {
    const snapshot: Record<string, unknown> = {
      hook: post.hook,
      body: post.body,
      cta: post.cta,
      caption: post.caption,
      headline: post.headline,
      subheadline: post.subheadline,
      painPoint: post.painPoint,
      valueProposition: post.valueProposition,
      tone: post.tone,
      templateId: post.templateId,
    };
    const version = this.versionRepo.create({
      postId: post.id,
      versionNumber: post.currentVersion,
      contentSnapshot: snapshot,
      refinementPrompt,
      renderedImageUrl: post.renderedImageUrl,
    });
    return this.versionRepo.save(version) as Promise<ContentVersion>;
  }

  async saveRefinedContent(
    postId: string,
    refinedFields: Partial<ContentPost>,
    refinementPrompt: string,
  ): Promise<ContentPost> {
    const post = await this.findOne(postId);
    Object.assign(post, refinedFields);
    post.currentVersion += 1;
    const saved = await this.postRepo.save(post);
    await this.createVersionSnapshot(saved, refinementPrompt);
    return saved;
  }
}
