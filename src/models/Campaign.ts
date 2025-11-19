import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, CreateDateColumn, Index, OneToOne } from 'typeorm';
import { AutomationConfigEntity } from './AutomationConfigEntity';

@Entity('campaigns')
@Index(['amazonCampaignId', 'marketplace'], { unique: true })
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, name: 'amazon_campaign_id' })
  amazonCampaignId: string;

  @Column({ type: 'varchar', length: 10, default: 'US' })
  marketplace: string;

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

  // Relazione con automation_config
  @OneToOne(() => AutomationConfigEntity, (config) => config.campaign)
  automationConfig?: AutomationConfigEntity;
}