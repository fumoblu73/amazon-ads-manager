// ================================================
// SCHEDULER PER AUTOMAZIONI
// ================================================
// Gestisce lo stato dello scheduler e fornisce metodi di utilita'.
// I cron job interni sono DISABILITATI: l'orchestrazione e' gestita
// interamente dai cronjob esterni su cron-job.org.

import cron from 'node-cron';

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
   * Avvia lo scheduler.
   * I cron job interni sono DISABILITATI: l'orchestrazione e' gestita
   * interamente dai cronjob esterni su cron-job.org che chiamano:
   *   - /api/automation/trigger (warm-up DB)
   *   - /api/automation/submit-reports (Fase 1: submit report)
   *   - /api/automation/process-reports (Fase 2: processa report completati)
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Scheduler già avviato');
      return;
    }

    console.log('🤖 Scheduler automazioni inizializzato (cron interni DISABILITATI)');
    console.log('📡 Orchestrazione gestita da cron-job.org esterni:');
    console.log('   - Wake-up + DB warm: /api/automation/trigger');
    console.log('   - Fase 1 (submit):   /api/automation/submit-reports');
    console.log('   - Fase 2 (process):  /api/automation/process-reports');

    // NOTA: I cron job interni (node-cron) sono stati disabilitati per evitare
    // conflitti con i cronjob esterni su cron-job.org che gestiscono la pipeline
    // asincrona a 2 fasi (submit → process). I vecchi cron interni usavano il
    // path sincrono (lento) e causavano esecuzioni duplicate.

    this.isRunning = true;
    console.log('✅ Scheduler pronto (in attesa di trigger esterni)');
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
      triggerMethod: 'external', // Orchestrato da cron-job.org
      config: this.config,
      lastExecutionTimes: Object.fromEntries(this.lastExecutionTimes),
      pipeline: {
        description: 'Pipeline asincrona a 2 fasi gestita da cron-job.org',
        fase1: '/api/automation/submit-reports (submit report in batch)',
        fase2: '/api/automation/process-reports (processa report completati)',
        warmup: '/api/automation/trigger (DB warm-up)'
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
