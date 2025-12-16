import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index
} from 'typeorm';

export type SyncStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type SyncType = 'books' | 'daily_stats' | 'journal_events' | 'bsr_data';

@Entity('kdp_sync_logs')
@Index(['userId', 'syncType', 'createdAt'])
export class KdpSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  syncType: SyncType;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: SyncStatus;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'int', default: 0 })
  recordsProcessed: number;

  @Column({ type: 'int', default: 0 })
  recordsCreated: number;

  @Column({ type: 'int', default: 0 })
  recordsUpdated: number;

  @Column({ type: 'int', default: 0 })
  recordsFailed: number;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'text', nullable: true })
  metadata?: string;

  @CreateDateColumn()
  createdAt: Date;
}

export interface CreateKdpSyncLogInput {
  userId: string;
  syncType: SyncType;
  status?: SyncStatus;
  startedAt?: Date;
  recordsProcessed?: number;
  metadata?: string;
}

export interface UpdateKdpSyncLogInput {
  status?: SyncStatus;
  startedAt?: Date;
  completedAt?: Date;
  recordsProcessed?: number;
  recordsCreated?: number;
  recordsUpdated?: number;
  recordsFailed?: number;
  errorMessage?: string;
  metadata?: string;
}

export const KdpSyncLogModel = {
  validate: (data: Partial<CreateKdpSyncLogInput | UpdateKdpSyncLogInput>): string[] => {
    const errors: string[] = [];

    if ('syncType' in data && data.syncType) {
      const validTypes: SyncType[] = ['books', 'daily_stats', 'journal_events', 'bsr_data'];
      if (!validTypes.includes(data.syncType)) {
        errors.push(`Sync type must be one of: ${validTypes.join(', ')}`);
      }
    }

    if ('status' in data && data.status) {
      const validStatuses: SyncStatus[] = ['pending', 'in_progress', 'completed', 'failed'];
      if (!validStatuses.includes(data.status)) {
        errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
      }
    }

    return errors;
  }
};
