import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './User';

@Entity('automation_settings')
export class AutomationSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Function 1: Progressive Bidding
  @Column({ name: 'func1_enabled', default: true })
  func1Enabled: boolean;

  @Column({ name: 'func1_bid_increase', type: 'decimal', precision: 10, scale: 2, default: 0.02 })
  func1BidIncrease: number;

  @Column({ name: 'func1_frequency', type: 'int', default: 3 })
  func1Frequency: number;

  @Column({ name: 'func1_impressions', type: 'int', default: 20 })
  func1Impressions: number;

  @Column({ name: 'func1_clicks', type: 'int', default: 0 })
  func1Clicks: number;

  // Function 2: Placement Optimization
  @Column({ name: 'func2_enabled', default: true })
  func2Enabled: boolean;

  @Column({ name: 'func2_frequency', type: 'int', default: 7 })
  func2Frequency: number;

  @Column({ name: 'func2_timeframe_weeks', type: 'int', default: 4 })
  func2TimeframeWeeks: number;

  // Function 3: Targeting Optimization
  @Column({ name: 'func3_enabled', default: true })
  func3Enabled: boolean;

  @Column({ name: 'func3_frequency', type: 'int', default: 3 })
  func3Frequency: number;

  @Column({ name: 'func3_timeframe_a', type: 'int', default: 2000 })
  func3TimeframeA: number;

  @Column({ name: 'func3_timeframe_b', type: 'int', default: 3000 })
  func3TimeframeB: number;

  @Column({ name: 'func3_timeframe_c', type: 'int', default: 5000 })
  func3TimeframeC: number;

  @Column({ name: 'func3_clicks_pause', type: 'int', default: 10 })
  func3ClicksPause: number;

  @Column({ name: 'func3_clicks_65days', type: 'int', default: 30 })
  func3Clicks65days: number;

  // Function 4: Auto Ad Optimization
  @Column({ name: 'func4_enabled', default: true })
  func4Enabled: boolean;

  @Column({ name: 'func4_frequency', type: 'int', default: 7 })
  func4Frequency: number;

  @Column({ name: 'func4_timeframe_a', type: 'int', default: 1000 })
  func4TimeframeA: number;

  @Column({ name: 'func4_timeframe_b', type: 'int', default: 3000 })
  func4TimeframeB: number;

  @Column({ name: 'func4_timeframe_c', type: 'int', default: 5000 })
  func4TimeframeC: number;

  @Column({ name: 'func4_clicks_negative', type: 'int', default: 10 })
  func4ClicksNegative: number;

  @Column({ name: 'func4_spend_negative', type: 'decimal', precision: 10, scale: 2, default: 10 })
  func4SpendNegative: number;

  // Function 5: Campaign Feeding
  @Column({ name: 'func5_enabled', default: true })
  func5Enabled: boolean;

  @Column({ name: 'func5_frequency', type: 'int', default: 7 })
  func5Frequency: number;

  @Column({ name: 'func5_min_orders', type: 'int', default: 1 })
  func5MinOrders: number;

  @Column({ name: 'func5_bid_broad', type: 'decimal', precision: 10, scale: 2, default: 0.30 })
  func5BidBroad: number;

  @Column({ name: 'func5_bid_exact', type: 'decimal', precision: 10, scale: 2, default: 0.50 })
  func5BidExact: number;

  @Column({ name: 'func5_bid_phrase', type: 'decimal', precision: 10, scale: 2, default: 0.40 })
  func5BidPhrase: number;

  @Column({ name: 'func5_bid_expanded', type: 'decimal', precision: 10, scale: 2, default: 0.30 })
  func5BidExpanded: number;

  // FAST ACOS VAT Settings
  @Column({ name: 'use_vat_in_fast_acos', default: true })
  useVatInFastAcos: boolean;

  @Column({ name: 'vat_percentage', type: 'decimal', precision: 5, scale: 2, default: 22 })
  vatPercentage: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
