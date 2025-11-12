// ================================================
// SCHEDULER PER AUTOMAZIONI
// ================================================
// Gestisce l'esecuzione coordinata delle 5 funzioni di automazione
// rispettando le frequenze e l'ordine di esecuzione definiti

import cron from 'node-cron';
import { runAutomationRules } from './rules';

// Classe che gestisce lo scheduler delle automazioni
class AutomationScheduler {
  private tasks: cron.ScheduledTask[] = [];
  private isRunning: boolean = false;
  private lastExecutionTimes: Map<string, Date> = new Map(); // Traccia ultima esecuzione per funzione

  start() {
    if (this.isRunning) {
      console.log('⚠️  Scheduler già avviato');
      return;
    }

    console.log('🤖 Avvio scheduler automazioni...');
    console.log('⚠️  NOTA: Su Render Free, usa cron-job.org invece dello scheduler interno');
    console.log('   Le automazioni vengono triggerate da chiamate HTTP esterne');

    // Su Render, NON avviamo lo scheduler interno
    // Le automazioni vengono triggerate da cron-job.org tramite endpoint /api/automation/trigger
    this.isRunning = true;
    console.log('✅ Scheduler configurato (trigger esterno via HTTP)');
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
   * Esegue le automazioni
   * Questa è la funzione principale chiamata dal background worker
   */
  async runNow() {
    console.log('🚀 Esecuzione automazioni...');

    const startTime = Date.now();

    try {
      // Esegue tutte le regole di automazione
      // Le regole in rules.ts si occupano di:
      // 1. Recuperare tutte le campagne
      // 2. Determinare quali funzioni eseguire
      // 3. Rispettare il periodo di warmup (7 giorni)
      // 4. Coordinare l'esecuzione Funz.1 → Funz.3 (stessa frequency)
      await runAutomationRules();

      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
      console.log(`✅ Esecuzione completata in ${duration} minuti`);

    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
      console.error(`❌ Errore esecuzione dopo ${duration} minuti:`, error);
      throw error;
    }
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
      triggerMethod: 'external', // Triggerate da cron-job.org
      lastExecutionTimes: Object.fromEntries(this.lastExecutionTimes)
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
