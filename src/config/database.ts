import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { AutomationLog } from '../models/AutomationLog';
import { KeywordPerformance } from '../models/KeywordPerformance';
import { Campaign } from '../models/Campaign';
import { Book } from '../models/Book';
import { KdpBook } from '../models/KdpBook';
import { KdpDailyStats } from '../models/KdpDailyStats';
import { JournalEvent } from '../models/JournalEvent';
import { KdpSyncLog } from '../models/KdpSyncLog';
import { User } from '../models/User';

dotenv.config();

// Supporta sia DATABASE_URL (Supabase/Render) che variabili separate (locale)
const getDatabaseConfig = () => {
  if (process.env.DATABASE_URL) {
    return {
      type: 'postgres' as const,
      url: process.env.DATABASE_URL,
      synchronize: true, // Temporaneamente true per aggiornare schema
      logging: process.env.NODE_ENV === 'development',
      entities: [User, AutomationLog, KeywordPerformance, Campaign, Book, KdpBook, KdpDailyStats, JournalEvent, KdpSyncLog],
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
    synchronize: true, // Auto-crea le tabelle (solo sviluppo!)
    logging: process.env.NODE_ENV === 'development',
    entities: [User, AutomationLog, KeywordPerformance, Campaign, Book, KdpBook, KdpDailyStats, JournalEvent, KdpSyncLog],
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
