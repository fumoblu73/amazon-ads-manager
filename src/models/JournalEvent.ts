import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

export type JournalEventType =
  | 'sale'
  | 'kenp_read'
  | 'refund'
  | 'adjustment'
  | 'ad_charge'
  | 'other';

@Entity('journal_events')
@Index(['userId', 'date'])
@Index(['asin'])
export class JournalEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  userId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  asin?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  title?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  marketplace?: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'other'
  })
  eventType: JournalEventType;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  currency?: string;

  @Column({ type: 'int', nullable: true })
  quantity?: number;

  @Column({ type: 'text', nullable: true })
  metadata?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface CreateJournalEventInput {
  userId: string;
  date: string;
  asin?: string;
  title?: string;
  marketplace?: string;
  eventType: JournalEventType;
  description?: string;
  amount: number;
  currency?: string;
  quantity?: number;
  metadata?: string;
}

export interface UpdateJournalEventInput {
  asin?: string;
  title?: string;
  marketplace?: string;
  eventType?: JournalEventType;
  description?: string;
  amount?: number;
  currency?: string;
  quantity?: number;
  metadata?: string;
}

export interface JournalEventFilters {
  startDate?: string;
  endDate?: string;
  eventType?: JournalEventType;
  asin?: string;
  marketplace?: string;
  page?: number;
  limit?: number;
}

export const JournalEventModel = {
  validate: (data: Partial<CreateJournalEventInput | UpdateJournalEventInput>): string[] => {
    const errors: string[] = [];

    if ('date' in data && !data.date) {
      errors.push('Date is required');
    }

    if ('eventType' in data && data.eventType) {
      const validTypes: JournalEventType[] = ['sale', 'kenp_read', 'refund', 'adjustment', 'ad_charge', 'other'];
      if (!validTypes.includes(data.eventType)) {
        errors.push(`Event type must be one of: ${validTypes.join(', ')}`);
      }
    }

    if ('amount' in data && typeof data.amount !== 'number') {
      errors.push('Amount must be a number');
    }

    return errors;
  }
};
