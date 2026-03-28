import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('pending_reports')
export class PendingReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 10 })
  marketplace: string;

  @Column({ type: 'varchar', length: 255, name: 'campaign_id' })
  campaignId: string;

  @Column({ type: 'varchar', length: 500, name: 'campaign_name', nullable: true })
  campaignName: string;

  @Column({ type: 'integer', name: 'campaign_type' })
  campaignType: number;

  @Column({ type: 'varchar', length: 255, name: 'report_id' })
  reportId: string;

  @Column({ type: 'varchar', length: 50, name: 'report_type' })
  reportType: string;

  @Column({ type: 'text' })
  columns: string; // JSON array

  @Column({ type: 'varchar', length: 10, name: 'start_date' })
  startDate: string;

  @Column({ type: 'varchar', length: 10, name: 'end_date' })
  endDate: string;

  @Column({ type: 'varchar', length: 20, default: 'submitted' })
  status: string; // submitted | completed | failed | processed

  @Column({ type: 'text', name: 'function_numbers' })
  functionNumbers: string; // JSON array e.g. "[1,3]"

  @Column({ type: 'boolean', name: 'dry_run', default: false })
  dryRun: boolean;

  @Column({ type: 'text', name: 'report_url', nullable: true })
  reportUrl: string | null;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ type: 'integer', name: 'max_attempts', default: 20 })
  maxAttempts: number;

  @Column({ type: 'varchar', length: 255, name: 'report_id_65a', nullable: true })
  reportId65a: string | null;

  @Column({ type: 'varchar', length: 255, name: 'report_id_65b', nullable: true })
  reportId65b: string | null;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
