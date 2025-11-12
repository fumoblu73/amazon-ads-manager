# Aggiornamento Background Worker per Render Free

## 🎯 Problema Identificato

Con 1000+ keyword, l'elaborazione richiede ~3-5 minuti, che supera il timeout HTTP di Render Free (30 secondi).

## ✅ Soluzione: Background Worker

L'endpoint risponde immediatamente, mentre le automazioni girano in background senza vincoli di timeout.

---

## 📝 File da Aggiornare

### 1. `src/routes/automation.ts` - COMPLETO

```typescript
import { Router, Request, Response } from 'express';
import { automationScheduler } from '../automation/scheduler';
import { EventEmitter } from 'events';

const router = Router();

// Event emitter per gestire automazioni in background
const automationQueue = new EventEmitter();

// Stato esecuzione corrente
let isRunning = false;
let lastExecution: {
  startedAt: Date | null;
  completedAt: Date | null;
  status: 'idle' | 'running' | 'completed' | 'failed';
  error: string | null;
} = {
  startedAt: null,
  completedAt: null,
  status: 'idle',
  error: null
};

// ================================================
// ENDPOINT TRIGGER AUTOMAZIONI (Chiamato da Cron-Job.org)
// ================================================
router.post('/trigger', async (req: Request, res: Response) => {
  // 1. Verifica secret per sicurezza
  const secret = req.query.secret || req.body.secret;
  const expectedSecret = process.env.AUTOMATION_SECRET || 'change-me-in-production';

  if (secret !== expectedSecret) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid secret'
    });
  }

  // 2. Controlla se c'è già un'esecuzione in corso
  if (isRunning) {
    return res.status(409).json({
      success: false,
      message: 'Automations already running',
      status: lastExecution
    });
  }

  // 3. RISPONDE SUBITO (evita timeout HTTP)
  res.json({
    success: true,
    message: 'Automations queued successfully',
    timestamp: new Date().toISOString(),
    note: 'Execution started in background. Check /api/automation/status for progress.'
  });

  // 4. Triggera esecuzione in background (non aspetta risposta)
  console.log('🚀 Triggering automations in background...');
  automationQueue.emit('run');
});

// ================================================
// WORKER IN BACKGROUND
// ================================================
automationQueue.on('run', async () => {
  // Marca come in esecuzione
  isRunning = true;
  lastExecution = {
    startedAt: new Date(),
    completedAt: null,
    status: 'running',
    error: null
  };

  console.log('════════════════════════════════════════');
  console.log('🤖 Background Worker: Starting automations');
  console.log(`⏰ Started at: ${lastExecution.startedAt.toISOString()}`);
  console.log('════════════════════════════════════════');

  try {
    // Esegue TUTTE le automazioni (può richiedere anche 10 minuti)
    await automationScheduler.runNow();

    // Marca come completato
    lastExecution.status = 'completed';
    lastExecution.completedAt = new Date();
    lastExecution.error = null;

    const duration = lastExecution.completedAt.getTime() - lastExecution.startedAt!.getTime();
    const durationMinutes = (duration / 1000 / 60).toFixed(2);

    console.log('════════════════════════════════════════');
    console.log('✅ Background Worker: Completed successfully');
    console.log(`⏱️  Duration: ${durationMinutes} minutes`);
    console.log(`⏰ Completed at: ${lastExecution.completedAt.toISOString()}`);
    console.log('════════════════════════════════════════');

  } catch (error) {
    // Gestisce errori
    lastExecution.status = 'failed';
    lastExecution.completedAt = new Date();
    lastExecution.error = error instanceof Error ? error.message : 'Unknown error';

    console.error('════════════════════════════════════════');
    console.error('❌ Background Worker: Failed');
    console.error(`⏰ Failed at: ${lastExecution.completedAt.toISOString()}`);
    console.error('Error:', error);
    console.error('════════════════════════════════════════');

  } finally {
    // Rilascia lock
    isRunning = false;
  }
});

// ================================================
// ENDPOINT STATUS (Controlla stato esecuzione)
// ================================================
router.get('/status', (req: Request, res: Response) => {
  const schedulerStatus = automationScheduler.getStatus();

  res.json({
    scheduler: schedulerStatus,
    lastExecution: {
      ...lastExecution,
      isRunning,
      duration: lastExecution.startedAt && lastExecution.completedAt
        ? `${((lastExecution.completedAt.getTime() - lastExecution.startedAt.getTime()) / 1000 / 60).toFixed(2)} minutes`
        : null
    },
    currentTime: new Date().toISOString()
  });
});

// ================================================
// ENDPOINT MANUAL TRIGGER (Per test manuali)
// ================================================
router.post('/trigger-manual', async (req: Request, res: Response) => {
  // Verifica autenticazione (può essere diverso dal secret cron)
  const authHeader = req.headers.authorization;

  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN || 'admin-token'}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (isRunning) {
    return res.status(409).json({
      error: 'Automations already running',
      status: lastExecution
    });
  }

  res.json({
    success: true,
    message: 'Manual execution started in background',
    timestamp: new Date().toISOString()
  });

  automationQueue.emit('run');
});

export default router;
```

---

### 2. `src/automation/scheduler.ts` - AGGIORNA

```typescript
import cron from 'node-cron';
import { runAutomationRules } from './rules';

class AutomationScheduler {
  private tasks: cron.ScheduledTask[] = [];
  private isRunning: boolean = false;

  start() {
    if (this.isRunning) {
      console.log('⚠️  Scheduler già avviato');
      return;
    }

    console.log('🤖 Avvio scheduler automazioni...');

    const intervalMinutes = parseInt(process.env.AUTOMATION_INTERVAL_MINUTES || '60');
    const cronExpression = `*/${intervalMinutes} * * * *`;

    console.log(`⏰ Automazioni programmate ogni ${intervalMinutes} minuti`);
    console.log('⚠️  NOTA: Su Render Free, usa cron-job.org invece dello scheduler interno');

    // Su Render, NON avviamo lo scheduler interno
    // Le automazioni vengono triggerate da cron-job.org
    this.isRunning = true;
    console.log('✅ Scheduler configurato (trigger esterno)');
  }

  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Scheduler già fermo');
      return;
    }

    console.log('🛑 Fermo scheduler automazioni...');
    this.tasks.forEach(task => task.stop());
    this.tasks = [];
    this.isRunning = false;
    console.log('✅ Scheduler fermato');
  }

  // Esegue manualmente le automazioni (chiamato dal background worker)
  async runNow() {
    console.log('🚀 Esecuzione manuale automazioni...');

    const startTime = Date.now();

    try {
      await runAutomationRules();

      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
      console.log(`✅ Esecuzione manuale completata in ${duration} minuti`);

    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
      console.error(`❌ Errore esecuzione manuale dopo ${duration} minuti:`, error);
      throw error;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTasks: this.tasks.length,
      intervalMinutes: process.env.AUTOMATION_INTERVAL_MINUTES || '60',
      triggerMethod: 'external' // Triggerate da cron-job.org
    };
  }
}

export const automationScheduler = new AutomationScheduler();
```

---

### 3. `.env` - AGGIUNGI VARIABILE

Aggiungi questa riga al file `.env` in Codespaces:

```env
# Token per trigger manuali (opzionale, per sicurezza)
ADMIN_TOKEN=your-secure-admin-token-here
```

E su **Render.com**, aggiungi anche questa variabile d'ambiente:
```
ADMIN_TOKEN=your-secure-admin-token-here
```

---

### 4. Aggiorna anche su Render

Una volta che committiamo il nuovo codice, Render farà automaticamente il deploy.

---

## 🧪 Come Testare

### Test 1: Endpoint Trigger (da Postman o browser)

```bash
POST https://amazon-ads-manager.onrender.com/api/automation/trigger?secret=33e744f625ef594000d06bc6f8eabe10a944c74ccbdaea5f945021bd7d665718

Risposta immediata (entro 1 secondo):
{
  "success": true,
  "message": "Automations queued successfully",
  "timestamp": "2025-11-10T15:30:00.000Z",
  "note": "Execution started in background..."
}
```

### Test 2: Controlla Status

```bash
GET https://amazon-ads-manager.onrender.com/api/automation/status

Risposta:
{
  "scheduler": {...},
  "lastExecution": {
    "startedAt": "2025-11-10T15:30:00.000Z",
    "completedAt": "2025-11-10T15:33:45.000Z",
    "status": "completed",
    "isRunning": false,
    "duration": "3.75 minutes"
  }
}
```

### Test 3: Verifica Log su Render

Vai su Render Dashboard → Logs e dovresti vedere:

```
════════════════════════════════════════
🤖 Background Worker: Starting automations
⏰ Started at: 2025-11-10T15:30:00.000Z
════════════════════════════════════════
🚀 Esecuzione regole di automazione
📋 Esecuzione regola: Riduci bid ACoS alto
...
✅ Background Worker: Completed successfully
⏱️  Duration: 3.75 minutes
════════════════════════════════════════
```

---

## ✅ Vantaggi di questo Approccio

1. ✅ **Nessun timeout HTTP** - Risposta immediata
2. ✅ **Elaborazione completa** - Anche con 1000+ keyword
3. ✅ **Render Free OK** - Completamente gratuito
4. ✅ **Monitoring** - Endpoint `/status` per controllare progresso
5. ✅ **Log dettagliati** - Vedi tutto nei log di Render
6. ✅ **Affidabile** - Se fallisce, vedi l'errore nello status

---

## 📋 Prossimi Step

1. **In Codespaces**: Aggiorna i file `automation.ts` e `scheduler.ts`
2. **Testa localmente**: `npm run dev`
3. **Committa su GitHub**: `git add . && git commit -m "Add background worker" && git push`
4. **Render fa deploy automatico** (2-3 minuti)
5. **Testa endpoint** con Postman
6. **Configura Cron-Job.org** quando pronto

---

## 🎯 Tempo di Esecuzione Atteso

Con 1000 keyword:
- **Funzione 1**: ~65 secondi
- **Funzione 2**: ~3 secondi
- **Funzione 3**: ~81 secondi (la più pesante)
- **Funzione 4**: ~29 secondi
- **Funzione 5**: ~40 secondi

**TOTALE: ~3-4 minuti** ✅ (perfettamente gestibile in background)

---

## 📊 Scalabilità

Questo approccio scala fino a:
- ✅ 5,000 keyword (tempo: ~10-15 minuti)
- ✅ 10+ campagne attive
- ✅ Esecuzioni multiple al giorno

**Limite pratico Render Free: ~20 minuti per esecuzione**
(dopo diventa inefficiente, meglio Railway)

---

*Salva questo file come riferimento per l'implementazione!*
