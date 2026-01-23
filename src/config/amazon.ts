// ================================================
// CONFIGURAZIONE MULTI-REGION AMAZON ADVERTISING API
// ================================================
// Supporta credenziali separate per EU, NA, e FE (Far East)

import dotenv from 'dotenv';

dotenv.config();

// Interfaccia per credenziali di una singola regione
interface RegionCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

// Configurazione completa multi-region
interface MultiRegionConfig {
  EU?: RegionCredentials;
  NA?: RegionCredentials;
  FE?: RegionCredentials;
}

// URL base dell'API Amazon per ogni regione
export const API_ENDPOINTS = {
  EU: 'https://advertising-api-eu.amazon.com',     // Europa
  NA: 'https://advertising-api.amazon.com',        // Nord America
  FE: 'https://advertising-api-fe.amazon.com'      // Far East (Asia-Pacific)
};

// Mapping marketplace → region
export const MARKETPLACE_TO_REGION: Record<string, 'EU' | 'NA' | 'FE'> = {
  'UK': 'EU',
  'GB': 'EU',
  'DE': 'EU',
  'FR': 'EU',
  'IT': 'EU',
  'ES': 'EU',
  'NL': 'EU',
  'SE': 'EU',
  'PL': 'EU',
  'US': 'NA',
  'CA': 'NA',
  'MX': 'NA',
  'BR': 'NA',
  'AU': 'FE',
  'JP': 'FE',
  'SG': 'FE',
  'IN': 'FE'
};

// Profile IDs per marketplace (caricati da env)
export const MARKETPLACE_PROFILES: Record<string, string> = {
  'US': process.env.AMAZON_PROFILE_US || '',
  'CA': process.env.AMAZON_PROFILE_CA || '',
  'UK': process.env.AMAZON_PROFILE_UK || '',
  'GB': process.env.AMAZON_PROFILE_UK || '',
  'DE': process.env.AMAZON_PROFILE_DE || '',
  'FR': process.env.AMAZON_PROFILE_FR || '',
  'IT': process.env.AMAZON_PROFILE_IT || '',
  'ES': process.env.AMAZON_PROFILE_ES || '',
  'AU': process.env.AMAZON_PROFILE_AU || ''
};

// Funzione per ottenere il profile ID per un marketplace
export const getProfileIdForMarketplace = (marketplace: string): string | null => {
  const profileId = MARKETPLACE_PROFILES[marketplace.toUpperCase()];
  return profileId || null;
};

// Carica credenziali da variabili d'ambiente
// Supporta sia formato vecchio (AMAZON_*) che nuovo (AMAZON_EU_*, AMAZON_NA_*, AMAZON_FE_*)
const loadMultiRegionConfig = (): MultiRegionConfig => {
  const config: MultiRegionConfig = {};

  // EU Region
  if (process.env.AMAZON_EU_CLIENT_ID || process.env.AMAZON_CLIENT_ID) {
    config.EU = {
      clientId: process.env.AMAZON_EU_CLIENT_ID || process.env.AMAZON_CLIENT_ID || '',
      clientSecret: process.env.AMAZON_EU_CLIENT_SECRET || process.env.AMAZON_CLIENT_SECRET || '',
      refreshToken: process.env.AMAZON_EU_REFRESH_TOKEN || process.env.AMAZON_REFRESH_TOKEN || ''
    };
  }

  // NA Region
  if (process.env.AMAZON_NA_CLIENT_ID) {
    config.NA = {
      clientId: process.env.AMAZON_NA_CLIENT_ID,
      clientSecret: process.env.AMAZON_NA_CLIENT_SECRET || '',
      refreshToken: process.env.AMAZON_NA_REFRESH_TOKEN || ''
    };
  }

  // FE Region
  if (process.env.AMAZON_FE_CLIENT_ID) {
    config.FE = {
      clientId: process.env.AMAZON_FE_CLIENT_ID,
      clientSecret: process.env.AMAZON_FE_CLIENT_SECRET || '',
      refreshToken: process.env.AMAZON_FE_REFRESH_TOKEN || ''
    };
  }

  return config;
};

export const multiRegionConfig = loadMultiRegionConfig();

// Funzione per ottenere credenziali per una specifica regione
export const getRegionCredentials = (region: 'EU' | 'NA' | 'FE'): RegionCredentials | null => {
  return multiRegionConfig[region] || null;
};

// Funzione per ottenere credenziali per un marketplace specifico
export const getCredentialsForMarketplace = (marketplace: string): { credentials: RegionCredentials, region: 'EU' | 'NA' | 'FE', endpoint: string } | null => {
  const region = MARKETPLACE_TO_REGION[marketplace.toUpperCase()];

  if (!region) {
    console.warn(`⚠️  Marketplace ${marketplace} non riconosciuto`);
    return null;
  }

  const credentials = getRegionCredentials(region);

  if (!credentials) {
    console.warn(`⚠️  Credenziali mancanti per regione ${region} (marketplace ${marketplace})`);
    return null;
  }

  return {
    credentials,
    region,
    endpoint: API_ENDPOINTS[region]
  };
};

// Funzione per ottenere tutte le regioni configurate
export const getConfiguredRegions = (): Array<'EU' | 'NA' | 'FE'> => {
  const regions: Array<'EU' | 'NA' | 'FE'> = [];

  if (multiRegionConfig.EU?.clientId) regions.push('EU');
  if (multiRegionConfig.NA?.clientId) regions.push('NA');
  if (multiRegionConfig.FE?.clientId) regions.push('FE');

  return regions;
};

// Funzione per validare la configurazione
export const validateMultiRegionConfig = (): boolean => {
  const configuredRegions = getConfiguredRegions();

  if (configuredRegions.length === 0) {
    console.error('❌ Nessuna credenziale Amazon configurata');
    return false;
  }

  console.log(`✅ Configurazione Amazon valida per ${configuredRegions.length} regioni: ${configuredRegions.join(', ')}`);

  // Valida ogni regione
  for (const region of configuredRegions) {
    const creds = multiRegionConfig[region]!;
    if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
      console.error(`❌ Credenziali incomplete per regione ${region}`);
      return false;
    }
  }

  return true;
};

// Backward compatibility: export default config (prima regione disponibile)
export const amazonConfig = {
  get clientId() {
    const regions = getConfiguredRegions();
    return regions.length > 0 ? multiRegionConfig[regions[0]]!.clientId : '';
  },
  get clientSecret() {
    const regions = getConfiguredRegions();
    return regions.length > 0 ? multiRegionConfig[regions[0]]!.clientSecret : '';
  },
  get refreshToken() {
    const regions = getConfiguredRegions();
    return regions.length > 0 ? multiRegionConfig[regions[0]]!.refreshToken : '';
  },
  profileId: process.env.AMAZON_PROFILE_ID || '',
  get region() {
    const regions = getConfiguredRegions();
    return regions[0] || 'EU';
  }
};

// Backward compatibility: get API endpoint for default region
export const getApiEndpoint = (): string => {
  return API_ENDPOINTS[amazonConfig.region];
};
