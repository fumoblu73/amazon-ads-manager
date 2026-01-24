// ================================================
// MARKETPLACE API FACTORY
// ================================================
// Factory per creare istanze AmazonApiService configurate
// per specifici marketplace. Usata dalle automazioni F1-F5
// per supportare multi-marketplace.

import { AmazonApiService, AmazonApiConfig } from './amazonApi';
import {
  getProfileIdForMarketplace,
  getCredentialsForMarketplace,
  MARKETPLACE_TO_REGION,
  API_ENDPOINTS
} from '../config/amazon';

// Cache delle istanze API per evitare di creare duplicati
const apiServiceCache: Map<string, AmazonApiService> = new Map();

/**
 * Crea o recupera un'istanza AmazonApiService per un marketplace specifico
 * @param marketplace - Codice marketplace (US, CA, UK, DE, FR, IT, ES, AU)
 * @returns AmazonApiService configurato per quel marketplace
 */
export function createMarketplaceApiService(marketplace: string): AmazonApiService {
  const marketplaceUpper = marketplace.toUpperCase();

  // Check cache
  if (apiServiceCache.has(marketplaceUpper)) {
    console.log(`♻️  [${marketplaceUpper}] Riutilizzo istanza API dalla cache`);
    return apiServiceCache.get(marketplaceUpper)!;
  }

  // Recupera profileId per il marketplace
  const profileId = getProfileIdForMarketplace(marketplaceUpper);
  if (!profileId) {
    throw new Error(`Profile ID non configurato per marketplace ${marketplaceUpper}`);
  }

  // Recupera credenziali per la regione
  const credentialsInfo = getCredentialsForMarketplace(marketplaceUpper);
  if (!credentialsInfo) {
    throw new Error(`Credenziali non configurate per marketplace ${marketplaceUpper}`);
  }

  const { credentials, endpoint } = credentialsInfo;

  // Crea configurazione
  const config: AmazonApiConfig = {
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    refreshToken: credentials.refreshToken,
    profileId: profileId,
    endpoint: endpoint,
    marketplace: marketplaceUpper
  };

  console.log(`🏭 [${marketplaceUpper}] Creazione nuova istanza API`);
  console.log(`   Profile ID: ${profileId}`);
  console.log(`   Endpoint: ${endpoint}`);

  // Crea istanza
  const apiService = new AmazonApiService(config);

  // Salva in cache
  apiServiceCache.set(marketplaceUpper, apiService);

  return apiService;
}

/**
 * Verifica se un marketplace è configurato correttamente
 * @param marketplace - Codice marketplace
 * @returns true se configurato, false altrimenti
 */
export function isMarketplaceConfigured(marketplace: string): boolean {
  const marketplaceUpper = marketplace.toUpperCase();

  const profileId = getProfileIdForMarketplace(marketplaceUpper);
  const credentials = getCredentialsForMarketplace(marketplaceUpper);

  return !!(profileId && credentials);
}

/**
 * Recupera tutti i marketplace configurati
 * @returns Array di codici marketplace configurati
 */
export function getConfiguredMarketplaces(): string[] {
  const allMarketplaces = ['US', 'CA', 'UK', 'DE', 'FR', 'IT', 'ES', 'AU'];
  return allMarketplaces.filter(mp => isMarketplaceConfigured(mp));
}

/**
 * Svuota la cache delle istanze API
 * Utile per test o per forzare la ricreazione
 */
export function clearApiCache(): void {
  apiServiceCache.clear();
  console.log('🗑️  Cache API marketplace svuotata');
}

/**
 * Recupera info sui marketplace configurati
 */
export function getMarketplacesInfo(): Array<{
  marketplace: string;
  configured: boolean;
  region: string | undefined;
  profileId: string | null;
}> {
  const allMarketplaces = ['US', 'CA', 'UK', 'DE', 'FR', 'IT', 'ES', 'AU'];

  return allMarketplaces.map(mp => ({
    marketplace: mp,
    configured: isMarketplaceConfigured(mp),
    region: MARKETPLACE_TO_REGION[mp],
    profileId: getProfileIdForMarketplace(mp)
  }));
}

// Export anche l'istanza singleton legacy per backward compatibility
export { amazonApiService } from './amazonApi';
