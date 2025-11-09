// ================================================
// SCHEDULER PER AUTOMAZIONI
// ================================================
// Questo file gestisce l'esecuzione automatica e programmata
// delle regole di ottimizzazione delle campagne

import cron from 'node-cron';
import { runAutomationRules } from './rules';

// Classe che gestisce lo scheduler delle automazioni
class AutomationScheduler {
  private tasks: cron.ScheduledTask[] = [];  // Array dei task schedulati
  private isRunning: boolean = false;        // Flag per sapere se è attivo

  // Avvia lo scheduler
  start() {
    if (this.isRunning) {
      console.log('⚠️  Scheduler già avviato');
      return;
    }

    console.log('🤖 Avvio scheduler automazioni...');

    // Legge l'intervallo dalle variabili d'ambiente (default: ogni ora)
    const intervalMinutes = parseInt(process.env.AUTOMATION_INTERVAL_MINUTES || '60');

    // Cron expression per eseguire ogni X minuti
    // Formato: minuto ora giorno mese giornoSettimana
    const cronExpression = `*/${intervalMinutes} * * * *`;

    console.log(`⏰ Automazioni programmate ogni ${intervalMinutes} minuti`);

    // Crea un task schedulato
    const task = cron.schedule(cronExpression, async () => {
      console.log('\n' + '='.repeat(50));
      console.log(`🤖 Esecuzione automazioni - ${new Date().toLocaleString()}`);
      console.log('='.repeat(50));

      try {
        // Esegue tutte le regole di automazione
        await runAutomationRules();

        console.log('✅ Automazioni completate con successo');
      } catch (error) {
        console.error('❌ Errore durante esecuzione automazioni:', error);
      }

      console.log('='.repeat(50) + '\n');
    });

    // Salva il task nell'array
    this.tasks.push(task);
    this.isRunning = true;

    console.log('✅ Scheduler avviato con successo');
  }

  // Ferma lo scheduler
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Scheduler già fermo');
      return;
    }

    console.log('🛑 Fermo scheduler automazioni...');

    // Ferma tutti i task
    this.tasks.forEach(task => task.stop());
    this.tasks = [];
    this.isRunning = false;

    console.log('✅ Scheduler fermato');
  }

  // Esegue manualmente le automazioni (senza aspettare lo schedule)
  async runNow() {
    console.log('🚀 Esecuzione manuale automazioni...');
    try {
      await runAutomationRules();
      console.log('✅ Esecuzione manuale completata');
    } catch (error) {
      console.error('❌ Errore esecuzione manuale:', error);
      throw error;
    }
  }

  // Ritorna lo stato dello scheduler
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTasks: this.tasks.length,
      intervalMinutes: process.env.AUTOMATION_INTERVAL_MINUTES || '60'
    };
  }
}

// Esporta un'istanza unica dello scheduler
export const automationScheduler = new AutomationScheduler();
