// ================================================
// CONFIGURAZIONE AMAZON ADVERTISING API
// ================================================
// Questo file contiene la configurazione per connettersi
// all'API di Amazon Advertising

import dotenv from 'dotenv';

dotenv.config();

// Interfaccia TypeScript per definire la struttura della configurazione
// (TypeScript ti avviserà se dimentichi qualche campo)
interface AmazonConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  profileId: string;
  region: 'EU' | 'NA' | 'FE';  // Regioni disponibili
}

// URL base dell'API Amazon in base alla regione
const API_ENDPOINTS = {
  EU: 'https://advertising-api-eu.amazon.com',     // Europa
  NA: 'https://advertising-api.amazon.com',        // Nord America
  FE: 'https://advertising-api-fe.amazon.com'      // Far East (Asia)
};

// Esporta la configurazione usando le variabili d'ambiente
export const amazonConfig: AmazonConfig = {
  clientId: process.env.AMAZON_CLIENT_ID || '',
  clientSecret: process.env.AMAZON_CLIENT_SECRET || '',
  refreshToken: process.env.AMAZON_REFRESH_TOKEN || '',
  profileId: process.env.AMAZON_PROFILE_ID || '',
  region: (process.env.AMAZON_REGION as 'EU' | 'NA' | 'FE') || 'EU'
};

// Funzione per ottenere l'URL base dell'API in base alla regione
export const getApiEndpoint = (): string => {
  return API_ENDPOINTS[amazonConfig.region];
};

// Funzione per validare che tutte le credenziali siano presenti
export const validateAmazonConfig = (): boolean => {
  const requiredFields: (keyof AmazonConfig)[] = [
    'clientId',
    'clientSecret',
    'refreshToken',
    'profileId'
  ];

  // Controlla che ogni campo richiesto sia compilato
  for (const field of requiredFields) {
    if (!amazonConfig[field]) {
      console.error(`❌ Configurazione Amazon mancante: ${field}`);
      return false;
    }
  }

  console.log('✅ Configurazione Amazon valida');
  return true;
};
