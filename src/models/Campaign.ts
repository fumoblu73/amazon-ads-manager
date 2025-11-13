import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, CreateDateColumn } from 'typeorm';

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true, name: 'amazon_campaign_id' })
  amazonCampaignId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  state: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'daily_budget' })
  dailyBudget: number;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'campaign_type' })
  campaignType: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'bidding_strategy' })
  biddingStrategy: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}