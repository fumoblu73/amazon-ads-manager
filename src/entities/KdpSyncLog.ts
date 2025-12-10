import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './User';

@Entity('kdp_sync_log')
export class KdpSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 50, name: 'sync_type' })
  syncType: string; // 'extension', 'manual', 'auto'

  @Column({ type: 'varchar', length: 20 })
  status: string; // 'success', 'error', 'partial'

  @Column({ type: 'integer', default: 0, name: 'books_updated' })
  booksUpdated: number;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string;

  @Column({ type: 'integer', nullable: true, name: 'duration_ms' })
  durationMs: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
