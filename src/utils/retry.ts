import logger from './logger';

/**
 * Configurazione retry
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // millisecondi
  maxDelay: number; // millisecondi
  backoffMultiplier: number;
  retryableErrors: string[]; // Codici errore da ritentare
}

/**
 * Configurazione di default
 */
const defaultConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 secondo
  maxDelay: 30000, // 30 secondi
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'EHOSTUNREACH',
    'EPIPE',
    'EAI_AGAIN',
    '429', // Too Many Requests
    '500', // Internal Server Error
    '502', // Bad Gateway
    '503', // Service Unavailable
    '504'  // Gateway Timeout
  ]
};

/**
 * Verifica se un errore è ritentabile
 */
function isRetryableError(error: any, config: RetryConfig): boolean {
  // Errori di rete
  if (error.code && config.retryableErrors.includes(error.code)) {
    return true;
  }

  // Errori HTTP
  if (error.response?.status) {
    const status = error.response.status.toString();
    if (config.retryableErrors.includes(status)) {
      return true;
    }
  }

  // Rate limiting specifico Amazon
  if (error.response?.status === 429) {
    return true;
  }

  return false;
}

/**
 * Calcola il delay con exponential backoff
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelay
  );

  // Aggiungi jitter (variazione casuale ±20%) per evitare thundering herd
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.floor(delay + jitter);
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wrapper per funzioni async con retry automatico
 *
 * @example
 * const result = await withRetry(
 *   async () => await amazonApi.getCampaigns(),
 *   { maxRetries: 5 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context?: string
): Promise<T> {
  const finalConfig: RetryConfig = { ...defaultConfig, ...config };
  let lastError: any;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      // Esegui la funzione
      const result = await fn();

      // Se non è il primo tentativo, logga il successo dopo retry
      if (attempt > 0) {
        logger.info(`✅ Retry riuscito dopo ${attempt} tentativi${context ? ` (${context})` : ''}`);
      }

      return result;
    } catch (error: any) {
      lastError = error;

      // Se è l'ultimo tentativo, lancia l'errore
      if (attempt === finalConfig.maxRetries) {
        logger.error(`❌ Tutti i ${finalConfig.maxRetries} retry falliti${context ? ` (${context})` : ''}`, {
          error: error.message,
          attempts: attempt + 1
        });
        throw error;
      }

      // Verifica se l'errore è ritentabile
      if (!isRetryableError(error, finalConfig)) {
        logger.error(`❌ Errore non ritentabile${context ? ` (${context})` : ''}: ${error.message}`);
        throw error;
      }

      // Calcola il delay
      const delay = calculateDelay(attempt, finalConfig);

      // Logga il retry
      logger.warn(`⏳ Retry ${attempt + 1}/${finalConfig.maxRetries} dopo ${delay}ms${context ? ` (${context})` : ''}`, {
        error: error.message,
        status: error.response?.status,
        code: error.code
      });

      // Attendi prima del prossimo tentativo
      await sleep(delay);
    }
  }

  // Non dovrebbe mai arrivare qui, ma TypeScript richiede un return
  throw lastError;
}

/**
 * Decorator per metodi di classe con retry automatico
 *
 * @example
 * class MyApi {
 *   @withRetryDecorator({ maxRetries: 5 })
 *   async fetchData() {
 *     // ...
 *   }
 * }
 */
export function withRetryDecorator(config: Partial<RetryConfig> = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return withRetry(
        () => originalMethod.apply(this, args),
        config,
        `${target.constructor.name}.${propertyKey}`
      );
    };

    return descriptor;
  };
}

/**
 * Batch retry - esegue più operazioni con retry individuale
 * Se alcune falliscono, restituisce sia i successi che gli errori
 *
 * @example
 * const results = await batchWithRetry([
 *   async () => api.updateBid('keyword1', 0.5),
 *   async () => api.updateBid('keyword2', 0.6),
 * ]);
 */
export async function batchWithRetry<T>(
  operations: (() => Promise<T>)[],
  config: Partial<RetryConfig> = {}
): Promise<{
  successes: T[];
  failures: { index: number; error: any }[];
}> {
  const successes: T[] = [];
  const failures: { index: number; error: any }[] = [];

  await Promise.all(
    operations.map(async (operation, index) => {
      try {
        const result = await withRetry(operation, config, `batch-item-${index}`);
        successes.push(result);
      } catch (error) {
        failures.push({ index, error });
      }
    })
  );

  return { successes, failures };
}

/**
 * Rate limiter - limita il numero di richieste al secondo
 * Utile per rispettare i limiti di rate dell'API Amazon
 */
export class RateLimiter {
  private queue: Array<{ fn: () => Promise<any>; resolve: (value: any) => void; reject: (error: any) => void }> = [];
  private running = 0;
  private lastReset = Date.now();
  private requestCount = 0;

  constructor(
    private maxRequestsPerSecond: number = 10,
    private maxConcurrent: number = 5
  ) {
    // Resetta il contatore ogni secondo
    setInterval(() => {
      this.lastReset = Date.now();
      this.requestCount = 0;
      this.processQueue();
    }, 1000);
  }

  /**
   * Esegue una funzione rispettando il rate limit
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    // Non processare se abbiamo raggiunto i limiti
    if (
      this.running >= this.maxConcurrent ||
      this.requestCount >= this.maxRequestsPerSecond ||
      this.queue.length === 0
    ) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.running++;
    this.requestCount++;

    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      this.running--;
      this.processQueue();
    }
  }
}

// Istanza globale del rate limiter per Amazon API
// Amazon permette ~10 richieste al secondo
export const amazonRateLimiter = new RateLimiter(10, 5);

export default {
  withRetry,
  withRetryDecorator,
  batchWithRetry,
  RateLimiter,
  amazonRateLimiter
};
