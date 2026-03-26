import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { ContentVersion } from './content-version.entity';

export enum Platform {
  INSTAGRAM_FEED_1X1 = 'instagram_feed_1x1',
  INSTAGRAM_FEED_4X5 = 'instagram_feed_4x5',
  INSTAGRAM_CAROUSEL = 'instagram_carousel',
  LINKEDIN_POST = 'linkedin_post',
}

export enum MarketingAngle {
  EDUCATIONAL = 'educational',
  STORYTELLING = 'storytelling',
  DIRECT_SALE = 'direct_sale',
  AUTHORITY = 'authority',
  SOCIAL_PROOF = 'social_proof',
  PAIN_AGITATE_SOLVE = 'pain_agitate_solve',
}

export enum PostObjective {
  AWARENESS = 'awareness',
  LEAD = 'lead',
  CONVERSION = 'conversion',
  ENGAGEMENT = 'engagement',
}

@Entity('content_posts')
export class ContentPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  campaignId: string;

  @ManyToOne(() => Campaign, (c) => c.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaignId' })
  campaign: Campaign;

  @Column({ type: 'enum', enum: Platform })
  platform: Platform;

  @Column({ type: 'enum', enum: MarketingAngle })
  marketingAngle: MarketingAngle;

  @Column({ type: 'enum', enum: PostObjective })
  objective: PostObjective;

  @Column({ type: 'text' })
  targetAudience: string;

  @Column({ type: 'text' })
  hook: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'text' })
  cta: string;

  @Column({ type: 'text', nullable: true })
  caption: string;

  @Column({ type: 'text', nullable: true })
  headline: string;

  @Column({ type: 'text', nullable: true })
  subheadline: string;

  @Column({ type: 'text', nullable: true })
  painPoint: string;

  @Column({ type: 'text', nullable: true })
  valueProposition: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tone: string;

  @Column({ type: 'varchar', nullable: true })
  templateId: string;

  @Column({ type: 'boolean', default: false })
  isFavorite: boolean;

  @Column({ type: 'int', default: 1 })
  currentVersion: number;

  @Column({ type: 'varchar', nullable: true })
  renderedImageUrl: string;

  @OneToMany(() => ContentVersion, (v) => v.post)
  versions: ContentVersion[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
