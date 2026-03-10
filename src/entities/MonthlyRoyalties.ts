import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index } from 'typeorm';

@Entity('monthly_royalties')
@Index(['userId', 'marketplace', 'yearMonth'], { unique: true })
export class MonthlyRoyalties {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 10 })
  marketplace: string; // US, UK, CA, DE, FR, IT, ES, AU

  @Column({ type: 'varchar', length: 7, name: 'year_month' })
  yearMonth: string; // YYYY-MM

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  royalties: number;

  @Column({ type: 'varchar', length: 5, default: 'USD' })
  currency: string; // USD, GBP, CAD, EUR, AUD, JPY, BRL, MXN, INR

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
