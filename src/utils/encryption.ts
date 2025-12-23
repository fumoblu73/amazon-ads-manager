import crypto from 'crypto';

// Usa una chiave segreta dall'environment (32 bytes per AES-256)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Cripta i cookie KDP prima di salvarli nel database
 */
export function encryptCookies(cookiesJson: string): string {
  try {
    // Genera un IV casuale per ogni criptazione
    const iv = crypto.randomBytes(IV_LENGTH);

    // Crea cipher
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY.substring(0, 64), 'hex'),
      iv
    );

    // Cripta i dati
    let encrypted = cipher.update(cookiesJson, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Ottieni auth tag per integrità
    const authTag = cipher.getAuthTag();

    // Combina: IV + AuthTag + Encrypted Data (tutto in hex)
    return iv.toString('hex') + authTag.toString('hex') + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt cookies');
  }
}

/**
 * Decripta i cookie KDP dal database
 */
export function decryptCookies(encryptedData: string): string {
  try {
    // Estrai IV, AuthTag e dati criptati
    const ivHex = encryptedData.substring(0, IV_LENGTH * 2);
    const authTagHex = encryptedData.substring(IV_LENGTH * 2, (IV_LENGTH + AUTH_TAG_LENGTH) * 2);
    const encryptedHex = encryptedData.substring((IV_LENGTH + AUTH_TAG_LENGTH) * 2);

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    // Crea decipher
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY.substring(0, 64), 'hex'),
      iv
    );

    // Imposta auth tag
    decipher.setAuthTag(authTag);

    // Decripta
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt cookies');
  }
}

/**
 * Verifica se i cookie sono ancora validi (non scaduti)
 */
export function areCookiesExpired(cookiesUpdatedAt: Date, maxAgeDays: number = 7): boolean {
  const now = new Date();
  const diffMs = now.getTime() - cookiesUpdatedAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays > maxAgeDays;
}

/**
 * Estrae cookie specifici da una lista
 */
export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
}

export function extractKdpAuthCookies(cookies: Cookie[]): Cookie[] {
  // Cookie importanti per autenticazione KDP
  const authCookieNames = [
    'session-id',
    'session-id-time',
    'ubid-main',
    'at-main',
    'sess-at-main',
    'x-main',
    'csm-hit'
  ];

  return cookies.filter(cookie =>
    authCookieNames.some(name => cookie.name.includes(name)) ||
    cookie.domain.includes('amazon')
  );
}

/**
 * Converte cookie array in header string
 */
export function cookiesToHeaderString(cookies: Cookie[]): string {
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}
