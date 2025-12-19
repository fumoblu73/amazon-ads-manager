// ================================================
// SCHEDULER PER AUTOMAZIONI
// ================================================
// Sistema di scheduling interno basato su node-cron
// Gestisce l'esecuzione automatica delle 5 funzioni di automazione
// con orari specifici configurabili

import cron from 'node-cron';
import { runAutomationRules, runAutomationRulesForUser } from './rules';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { IsNull, Not } from 'typeorm';

// Interfaccia per configurazione scheduling
interface ScheduleConfig {
  // Funzioni 1+3: Lunedì/Mercoledì/Venerdì alle 10:30 IT (09:30 UTC)
  func1and3_schedule: string;
  func1and3_enabled: boolean;

  // Funzioni 2+4+5: Lunedì alle 11:30 IT (10:30 UTC)
  func2and4and5_schedule: string;
  func2and4and5_enabled: boolean;
}

// Classe che gestisce lo scheduler delle automazioni
class AutomationScheduler {
  private tasks: cron.ScheduledTask[] = [];
  private isRunning: boolean = false;
  private lastExecutionTimes: Map<string, Date> = new Map();

  // Configurazione di default
  private config: ScheduleConfig = {
    // Lunedì/Mercoledì/Venerdì alle 09:30 UTC (10:30 ora italiana)
    func1and3_schedule: '30 9 * * 1,3,5',
    func1and3_enabled: true,

    // Lunedì alle 10:30 UTC (11:30 ora italiana)
    func2and4and5_schedule: '30 10 * * 1',
    func2and4and5_enabled: true
  };

  /**
   * Avvia lo scheduler interno con cron jobs
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Scheduler già avviato');
      return;
    }

    console.log('🤖 Avvio scheduler automazioni interno...');
    console.log('📅 Configurazione orari:');
    console.log(`   - Funzioni 1+3: ${this.config.func1and3_schedule} (Lun/Mer/Ven 10:30 IT)`);
    console.log(`   - Funzioni 2+4+5: ${this.config.func2and4and5_schedule} (Lunedì 11:30 IT)`);

    // Cron job per Funzioni 1+3
    if (this.config.func1and3_enabled) {
      const task1and3 = cron.schedule(this.config.func1and3_schedule, async () => {
        console.log('⏰ Trigger automatico: Funzioni 1+3');
        await this.runFunctions([1, 3]);
      }, {
        timezone: 'UTC'
      });

      this.tasks.push(task1and3);
      console.log('✅ Cron job Funzioni 1+3 attivato');
    }

    // Cron job per Funzioni 2+4+5
    if (this.config.func2and4and5_enabled) {
      const task2and4and5 = cron.schedule(this.config.func2and4and5_schedule, async () => {
        console.log('⏰ Trigger automatico: Funzioni 2+4+5');
        await this.runFunctions([2, 4, 5]);
      }, {
        timezone: 'UTC'
      });

      this.tasks.push(task2and4and5);
      console.log('✅ Cron job Funzioni 2+4+5 attivato');
    }

    this.isRunning = true;
    console.log('✅ Scheduler interno avviato con successo');
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

  /**
   * Esegue funzioni specifiche
   * @param functionNumbers - Array di numeri funzione da eseguire (es: [1, 3])
   */
  private async runFunctions(functionNumbers: number[]) {
    console.log(`🚀 Esecuzione funzioni: ${functionNumbers.join(', ')}`);
    const startTime = Date.now();

    try {
      // TODO: Implementare logica per eseguire solo funzioni specificate
      // Per ora esegue tutte le regole (da modificare in rules.ts)
      await runAutomationRules();

      // Marca funzioni come eseguite
      functionNumbers.forEach(num => {
        this.markFunctionExecuted(`func${num}`);
      });

      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
      console.log(`✅ Funzioni ${functionNumbers.join(', ')} completate in ${duration} minuti`);

    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
      console.error(`❌ Errore esecuzione funzioni dopo ${duration} minuti:`, error);
      throw error;
    }
  }

  /**
   * Esegue tutte le automazioni per tutti gli users (chiamato da trigger manuale)
   */
  async runNow() {
    console.log('🚀 Esecuzione manuale automazioni per TUTTI gli users...');
    const startTime = Date.now();

    try {
      // Get all active users with Amazon OAuth
      const userRepo = AppDataSource.getRepository(User);
      const users = await userRepo.find({
        where: {
          isActive: true,
          amazonUserId: Not(IsNull())
        }
      });

      console.log(`👥 Found ${users.length} active users with Amazon authentication`);

      if (users.length === 0) {
        console.log('⚠️  No active users with Amazon auth. Nothing to do.');
        return;
      }

      // Run automations for each user sequentially
      let successCount = 0;
      let errorCount = 0;

      for (const user of users) {
        try {
          console.log(`\n${'='.repeat(80)}`);
          console.log(`Processing user: ${user.email} (${user.id})`);
          console.log('='.repeat(80));

          await runAutomationRulesForUser(user.id);
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`❌ Failed to run automations for user ${user.email}:`, error);
          // Continue with other users even if one fails
        }
      }

      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
      console.log(`\n${'='.repeat(80)}`);
      console.log(`✅ GLOBAL AUTOMATION SUMMARY`);
      console.log(`   Total users: ${users.length}`);
      console.log(`   Success: ${successCount}`);
      console.log(`   Errors: ${errorCount}`);
      console.log(`   Duration: ${duration} minutes`);
      console.log('='.repeat(80));

    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
      console.error(`❌ Fatal error during automation execution after ${duration} minutes:`, error);
      throw error;
    }
  }

  /**
   * Aggiorna la configurazione dello scheduler
   * Permette di modificare orari e abilitazione senza riavviare il server
   */
  updateConfig(newConfig: Partial<ScheduleConfig>) {
    console.log('🔧 Aggiornamento configurazione scheduler...');

    // Se lo scheduler è attivo, fermalo prima di aggiornare
    const wasRunning = this.isRunning;
    if (wasRunning) {
      this.stop();
    }

    // Aggiorna configurazione
    this.config = { ...this.config, ...newConfig };

    // Riavvia se era attivo
    if (wasRunning) {
      this.start();
    }

    console.log('✅ Configurazione aggiornata');
  }

  /**
   * Restituisce la configurazione corrente
   */
  getConfig(): ScheduleConfig {
    return { ...this.config };
  }

  /**
   * Determina se una funzione deve essere eseguita oggi
   * in base alla sua frequency e all'ultima esecuzione
   *
   * @param functionName - Nome funzione (es: 'func1', 'func2')
   * @param frequency - Frequenza in giorni
   * @param campaignCreatedAt - Data creazione campagna
   * @returns true se la funzione deve essere eseguita
   */
  shouldExecuteFunction(
    functionName: string,
    frequency: number,
    campaignCreatedAt: Date
  ): boolean {
    // 1. Controlla periodo di warmup (7 giorni)
    const daysSinceCreation = this.getDaysSinceCreation(campaignCreatedAt);
    if (daysSinceCreation < 7) {
      return false;
    }

    // 2. Controlla ultima esecuzione
    const lastExecution = this.lastExecutionTimes.get(functionName);

    if (!lastExecution) {
      // Prima esecuzione
      return true;
    }

    const daysSinceLastExecution = this.getDaysSince(lastExecution);
    return daysSinceLastExecution >= frequency;
  }

  /**
   * Segna una funzione come eseguita
   */
  markFunctionExecuted(functionName: string): void {
    this.lastExecutionTimes.set(functionName, new Date());
  }

  /**
   * Calcola giorni dalla creazione della campagna
   */
  private getDaysSinceCreation(campaignCreatedAt: Date): number {
    const now = new Date();
    const diff = now.getTime() - campaignCreatedAt.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Calcola giorni da una data specifica
   */
  private getDaysSince(date: Date): number {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Ritorna lo stato dello scheduler
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTasks: this.tasks.length,
      triggerMethod: 'internal', // Scheduler interno con node-cron
      config: this.config,
      lastExecutionTimes: Object.fromEntries(this.lastExecutionTimes),
      nextScheduledRuns: {
        func1and3: this.config.func1and3_schedule + ' (Lun/Mer/Ven 10:30 IT)',
        func2and4and5: this.config.func2and4and5_schedule + ' (Lunedì 11:30 IT)'
      }
    };
  }

  /**
   * Reset dello stato (utile per testing)
   */
  reset(): void {
    this.lastExecutionTimes.clear();
  }
}

// Esporta un'istanza unica dello scheduler
export const automationScheduler = new AutomationScheduler();
