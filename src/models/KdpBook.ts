import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

@Entity('kdp_books')
@Index(['userId', 'asin', 'marketplace'], { unique: true })
export class KdpBook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 15 })
  asin: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  author: string;

  @Column({ type: 'varchar', length: 10 })
  marketplace: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  format: string;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'series_name' })
  seriesName: string;

  @Column({ type: 'integer', nullable: true, name: 'series_position' })
  seriesPosition: number;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'publish_date' })
  publishDate: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  price: string;

  @Column({ type: 'text', nullable: true, name: 'cover_url' })
  coverUrl: string;

  @Column({ type: 'integer', nullable: true, name: 'bsr_rank' })
  bsrRank: number;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'bsr_category' })
  bsrCategory: string;

  @Column({ type: 'uuid', nullable: true, name: 'linked_campaign_id' })
  linkedCampaignId: string;

  @Column({ type: 'integer', nullable: true, name: 'page_count' })
  pageCount: number;

  @Column({ type: 'varchar', length: 20, default: 'black_white', name: 'ink_type' })
  inkType: 'black_white' | 'standard_color' | 'premium_color';

  @Column({ type: 'varchar', length: 10, default: '6x9', name: 'trim_size' })
  trimSize: '5x8' | '6x9' | '8x10' | '8.5x8.5' | '8.5x11';

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 60, name: 'royalty_percentage' })
  royaltyPercentage: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

// Validation and types
export interface CreateKdpBookInput {
  userId: string;
  asin: string;
  title: string;
  marketplace: string;
  format?: string;
  author?: string;
  seriesName?: string;
  seriesPosition?: number;
  publishDate?: string;
  price?: string;
  coverUrl?: string;
  bsrRank?: number;
  bsrCategory?: string;
  linkedCampaignId?: string;
  pageCount?: number;
  inkType?: 'black_white' | 'standard_color' | 'premium_color';
  trimSize?: '5x8' | '6x9' | '8x10' | '8.5x8.5' | '8.5x11';
  royaltyPercentage?: number;
}

export interface UpdateKdpBookInput {
  title?: string;
  marketplace?: string;
  author?: string;
  seriesName?: string;
  seriesPosition?: number;
  publishDate?: Date;
  coverUrl?: string;
  linkedCampaignId?: string;
  pageCount?: number;
  inkType?: 'black_white' | 'standard_color' | 'premium_color';
  trimSize?: '5x8' | '6x9' | '8x10' | '8.5x8.5' | '8.5x11';
  royaltyPercentage?: number;
}

export interface BookshelfFilters {
  status?: 'all' | 'active' | 'archived';
  search?: string;
  marketplace?: string;
  page?: number;
  limit?: number;
  format?: string;
}

export const KdpBookModel = {
  validate: (data: Partial<CreateKdpBookInput | UpdateKdpBookInput>): string[] => {
    const errors: string[] = [];

    if ('asin' in data && (!data.asin || data.asin.length < 10 || data.asin.length > 10)) {
      errors.push('ASIN must be exactly 10 characters');
    }

    if ('title' in data && (!data.title || data.title.length > 500)) {
      errors.push('Title is required and must be max 500 characters');
    }

    if ('marketplace' in data && (!data.marketplace || data.marketplace.length > 10)) {
      errors.push('Marketplace is required and must be max 10 characters');
    }

    return errors;
  }
};
