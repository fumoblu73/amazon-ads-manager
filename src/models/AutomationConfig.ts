// ================================================
// MODEL: AUTOMATION CONFIG
// ================================================
// Configurazione delle automazioni per ogni campagna
// Permette di personalizzare i parametri delle 5 funzioni

export interface AutomationConfig {
  id: string;
  campaignId: string;
  bookId: string;

  // ================================================
  // FUNZIONE 1: Progressive Bidding Increase
  // ================================================
  func1_enabled: boolean;
  func1_bidIncrease: number;      // Default: 0.02
  func1_frequency: number;        // Default: 3 giorni
  func1_impressions: number;      // Default: 20
  func1_clicks: number;           // Default: 0

  // ================================================
  // FUNZIONE 2: Placement Optimization
  // ================================================
  func2_enabled: boolean;
  func2_frequency: number;             // Default: 7 giorni
  func2_timeframeWeeks: number;        // Default: 4 settimane

  // ================================================
  // FUNZIONE 3: Targeting Optimization
  // ================================================
  func3_enabled: boolean;
  func3_frequency: number;        // Default: 3 giorni (= func1)
  func3_timeframeA: number;       // Default: 2000
  func3_timeframeB: number;       // Default: 3000
  func3_timeframeC: number;       // Default: 5000
  func3_clicksPause: number;      // Default: 10
  func3_clicks65days: number;     // Default: 30

  // ================================================
  // FUNZIONE 4: Auto Ad Optimization
  // ================================================
  func4_enabled: boolean;
  func4_frequency: number;        // Default: 7 giorni
  func4_timeframeA: number;       // Default: 1000
  func4_timeframeB: number;       // Default: 3000
  func4_timeframeC: number;       // Default: 5000
  func4_clicksNegative: number;   // Default: 10
  func4_spendNegative: number;    // Default: 10

  // ================================================
  // FUNZIONE 5: Campaign Feeding
  // ================================================
  func5_enabled: boolean;
  func5_frequency: number;        // Default: 7 giorni
  func5_minOrders: number;        // Default: 1
  func5_bidBroad: number;         // Default: 0.30
  func5_bidExact: number;         // Default: 0.50
  func5_bidPhrase: number;        // Default: 0.40
  func5_bidExpanded: number;      // Default: 0.30

  createdAt: Date;
  updatedAt: Date;
}

// Interfaccia per creare una nuova configurazione
export interface CreateAutomationConfigInput {
  campaignId: string;
  bookId: string;

  // Opzionale: se non forniti, usa i default
  func1_enabled?: boolean;
  func1_bidIncrease?: number;
  func1_frequency?: number;
  func1_impressions?: number;
  func1_clicks?: number;

  func2_enabled?: boolean;
  func2_frequency?: number;
  func2_timeframeWeeks?: number;

  func3_enabled?: boolean;
  func3_frequency?: number;
  func3_timeframeA?: number;
  func3_timeframeB?: number;
  func3_timeframeC?: number;
  func3_clicksPause?: number;
  func3_clicks65days?: number;

  func4_enabled?: boolean;
  func4_frequency?: number;
  func4_timeframeA?: number;
  func4_timeframeB?: number;
  func4_timeframeC?: number;
  func4_clicksNegative?: number;
  func4_spendNegative?: number;

  func5_enabled?: boolean;
  func5_frequency?: number;
  func5_minOrders?: number;
  func5_bidBroad?: number;
  func5_bidExact?: number;
  func5_bidPhrase?: number;
  func5_bidExpanded?: number;
}

/**
 * Classe AutomationConfig per gestire la logica di business
 */
export class AutomationConfigModel {
  /**
   * Restituisce la configurazione di default
   */
  static getDefaults(): Omit<AutomationConfig, 'id' | 'campaignId' | 'bookId' | 'createdAt' | 'updatedAt'> {
    return {
      // Funzione 1
      func1_enabled: true,
      func1_bidIncrease: 0.02,
      func1_frequency: 3,
      func1_impressions: 20,
      func1_clicks: 0,

      // Funzione 2
      func2_enabled: true,
      func2_frequency: 7,
      func2_timeframeWeeks: 4,

      // Funzione 3
      func3_enabled: true,
      func3_frequency: 3,
      func3_timeframeA: 2000,
      func3_timeframeB: 3000,
      func3_timeframeC: 5000,
      func3_clicksPause: 10,
      func3_clicks65days: 30,

      // Funzione 4
      func4_enabled: true,
      func4_frequency: 7,
      func4_timeframeA: 1000,
      func4_timeframeB: 3000,
      func4_timeframeC: 5000,
      func4_clicksNegative: 10,
      func4_spendNegative: 10,

      // Funzione 5
      func5_enabled: true,
      func5_frequency: 7,
      func5_minOrders: 1,
      func5_bidBroad: 0.30,
      func5_bidExact: 0.50,
      func5_bidPhrase: 0.40,
      func5_bidExpanded: 0.30
    };
  }

  /**
   * Crea una configurazione con i valori di default
   */
  static createWithDefaults(campaignId: string, bookId: string, overrides?: Partial<CreateAutomationConfigInput>): CreateAutomationConfigInput {
    const defaults = this.getDefaults();

    return {
      campaignId,
      bookId,
      ...defaults,
      ...overrides
    };
  }

  /**
   * Valida la configurazione
   */
  static validate(config: CreateAutomationConfigInput): string[] {
    const errors: string[] = [];

    // Validazione frequenze
    if (config.func1_frequency !== undefined && config.func1_frequency < 1) {
      errors.push('func1_frequency deve essere >= 1');
    }

    if (config.func2_frequency !== undefined && (config.func2_frequency < 3 || config.func2_frequency > 14)) {
      errors.push('func2_frequency deve essere tra 3 e 14 giorni');
    }

    if (config.func3_frequency !== undefined && (config.func3_frequency < 1 || config.func3_frequency > 7)) {
      errors.push('func3_frequency deve essere tra 1 e 7 giorni');
    }

    if (config.func4_frequency !== undefined && (config.func4_frequency < 1 || config.func4_frequency > 14)) {
      errors.push('func4_frequency deve essere tra 1 e 14 giorni');
    }

    // Validazione bid
    if (config.func1_bidIncrease !== undefined && config.func1_bidIncrease <= 0) {
      errors.push('func1_bidIncrease deve essere > 0');
    }

    if (config.func5_bidBroad !== undefined && config.func5_bidBroad <= 0) {
      errors.push('func5_bidBroad deve essere > 0');
    }

    if (config.func5_bidExact !== undefined && config.func5_bidExact <= 0) {
      errors.push('func5_bidExact deve essere > 0');
    }

    if (config.func5_bidPhrase !== undefined && config.func5_bidPhrase <= 0) {
      errors.push('func5_bidPhrase deve essere > 0');
    }

    if (config.func5_bidExpanded !== undefined && config.func5_bidExpanded <= 0) {
      errors.push('func5_bidExpanded deve essere > 0');
    }

    // Validazione timeframes
    if (config.func2_timeframeWeeks !== undefined && (config.func2_timeframeWeeks < 1 || config.func2_timeframeWeeks > 6)) {
      errors.push('func2_timeframeWeeks deve essere tra 1 e 6');
    }

    if (config.func3_timeframeA !== undefined && (config.func3_timeframeA < 1000 || config.func3_timeframeA > 8000)) {
      errors.push('func3_timeframeA deve essere tra 1000 e 8000');
    }

    if (config.func3_timeframeB !== undefined && (config.func3_timeframeB < 1000 || config.func3_timeframeB > 8000)) {
      errors.push('func3_timeframeB deve essere tra 1000 e 8000');
    }

    if (config.func3_timeframeC !== undefined && (config.func3_timeframeC < 1000 || config.func3_timeframeC > 8000)) {
      errors.push('func3_timeframeC deve essere tra 1000 e 8000');
    }

    return errors;
  }

  /**
   * Determina quali funzioni devono essere eseguite in base al tipo di campagna
   */
  static getApplicableFunctions(campaignType: 1 | 2 | 3 | 4 | 5): number[] {
    const applicableFunctions: number[] = [];

    // Funzione 1: campagne 1, 2, 3, 4
    if (campaignType >= 1 && campaignType <= 4) {
      applicableFunctions.push(1);
    }

    // Funzione 2: TUTTE le campagne
    applicableFunctions.push(2);

    // Funzione 3: campagne 1, 2, 3, 4
    if (campaignType >= 1 && campaignType <= 4) {
      applicableFunctions.push(3);
    }

    // Funzione 4: SOLO campagna 5
    if (campaignType === 5) {
      applicableFunctions.push(4);
    }

    // Funzione 5: TUTTE le campagne
    applicableFunctions.push(5);

    return applicableFunctions;
  }
}
