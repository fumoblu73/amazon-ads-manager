import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { AutomationLog } from '../models/AutomationLog';
import { KeywordPerformance } from '../models/KeywordPerformance';
import { Campaign } from '../models/Campaign';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'amazon_ads_manager',
  synchronize: true, // Auto-crea le tabelle (solo sviluppo!)
  logging: process.env.NODE_ENV === 'development',
  entities: [AutomationLog, KeywordPerformance, Campaign],
  migrations: ['src/migrations/**/*.ts'],
});

export const initializeDatabase = async () => {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connesso con successo!');
  } catch (error) {
    console.error('❌ Errore connessione database:', error);
    process.exit(1);
  }
};
