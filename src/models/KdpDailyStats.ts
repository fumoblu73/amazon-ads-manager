import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

@Entity('kdp_daily_stats')
@Index(['userId', 'date'], { unique: true })
@Index(['date'])
export class KdpDailyStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  userId: string;

  @Column({ type: 'date' })
  date: string;

  // Royalty data
  @Column({ name: 'grossroyalties', type: 'decimal', precision: 10, scale: 2, default: 0 })
  grossRoyalties: number;

  @Column({ name: 'spending', type: 'decimal', precision: 10, scale: 2, default: 0 })
  spending: number;

  @Column({ name: 'netroyalties', type: 'decimal', precision: 10, scale: 2, default: 0 })
  netRoyalties: number;

  // Sales data
  @Column({ name: 'paidunits', type: 'int', default: 0 })
  paidUnits: number;

  @Column({ name: 'freeunits', type: 'int', default: 0 })
  freeUnits: number;

  @Column({ name: 'kenpreads', type: 'bigint', default: 0 })
  kenpReads: number;

  // Performance metrics
  @Column({ name: 'overallroi', type: 'decimal', precision: 10, scale: 2, nullable: true })
  overallROI?: number;

  @Column({ name: 'amsroi', type: 'decimal', precision: 10, scale: 2, nullable: true })
  amsROI?: number;

  @Column({ name: 'amsroas', type: 'decimal', precision: 10, scale: 2, nullable: true })
  amsROAS?: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  marketplace?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  asin?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface CreateKdpDailyStatsInput {
  userId: string;
  date: string;
  grossRoyalties?: number;
  spending?: number;
  netRoyalties?: number;
  paidUnits?: number;
  freeUnits?: number;
  kenpReads?: number;
  overallROI?: number;
  amsROI?: number;
  amsROAS?: number;
  marketplace?: string;
  asin?: string;
}

export interface UpdateKdpDailyStatsInput {
  grossRoyalties?: number;
  spending?: number;
  netRoyalties?: number;
  paidUnits?: number;
  freeUnits?: number;
  kenpReads?: number;
  overallROI?: number;
  amsROI?: number;
  amsROAS?: number;
}

export const KdpDailyStatsModel = {
  validate: (data: Partial<CreateKdpDailyStatsInput | UpdateKdpDailyStatsInput>): string[] => {
    const errors: string[] = [];

    if ('date' in data && !data.date) {
      errors.push('Date is required');
    }

    if ('grossRoyalties' in data && typeof data.grossRoyalties !== 'number' && data.grossRoyalties !== undefined) {
      errors.push('Gross royalties must be a number');
    }

    if ('spending' in data && typeof data.spending !== 'number' && data.spending !== undefined) {
      errors.push('Spending must be a number');
    }

    return errors;
  }
};
