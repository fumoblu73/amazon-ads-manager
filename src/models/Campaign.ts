import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../entities/User';

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

  // User relationship for multi-user support
  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}