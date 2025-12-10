import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { KdpBook } from './KdpBook';

@Entity('kdp_daily_stats')
@Index(['bookId', 'date'], { unique: true })
export class KdpDailyStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'book_id' })
  bookId: string;

  @ManyToOne(() => KdpBook, (book) => book.dailyStats)
  @JoinColumn({ name: 'book_id' })
  book: KdpBook;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'integer', default: 0, name: 'ebook_sales' })
  ebookSales: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'ebook_royalty' })
  ebookRoyalty: number;

  @Column({ type: 'integer', default: 0, name: 'paperback_sales' })
  paperbackSales: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'paperback_royalty' })
  paperbackRoyalty: number;

  @Column({ type: 'integer', default: 0, name: 'hardcover_sales' })
  hardcoverSales: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'hardcover_royalty' })
  hardcoverRoyalty: number;

  @Column({ type: 'integer', default: 0, name: 'kenp_reads' })
  kenpReads: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'kenp_royalty' })
  kenpRoyalty: number;

  @Column({ type: 'integer', nullable: true })
  bsr: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'ad_spend' })
  adSpend: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
