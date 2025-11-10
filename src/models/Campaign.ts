import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, CreateDateColumn } from 'typeorm';

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  amazonCampaignId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  state: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  dailyBudget: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  campaignType: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  biddingStrategy: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}