import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ContentPost } from './content-post.entity';

@Entity('content_versions')
export class ContentVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  postId: string;

  @ManyToOne(() => ContentPost, (p) => p.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: ContentPost;

  @Column({ type: 'int' })
  versionNumber: number;

  @Column({ type: 'jsonb' })
  contentSnapshot: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  refinementPrompt: string | null;

  @Column({ type: 'varchar', nullable: true })
  renderedImageUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
