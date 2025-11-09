// ================================================
// CONFIGURAZIONE DATABASE
// ================================================
// Questo file configura la connessione al database PostgreSQL
// usando TypeORM (Object Relational Mapper)

import { DataSource } from 'typeorm';
import dotenv from 'dotenv';

// Carica variabili d'ambiente
dotenv.config();

// Configurazione della connessione al database
export const AppDataSource = new DataSource({
  // Tipo di database (PostgreSQL)
  type: 'postgres',

  // Indirizzo del server database
  host: process.env.DB_HOST || 'localhost',

  // Porta PostgreSQL (default 5432)
  port: parseInt(process.env.DB_PORT || '5432'),

  // Username per accedere al database
  username: process.env.DB_USERNAME || 'postgres',

  // Password del database
  password: process.env.DB_PASSWORD || '',

  // Nome del database
  database: process.env.DB_DATABASE || 'amazon_ads_manager',

  // Sincronizza automaticamente le tabelle (SOLO in sviluppo!)
  // In produzione usare le "migrations"
  synchronize: true,

  // Mostra le query SQL nel log (utile per debug)
  logging: process.env.NODE_ENV === 'development',

  // Array delle entità (tabelle) del database
  // Le aggiungeremo dopo
  entities: [
    // 'src/models/**/*.ts' // Percorso ai file delle entità
  ],

  // Cartella delle migrations (aggiornamenti struttura database)
  migrations: ['src/migrations/**/*.ts'],
});

// Funzione per inizializzare la connessione al database
export const initializeDatabase = async () => {
  try {
    // Tenta di connettersi al database
    await AppDataSource.initialize();
    console.log('✅ Database connesso con successo!');
  } catch (error) {
    console.error('❌ Errore connessione database:', error);
    // In caso di errore, termina l'applicazione
    process.exit(1);
  }
};
