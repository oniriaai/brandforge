import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ContentPost } from '../../content/entities/content-post.entity';

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export enum CampaignObjective {
  AWARENESS = 'awareness',
  LEAD_GENERATION = 'lead_generation',
  CONVERSION = 'conversion',
  ENGAGEMENT = 'engagement',
  BRAND_POSITIONING = 'brand_positioning',
}

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: CampaignStatus, default: CampaignStatus.DRAFT })
  status: CampaignStatus;

  @Column({ type: 'enum', enum: CampaignObjective })
  objective: CampaignObjective;

  @Column({ type: 'text', nullable: true })
  targetAudience: string;

  @Column({ type: 'text', nullable: true })
  valueProposition: string;

  @Column({ type: 'simple-array', nullable: true })
  painPoints: string[];

  @Column({ type: 'text', nullable: true })
  brandVoice: string;

  @Column({ type: 'text', nullable: true })
  industry: string;

  @OneToMany(() => ContentPost, (post: ContentPost) => post.campaign)
  posts: ContentPost[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
