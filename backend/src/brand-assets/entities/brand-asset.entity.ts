import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum AssetType {
  LOGO = 'logo',
  IMAGE = 'image',
  FONT = 'font',
  ICON = 'icon',
}

@Entity('brand_assets')
export class BrandAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  campaignId: string;

  @Column({ type: 'enum', enum: AssetType })
  type: AssetType;

  @Column()
  filename: string;

  @Column()
  storagePath: string;

  @Column({ type: 'varchar', nullable: true })
  mimeType: string;

  @CreateDateColumn()
  createdAt: Date;
}
