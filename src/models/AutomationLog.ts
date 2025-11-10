import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('automation_logs')
export class AutomationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'varchar', length: 100 })
  targetId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  targetName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  oldValue: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  newValue: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'varchar', length: 100 })
  ruleName: string;

  @Column({ type: 'varchar', length: 20, default: 'success' })
  status: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;
}