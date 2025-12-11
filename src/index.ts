import express from 'express';
import dotenv from 'dotenv';
import automationRoutes from './routes/automation';
import automationConfigRoutes from './routes/automationConfig';
import booksRoutes from './routes/books';
import campaignsRoutes from './routes/campaigns';
import logsRoutes from './routes/logs';
import authRoutes from './routes/auth';
import kdpBooksRoutes from './routes/kdp/books';
import kdpSyncRoutes from './routes/kdp/sync';
import kdpAnalyticsRoutes from './routes/kdp/analytics';
import kdpBsrRoutes from './routes/kdp/bsr';
import kdpJournalEventsRoutes from './routes/kdp/journalEvents';
import kdpTestDataRoutes from './routes/kdp/testData';
import { initializeDatabase } from './config/database';
import { automationScheduler } from './automation/scheduler';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Amazon Ads Manager API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      health_db: '/health/db (database keep-alive)',
      automation_trigger: '/api/automation/trigger?secret=YOUR_SECRET (POST)',
      automation_status: '/api/automation/status',
      automation_config: '/api/automation-config',
      books: '/api/books',
      campaigns: '/api/campaigns',
      logs: '/api/logs',
      auth: '/api/auth (register, login, me)',
      kdp_books: '/api/kdp/books',
      kdp_sync: '/api/kdp/sync',
      kdp_analytics: '/api/kdp/analytics (book/:id, overview, comparison)',
      kdp_bsr: '/api/kdp/bsr (/:id, /:id/trend, /comparison/books, /:id/alert)',
      kdp_journal: '/api/kdp/journal-events (CRUD, /book/:id/timeline, /meta/categories)'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Amazon Ads Manager is running',
    timestamp: new Date().toISOString()
  });
});

// Health check con query database (per keep-alive Supabase)
app.get('/health/db', async (req, res) => {
  try {
    const { AppDataSource } = await import('./config/database');

    // Query leggera per verificare che il database sia attivo
    await AppDataSource.query('SELECT 1');

    res.json({
      status: 'OK',
      database: 'connected',
      timestamp: new Date().toISOString(),
      message: 'Database is active and responding'
    });
  } catch (error) {
    console.error('❌ Health check database failed:', error);
    res.status(503).json({
      status: 'ERROR',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

app.use('/api/automation', automationRoutes);
app.use('/api/automation-config', automationConfigRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/kdp/books', kdpBooksRoutes);
app.use('/api/kdp/sync', kdpSyncRoutes);
app.use('/api/kdp/analytics', kdpAnalyticsRoutes);
app.use('/api/kdp/bsr', kdpBsrRoutes);
app.use('/api/kdp/journal-events', kdpJournalEventsRoutes);
app.use('/api/kdp/test-data', kdpTestDataRoutes);

// Inizializza database, scheduler e poi avvia server
const startServer = async () => {
  try {
    // Connetti al database
    await initializeDatabase();

    // Avvia scheduler interno
    automationScheduler.start();

    // Avvia server
    app.listen(PORT, '0.0.0.0', () => {
      console.log('='.repeat(50));
      console.log(`🚀 Server avviato sulla porta ${PORT}`);
      console.log('='.repeat(50));
      console.log('⏰ Scheduler automazioni interno attivo');
      console.log('📋 Usa /api/automation/status per vedere lo stato');
    });
  } catch (error) {
    console.error('❌ Errore avvio server:', error);
    process.exit(1);
  }
};

startServer();

process.on('unhandledRejection', (error) => {
  console.error('❌ Errore non gestito:', error);
});
