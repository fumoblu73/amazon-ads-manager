import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { AutomationLog } from '../models/AutomationLog';
import { KeywordPerformance } from '../models/KeywordPerformance';
import { Campaign } from '../models/Campaign';
import { Book } from '../models/Book';
import { AutomationConfigEntity } from '../models/AutomationConfigEntity';

dotenv.config();

// Supporta sia DATABASE_URL (Supabase/Render) che variabili separate (locale)
const getDatabaseConfig = () => {
  if (process.env.DATABASE_URL) {
    return {
      type: 'postgres' as const,
      url: process.env.DATABASE_URL,
      synchronize: false, // Non auto-sincronizzare in produzione
      logging: process.env.NODE_ENV === 'development',
      entities: [AutomationLog, KeywordPerformance, Campaign, Book, AutomationConfigEntity],
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
    entities: [AutomationLog, KeywordPerformance, Campaign, Book, AutomationConfigEntity],
    migrations: ['src/migrations/**/*.ts'],
  };
};

export const AppDataSource = new DataSource(getDatabaseConfig());

export const initializeDatabase = async (maxRetries = 3): Promise<void> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
        console.log('✅ Database connesso con successo!');
        return;
      }
    } catch (error) {
      console.error(`❌ Tentativo ${attempt}/${maxRetries} di connessione database fallito:`, error);

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`⏳ Nuovo tentativo tra ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('❌ Impossibile connettersi al database dopo', maxRetries, 'tentativi');
        throw error;
      }
    }
  }
};
