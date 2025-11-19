import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { Campaign } from './Campaign';
import { Book } from './Book';

@Entity('automation_config')
@Index(['campaignId'], { unique: true })
export class AutomationConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'campaign_id' })
  campaignId: string;

  @Column({ type: 'uuid', name: 'book_id', nullable: true })
  bookId: string | null;

  // ================================================
  // FUNZIONE 1: Progressive Bidding Increase
  // ================================================
  @Column({ type: 'boolean', name: 'func1_enabled', default: true })
  func1Enabled: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'func1_bid_increase', default: 0.02 })
  func1BidIncrease: number;

  @Column({ type: 'integer', name: 'func1_frequency', default: 3 })
  func1Frequency: number;

  @Column({ type: 'integer', name: 'func1_impressions', default: 20 })
  func1Impressions: number;

  @Column({ type: 'integer', name: 'func1_clicks', default: 0 })
  func1Clicks: number;

  // ================================================
  // FUNZIONE 2: Placement Optimization
  // ================================================
  @Column({ type: 'boolean', name: 'func2_enabled', default: true })
  func2Enabled: boolean;

  @Column({ type: 'integer', name: 'func2_frequency', default: 7 })
  func2Frequency: number;

  @Column({ type: 'integer', name: 'func2_timeframe_weeks', default: 4 })
  func2TimeframeWeeks: number;

  // ================================================
  // FUNZIONE 3: Targeting Optimization
  // ================================================
  @Column({ type: 'boolean', name: 'func3_enabled', default: true })
  func3Enabled: boolean;

  @Column({ type: 'integer', name: 'func3_frequency', default: 3 })
  func3Frequency: number;

  @Column({ type: 'integer', name: 'func3_timeframe_a', default: 2000 })
  func3TimeframeA: number;

  @Column({ type: 'integer', name: 'func3_timeframe_b', default: 3000 })
  func3TimeframeB: number;

  @Column({ type: 'integer', name: 'func3_timeframe_c', default: 5000 })
  func3TimeframeC: number;

  @Column({ type: 'integer', name: 'func3_clicks_pause', default: 10 })
  func3ClicksPause: number;

  @Column({ type: 'integer', name: 'func3_clicks_65days', default: 30 })
  func3Clicks65days: number;

  // ================================================
  // FUNZIONE 4: Auto Ad Optimization
  // ================================================
  @Column({ type: 'boolean', name: 'func4_enabled', default: true })
  func4Enabled: boolean;

  @Column({ type: 'integer', name: 'func4_frequency', default: 7 })
  func4Frequency: number;

  @Column({ type: 'integer', name: 'func4_timeframe_a', default: 1000 })
  func4TimeframeA: number;

  @Column({ type: 'integer', name: 'func4_timeframe_b', default: 3000 })
  func4TimeframeB: number;

  @Column({ type: 'integer', name: 'func4_timeframe_c', default: 5000 })
  func4TimeframeC: number;

  @Column({ type: 'integer', name: 'func4_clicks_negative', default: 10 })
  func4ClicksNegative: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'func4_spend_negative', default: 10.00 })
  func4SpendNegative: number;

  // ================================================
  // FUNZIONE 5: Campaign Feeding
  // ================================================
  @Column({ type: 'boolean', name: 'func5_enabled', default: true })
  func5Enabled: boolean;

  @Column({ type: 'integer', name: 'func5_frequency', default: 7 })
  func5Frequency: number;

  @Column({ type: 'integer', name: 'func5_min_orders', default: 1 })
  func5MinOrders: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'func5_bid_broad', default: 0.30 })
  func5BidBroad: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'func5_bid_exact', default: 0.50 })
  func5BidExact: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'func5_bid_phrase', default: 0.40 })
  func5BidPhrase: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'func5_bid_expanded', default: 0.30 })
  func5BidExpanded: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relazioni
  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign?: Campaign;

  @ManyToOne(() => Book, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'book_id' })
  book?: Book;

  /**
   * Restituisce un array delle funzioni abilitate
   */
  getEnabledFunctions(): number[] {
    const enabled: number[] = [];
    if (this.func1Enabled) enabled.push(1);
    if (this.func2Enabled) enabled.push(2);
    if (this.func3Enabled) enabled.push(3);
    if (this.func4Enabled) enabled.push(4);
    if (this.func5Enabled) enabled.push(5);
    return enabled;
  }

  /**
   * Conta quante funzioni sono abilitate
   */
  countEnabledFunctions(): number {
    return this.getEnabledFunctions().length;
  }
}
