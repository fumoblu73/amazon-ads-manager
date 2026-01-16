import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { User } from './User';

/**
 * Snapshot dei dati di vendita da kdpreports.amazon.com
 * Catturati tramite scraping client-side nell'estensione browser
 */
@Entity('kdp_sales_snapshots')
@Index(['userId', 'createdAt'])
export class KdpSalesSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Dati Overview (THIS_MONTH)
  @Column({ type: 'varchar', length: 10, nullable: true })
  currency: string;

  @Column({ type: 'integer', default: 0, name: 'digital_orders' })
  digitalOrders: number;

  @Column({ type: 'integer', default: 0, name: 'print_orders' })
  printOrders: number;

  @Column({ type: 'integer', default: 0, name: 'kenp_read' })
  kenpRead: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'total_royalties' })
  totalRoyalties: number;

  // Dati Marketplace Distribution
  @Column({ type: 'jsonb', nullable: true, name: 'marketplace_data' })
  marketplaceData: {
    marketplace: string;
    orders: number;
    royalties: number;
  }[];

  // Dati Orders (histogram giornaliero)
  @Column({ type: 'jsonb', nullable: true, name: 'daily_orders' })
  dailyOrders: {
    date: string;
    orders: number;
  }[];

  // Dati Top Titles
  @Column({ type: 'jsonb', nullable: true, name: 'top_titles' })
  topTitles: {
    asin: string;
    title: string;
    royalties: number;
  }[];

  // Metadata
  @Column({ type: 'varchar', length: 10, default: 'US' })
  marketplace: string;

  @Column({ type: 'varchar', length: 50, default: 'extension-client-scrape' })
  source: string;

  @Column({ type: 'jsonb', nullable: true, name: 'raw_data' })
  rawData: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
