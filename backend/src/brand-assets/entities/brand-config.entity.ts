import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

export enum DesignStyle {
  MINIMAL = 'minimal',
  BOLD = 'bold',
  CORPORATE = 'corporate',
  CREATIVE = 'creative',
  ELEGANT = 'elegant',
  MODERN = 'modern',
}

@Entity('brand_configs')
export class BrandConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'default', unique: true })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  primaryColor: string;

  @Column({ type: 'varchar', nullable: true })
  secondaryColor: string;

  @Column({ type: 'varchar', nullable: true })
  accentColor: string;

  @Column({ type: 'varchar', nullable: true })
  backgroundColor: string;

  @Column({ type: 'varchar', nullable: true })
  textColor: string;

  @Column({ type: 'varchar', nullable: true })
  headingFont: string;

  @Column({ type: 'varchar', nullable: true })
  bodyFont: string;

  @Column({ type: 'varchar', nullable: true })
  logoAssetId: string | null;

  @Column({ type: 'varchar', default: 'modern' })
  designStyle: DesignStyle;
}
