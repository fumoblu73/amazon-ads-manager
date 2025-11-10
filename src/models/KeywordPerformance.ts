import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('keyword_performance')
@Index(['keywordId', 'date'])
export class KeywordPerformance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  keywordId: string;

  @Column({ type: 'varchar', length: 255 })
  keyword: string;

  @Column({ type: 'varchar', length: 100 })
  campaignId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  campaignName: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'int', default: 0 })
  impressions: number;

  @Column({ type: 'int', default: 0 })
  clicks: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  cost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  sales: number;

  @Column({ type: 'int', default: 0 })
  orders: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  ctr: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  acos: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  cpc: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  currentBid: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  state: string;

  @CreateDateColumn()
  createdAt: Date;
}