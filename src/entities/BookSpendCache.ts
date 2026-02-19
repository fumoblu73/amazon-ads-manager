import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User';

@Entity('book_spend_cache')
@Index(['userId', 'marketplace', 'asin', 'adType'], { unique: true })
export class BookSpendCache {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 10 })
  marketplace: string; // US, UK, DE, FR, IT, ES, JP, CA, AU

  @Column({ type: 'varchar', length: 20 })
  asin: string;

  @Column({ type: 'varchar', length: 10, name: 'ad_type' })
  adType: string; // SP | SD | SB

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'spend_7d', nullable: true })
  spend7d: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'sales_7d', nullable: true })
  sales7d: number | null;

  @Column({ type: 'integer', name: 'impressions_7d', nullable: true })
  impressions7d: number | null;

  @Column({ type: 'integer', name: 'clicks_7d', nullable: true })
  clicks7d: number | null;

  @CreateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
