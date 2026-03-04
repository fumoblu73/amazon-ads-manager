import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { User } from './User';
import { Campaign } from '../models/Campaign';
import { KdpDailyStats } from './KdpDailyStats';
import { JournalEvent } from './JournalEvent';

@Entity('kdp_books')
@Index(['userId', 'asin', 'marketplace'], { unique: true })
export class KdpBook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.kdpBooks)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 15 })
  asin: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  author: string;

  @Column({ type: 'varchar', length: 10 })
  marketplace: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  format: string;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'series_name' })
  seriesName: string;

  @Column({ type: 'integer', nullable: true, name: 'series_position' })
  seriesPosition: number;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'publish_date' })
  publishDate: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  price: string;

  @Column({ type: 'text', nullable: true, name: 'cover_url' })
  coverUrl: string;

  @Column({ type: 'integer', nullable: true, name: 'bsr_rank' })
  bsrRank: number;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'bsr_category' })
  bsrCategory: string;

  @Column({ type: 'uuid', nullable: true, name: 'linked_campaign_id' })
  linkedCampaignId: string;

  @ManyToOne(() => Campaign, { nullable: true })
  @JoinColumn({ name: 'linked_campaign_id' })
  linkedCampaign: Campaign;

  @Column({ type: 'integer', nullable: true, name: 'page_count' })
  pageCount: number;

  @Column({ type: 'varchar', length: 20, default: 'black_white', name: 'ink_type' })
  inkType: 'black_white' | 'standard_color' | 'premium_color';

  @Column({ type: 'varchar', length: 10, default: '6x9', name: 'trim_size' })
  trimSize: '5x8' | '6x9' | '8x10' | '8.5x8.5' | '8.5x11';

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 60, name: 'royalty_percentage' })
  royaltyPercentage: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true, name: 'royalty_per_unit' })
  royaltyPerUnit: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => KdpDailyStats, (stats) => stats.book)
  dailyStats: KdpDailyStats[];

  @OneToMany(() => JournalEvent, (event) => event.book)
  journalEvents: JournalEvent[];
}
