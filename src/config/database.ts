import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
// Import entities from models/ (legacy - keep for backward compatibility)
import { AutomationLog } from '../models/AutomationLog';
import { KeywordPerformance } from '../models/KeywordPerformance';
import { Campaign } from '../models/Campaign';
import { Book } from '../models/Book';
// Import entities from entities/ (newer structure with relations)
import { User } from '../entities/User';
import { KdpBook } from '../entities/KdpBook';
import { KdpDailyStats } from '../entities/KdpDailyStats';
import { JournalEvent } from '../entities/JournalEvent';
import { KdpSyncLog } from '../entities/KdpSyncLog';
import { AutomationSettings } from '../entities/AutomationSettings';
import { KdpSalesSnapshot } from '../entities/KdpSalesSnapshot';
import { PendingReport } from '../entities/PendingReport';
import { KdpUserStats } from '../models/KdpDailyStats';
import { BookSpendCache } from '../entities/BookSpendCache';
import { MonthlyAdsSpend } from '../entities/MonthlyAdsSpend';
import { KdpSyncLog as KdpSyncLogModel } from '../models/KdpSyncLog';

dotenv.config();

// Supporta sia DATABASE_URL (Supabase/Render) che variabili separate (locale)
const getDatabaseConfig = () => {
  // IMPORTANTE: Non usare duplicate entities - causa conflitti di schema!
  // Usare SOLO entities/ per le nuove tabelle KDP
  const entities = [
    User,
    AutomationLog,
    KeywordPerformance,
    Campaign,
    Book,
    KdpBook,
    KdpDailyStats,
    JournalEvent,
    KdpSyncLog,
    AutomationSettings,
    KdpSalesSnapshot,
    PendingReport,
    KdpUserStats,
    BookSpendCache,
    MonthlyAdsSpend,
    KdpSyncLogModel
  ];

  if (process.env.DATABASE_URL) {
    return {
      type: 'postgres' as const,
      url: process.env.DATABASE_URL,
      synchronize: false, // DISABILITATO in produzione - usare migrations!
      logging: process.env.NODE_ENV === 'development',
      entities,
      migrations: ['src/migrations/**/*.ts'],
      ssl: {
        rejectUnauthorized: false // Necessario per Supabase
      }
    };
  }

  return {
    type: 'postgres' as const,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'amazon_ads_manager',
    synchronize: process.env.NODE_ENV === 'development',
    logging: process.env.NODE_ENV === 'development',
    entities,
    migrations: ['src/migrations/**/*.ts'],
  };
};

export const AppDataSource = new DataSource(getDatabaseConfig());

export const initializeDatabase = async () => {
  // Skip database connection if USE_MOCK_DATA is enabled
  if (process.env.USE_MOCK_DATA === 'true') {
    console.log('⚠️  Database connection skipped (USE_MOCK_DATA=true)');
    console.log('📊 Using mock data for all endpoints');
    return;
  }

  try {
    await AppDataSource.initialize();
    console.log('✅ Database connesso con successo!');

    // Auto-apply pending column additions (safe, idempotent)
    try {
      await AppDataSource.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS campaign_last_sync_at TIMESTAMP`);
      await AppDataSource.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS spend_cache_7d DECIMAL(10,2)`);
      await AppDataSource.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS sales_cache_7d DECIMAL(10,2)`);
      await AppDataSource.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS spend_cache_updated_at TIMESTAMP`);

      // automation_logs: book identification fields (added v2.3.8)
      await AppDataSource.query(`ALTER TABLE automation_logs ADD COLUMN IF NOT EXISTS book_asin VARCHAR(20)`);
      await AppDataSource.query(`ALTER TABLE automation_logs ADD COLUMN IF NOT EXISTS book_title VARCHAR(255)`);

      // automation_settings: VAT fields (added v2.4.4)
      await AppDataSource.query(`ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS use_vat_in_fast_acos BOOLEAN DEFAULT true`);
      await AppDataSource.query(`ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS vat_percentage DECIMAL(5,2) DEFAULT 22`);

      // book_spend_cache table
      await AppDataSource.query(`
        CREATE TABLE IF NOT EXISTS book_spend_cache (
          id          SERIAL PRIMARY KEY,
          user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          marketplace VARCHAR(10) NOT NULL,
          asin        VARCHAR(20) NOT NULL,
          ad_type     VARCHAR(10) NOT NULL,
          spend_7d    DECIMAL(10,2),
          sales_7d    DECIMAL(10,2),
          impressions_7d INTEGER,
          clicks_7d   INTEGER,
          updated_at  TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_id, marketplace, asin, ad_type)
        )
      `);
      await AppDataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_book_spend_cache_user_asin
        ON book_spend_cache(user_id, asin)
      `);

      // kdp_sync_logs table (used by kdp-scraper.service and kdp-reports-scraper.service)
      await AppDataSource.query(`
        CREATE TABLE IF NOT EXISTS kdp_sync_logs (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "userId"        VARCHAR(255),
          "syncType"      VARCHAR(50) NOT NULL,
          status          VARCHAR(50) NOT NULL DEFAULT 'pending',
          "startedAt"     TIMESTAMP,
          "completedAt"   TIMESTAMP,
          "recordsProcessed" INT NOT NULL DEFAULT 0,
          "recordsCreated"   INT NOT NULL DEFAULT 0,
          "recordsUpdated"   INT NOT NULL DEFAULT 0,
          "recordsFailed"    INT NOT NULL DEFAULT 0,
          "errorMessage"  TEXT,
          metadata        TEXT,
          "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await AppDataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_kdp_sync_logs_user_type
        ON kdp_sync_logs("userId", "syncType", "createdAt")
      `);
    } catch (e) {
      // Ignore if column already exists or table doesn't exist yet
    }

    // monthly_ads_spend table (added v2.3.9)
    try {
      await AppDataSource.query(`
        CREATE TABLE IF NOT EXISTS monthly_ads_spend (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL,
          marketplace VARCHAR(10) NOT NULL,
          year_month VARCHAR(7) NOT NULL,
          total_spend DECIMAL(10,2) NOT NULL DEFAULT 0,
          total_sales DECIMAL(10,2) NOT NULL DEFAULT 0,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE(user_id, marketplace, year_month)
        )
      `);
      await AppDataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_monthly_ads_spend_user
        ON monthly_ads_spend(user_id, marketplace, year_month)
      `);
    } catch (e) {
      // Table already exists
    }
  } catch (error) {
    console.error('❌ Errore connessione database:', error);
    process.exit(1);
  }
};
