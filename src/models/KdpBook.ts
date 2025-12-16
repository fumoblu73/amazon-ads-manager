import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

@Entity('kdp_books')
@Index(['userId', 'asin'], { unique: true })
export class KdpBook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  asin: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'varchar', length: 10 })
  marketplace: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  format?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  author?: string;

  @Column({ type: 'date', nullable: true })
  publicationDate?: string;

  @Column({ type: 'int', nullable: true, default: 0 })
  kenpc?: number;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncDate?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
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
  publicationDate?: string;
  kenpc?: number;
}

export interface UpdateKdpBookInput {
  title?: string;
  marketplace?: string;
  format?: string;
  author?: string;
  publicationDate?: string;
  kenpc?: number;
  lastSyncDate?: Date;
}

export interface BookshelfFilters {
  status?: 'all' | 'active' | 'archived';
  search?: string;
  marketplace?: string;
  page?: number;
  limit?: number;
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
