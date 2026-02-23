import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('automation_logs')
export class AutomationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'varchar', length: 100, name: 'target_id' })
  targetId: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'target_name' })
  targetName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'old_value' })
  oldValue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'new_value' })
  newValue: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'varchar', length: 100, name: 'rule_name' })
  ruleName: string;

  @Column({ type: 'varchar', length: 20, default: 'success' })
  status: string;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'book_asin' })
  bookAsin: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'book_title' })
  bookTitle: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}