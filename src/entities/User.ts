import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { KdpBook } from './KdpBook';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash', nullable: true })
  passwordHash: string | null;

  // Amazon OAuth fields
  @Column({ type: 'varchar', length: 100, name: 'amazon_user_id', unique: true, nullable: true })
  amazonUserId: string | null;

  @Column({ type: 'text', name: 'access_token', nullable: true })
  accessToken: string | null;

  @Column({ type: 'text', name: 'refresh_token', nullable: true })
  refreshToken: string | null;

  @Column({ type: 'bigint', name: 'profile_id', nullable: true })
  profileId: number | null;

  @Column({ type: 'varchar', length: 10, name: 'country_code', nullable: true })
  countryCode: string | null;

  @Column({ type: 'varchar', length: 10, name: 'currency_code', nullable: true })
  currencyCode: string | null;

  @Column({ type: 'timestamp', name: 'token_expires_at', nullable: true })
  tokenExpiresAt: Date | null;

  @Column({ type: 'timestamp', name: 'last_login_at', nullable: true })
  lastLoginAt: Date | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  // KDP Cookie-based sync fields
  @Column({ type: 'text', name: 'kdp_cookies_encrypted', nullable: true })
  kdpCookiesEncrypted: string | null; // JSON criptato dei cookie KDP

  @Column({ type: 'text', name: 'kdp_reports_cookies_encrypted', nullable: true })
  kdpReportsCookiesEncrypted: string | null; // JSON criptato dei cookie kdpreports.amazon.com

  @Column({ type: 'varchar', length: 50, name: 'kdp_marketplace', nullable: true })
  kdpMarketplace: string | null; // US, UK, DE, FR, ES, IT, etc.

  @Column({ type: 'timestamp', name: 'kdp_cookies_updated_at', nullable: true })
  kdpCookiesUpdatedAt: Date | null;

  @Column({ type: 'timestamp', name: 'kdp_last_sync_at', nullable: true })
  kdpLastSyncAt: Date | null;

  @Column({ type: 'boolean', name: 'kdp_sync_enabled', default: false })
  kdpSyncEnabled: boolean;

  @Column({ type: 'timestamp', name: 'campaign_last_sync_at', nullable: true })
  campaignLastSyncAt: Date | null;

  // Spend cache (aggiornata dallo scheduler, letta dalla dashboard)
  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'spend_cache_7d', nullable: true })
  spendCache7d: number | null; // spesa totale ultimi 7 giorni (USD)

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'sales_cache_7d', nullable: true })
  salesCache7d: number | null; // vendite totali ultimi 7 giorni (USD)

  @Column({ type: 'timestamp', name: 'spend_cache_updated_at', nullable: true })
  spendCacheUpdatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => KdpBook, (book) => book.user)
  kdpBooks: KdpBook[];
}
