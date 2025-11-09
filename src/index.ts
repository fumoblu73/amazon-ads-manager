// ================================================
// FILE PRINCIPALE DELL'APPLICAZIONE
// ================================================
// Questo è il punto di partenza del backend.
// Qui configuriamo e avviamo il server Express.

import express from 'express';
import dotenv from 'dotenv';
import { automationScheduler } from './automation/scheduler';

// Carica le variabili d'ambiente dal file .env
// Questo permette di tenere segreti password e chiavi API
dotenv.config();

// Crea l'applicazione Express (il nostro server web)
const app = express();

// Porta su cui il server ascolterà (default 3000)
const PORT = process.env.PORT || 3000;

// ================================================
// MIDDLEWARE
// ================================================
// I middleware sono funzioni che elaborano le richieste
// prima che arrivino alle rotte

// Permette di leggere JSON nel body delle richieste
app.use(express.json());

// ================================================
// ROTTE (ENDPOINTS) - Da implementare
// ================================================
// Le rotte definiscono cosa succede quando chiami un URL

// Rotta di test per verificare che il server funziona
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Amazon Ads Manager is running',
    timestamp: new Date().toISOString()
  });
});

// Rotta principale
app.get('/', (req, res) => {
  res.json({
    message: 'Amazon Ads Manager API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      campaigns: '/api/campaigns (coming soon)',
      keywords: '/api/keywords (coming soon)',
      automation: '/api/automation (coming soon)'
    }
  });
});

// ================================================
// AVVIO SERVER
// ================================================
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Server avviato sulla porta ${PORT}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log('='.repeat(50));

  // Avvia le automazioni solo se abilitate nel .env
  if (process.env.ENABLE_AUTOMATIONS === 'true') {
    console.log('🤖 Automazioni abilitate - Scheduler avviato');
    automationScheduler.start();
  } else {
    console.log('⏸️  Automazioni disabilitate (imposta ENABLE_AUTOMATIONS=true nel .env)');
  }
});

// Gestione errori non catturati
process.on('unhandledRejection', (error) => {
  console.error('❌ Errore non gestito:', error);
});
