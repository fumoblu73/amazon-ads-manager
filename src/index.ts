import express from 'express';
import dotenv from 'dotenv';
import automationRoutes from './routes/automation';
import booksRoutes from './routes/books';
import campaignsRoutes from './routes/campaigns';
import logsRoutes from './routes/logs';
import { initializeDatabase } from './config/database';
import { automationScheduler } from './automation/scheduler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Amazon Ads Manager API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      automation_trigger: '/api/automation/trigger?secret=YOUR_SECRET (POST)',
      automation_status: '/api/automation/status',
      books: '/api/books',
      campaigns: '/api/campaigns',
      logs: '/api/logs'
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

app.use('/api/automation', automationRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/logs', logsRoutes);

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
