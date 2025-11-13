/**
 * Simple in-memory cache per ridurre le chiamate API
 * Utile per dati che non cambiano frequentemente (campagne, keywords, etc.)
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  /**
   * Salva un valore in cache
   * @param key Chiave univoca
   * @param data Dati da salvare
   * @param ttl Time to live in secondi (default: 5 minuti)
   */
  set<T>(key: string, data: T, ttl: number = 300): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl * 1000 // Converti in millisecondi
    };

    this.cache.set(key, entry);
  }

  /**
   * Recupera un valore dalla cache
   * @param key Chiave univoca
   * @returns Dati salvati o null se scaduti/non esistenti
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Verifica se la cache è scaduta
    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > entry.ttl) {
      // Cache scaduta, rimuovi entry
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Verifica se una chiave esiste in cache ed è valida
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Rimuove una specifica chiave dalla cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Rimuove tutte le entry che iniziano con un prefisso
   * Utile per invalidare gruppi di cache (es. tutte le keywords)
   */
  deleteByPrefix(prefix: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Pulisce tutte le entry scadute
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Svuota completamente la cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Restituisce statistiche sulla cache
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Wrapper per funzioni async con cache automatica
   * @param key Chiave cache
   * @param fn Funzione da eseguire se cache miss
   * @param ttl Time to live in secondi
   */
  async wrap<T>(key: string, fn: () => Promise<T>, ttl: number = 300): Promise<T> {
    // Prova a recuperare dalla cache
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss, esegui funzione
    const result = await fn();

    // Salva in cache
    this.set(key, result, ttl);

    return result;
  }
}

// Istanza singleton
export const cache = new MemoryCache();

// Cleanup automatico ogni 10 minuti
setInterval(() => {
  cache.cleanup();
}, 10 * 60 * 1000);

// Helper per generare chiavi cache consistenti
export const CacheKeys = {
  campaigns: () => 'amazon:campaigns',
  campaign: (id: string) => `amazon:campaign:${id}`,
  keywords: (campaignId: string) => `amazon:keywords:${campaignId}`,
  keyword: (id: string) => `amazon:keyword:${id}`,
  targets: (campaignId: string) => `amazon:targets:${campaignId}`,
  target: (id: string) => `amazon:target:${id}`,
  report: (reportId: string) => `amazon:report:${reportId}`,
  searchTerms: (campaignId: string, dateRange: string) => `amazon:searchterms:${campaignId}:${dateRange}`,
};

// TTL predefiniti (in secondi)
export const CacheTTL = {
  campaigns: 600,      // 10 minuti
  keywords: 300,       // 5 minuti
  targets: 300,        // 5 minuti
  reports: 3600,       // 1 ora
  searchTerms: 1800,   // 30 minuti
  short: 60,           // 1 minuto
  medium: 300,         // 5 minuti
  long: 3600,          // 1 ora
};

export default cache;
