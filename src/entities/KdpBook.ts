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

  @Column({ type: 'date', nullable: true, name: 'publish_date' })
  publishDate: Date;

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => KdpDailyStats, (stats) => stats.book)
  dailyStats: KdpDailyStats[];

  @OneToMany(() => JournalEvent, (event) => event.book)
  journalEvents: JournalEvent[];
}
