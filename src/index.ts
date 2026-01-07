import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import automationRoutes from './routes/automation';
import booksRoutes from './routes/books';
import campaignsRoutes from './routes/campaigns';
import logsRoutes from './routes/logs';
import kdpBooksRoutes from './routes/kdp-books';
import kdpAnalyticsRoutes from './routes/kdp-analytics';
import kdpBsrRoutes from './routes/kdp-bsr';
import kdpJournalEventsRoutes from './routes/kdp-journal-events';
import kdpSyncRoutes from './routes/kdp-sync';
import authRoutes from './routes/auth';
import settingsRoutes from './routes/settings';
import migrateRoutes from './routes/migrate.routes';
import { initializeDatabase } from './config/database';
import { kdpSyncScheduler } from './services/kdp-sync-scheduler';
import { automationScheduler } from './automation/scheduler';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

app.use(express.json());
app.use(cookieParser());

// API info endpoint (only in development, in production we serve the frontend)
if (process.env.NODE_ENV !== 'production') {
  app.get('/', (req, res) => {
    res.json({
      message: 'Amazon Ads Manager API',
      version: '2.0.0',
      endpoints: {
        health: '/health',
        automation_trigger: '/api/automation/trigger?secret=YOUR_SECRET (POST)',
        automation_status: '/api/automation/status',
        books: '/api/books',
        campaigns: '/api/campaigns',
        logs: '/api/logs',
        kdp_books: '/api/kdp/books',
        kdp_dashboard: '/api/kdp/dashboard/summary',
        kdp_analytics: '/api/kdp/analytics/*',
        kdp_bsr: '/api/kdp/bsr',
        kdp_journal: '/api/kdp/journal-events'
      }
    });
  });
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Amazon Ads Manager is running',
    timestamp: new Date().toISOString()
  });
});

// Auth Routes
app.use('/api/auth', authRoutes);

// Migration endpoint (protected by MIGRATION_SECRET)
app.use('/api', migrateRoutes);

app.use('/api/automation', automationRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/settings', settingsRoutes);

// KDP Analytics Routes
app.use('/api/kdp/books', kdpBooksRoutes);
app.use('/api/kdp', kdpAnalyticsRoutes);
app.use('/api/kdp/bsr', kdpBsrRoutes);
app.use('/api/kdp/journal-events', kdpJournalEventsRoutes);
app.use('/api/kdp-sync', kdpSyncRoutes);

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendPath));

  // Handle client-side routing - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Inizializza database, scheduler e poi avvia server
const startServer = async () => {
  try {
    // Connetti al database
    await initializeDatabase();

    // Avvia KDP sync scheduler (every 6 hours)
    kdpSyncScheduler.start();

    // Avvia automation scheduler
    automationScheduler.start();

    // Avvia server
    app.listen(PORT, '0.0.0.0', () => {
      console.log('='.repeat(50));
      console.log(`🚀 Server avviato sulla porta ${PORT}`);
      console.log('='.repeat(50));
      console.log('✅ OAuth and KDP Analytics active');
      console.log('✅ KDP Sync scheduler active (runs every 6 hours)');
      console.log('✅ Automation engine active (Func 1+3: Lun/Mer/Ven 10:30 IT, Func 2+4+5: Lun 11:30 IT)');
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
