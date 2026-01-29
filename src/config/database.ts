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
    PendingReport
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
  } catch (error) {
    console.error('❌ Errore connessione database:', error);
    process.exit(1);
  }
};
