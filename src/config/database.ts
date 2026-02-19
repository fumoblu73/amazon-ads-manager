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
    BookSpendCache
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
    } catch (e) {
      // Ignore if column already exists or table doesn't exist yet
    }
  } catch (error) {
    console.error('❌ Errore connessione database:', error);
    process.exit(1);
  }
};
