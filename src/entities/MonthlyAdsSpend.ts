import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('monthly_ads_spend')
@Index(['userId', 'marketplace', 'yearMonth'], { unique: true })
export class MonthlyAdsSpend {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 10 })
  marketplace: string; // US, CA, UK, DE, FR, IT, ES, AU

  @Column({ type: 'varchar', length: 7, name: 'year_month' })
  yearMonth: string; // YYYY-MM

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'total_spend' })
  totalSpend: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'total_sales' })
  totalSales: number;

  @Column({ type: 'integer', default: 0, name: 'total_units_sold' })
  totalUnitsSold: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
