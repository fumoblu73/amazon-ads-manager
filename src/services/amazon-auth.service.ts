import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const CLIENT_ID = process.env.AMAZON_ADS_CLIENT_ID!;
const CLIENT_SECRET = process.env.AMAZON_ADS_CLIENT_SECRET!;
const REDIRECT_URI_LOCAL = process.env.AMAZON_ADS_REDIRECT_URI_LOCAL!;
const REDIRECT_URI_PROD = process.env.AMAZON_ADS_REDIRECT_URI_PROD!;
const SCOPES = process.env.AMAZON_ADS_SCOPES || 'advertising::campaign_management';

// Determina il redirect URI in base all'ambiente
const getRedirectUri = () => {
  return process.env.NODE_ENV === 'production' ? REDIRECT_URI_PROD : REDIRECT_URI_LOCAL;
};

export interface AmazonTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AmazonProfile {
  profileId: number;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  accountInfo: {
    marketplaceStringId: string;
    name: string;
    type: string;
  };
}

export class AmazonAuthService {
  /**
   * Genera l'URL per avviare il Login with Amazon
   */
  static getAuthorizationUrl(state?: string): string {
    const redirectUri = getRedirectUri();
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      scope: SCOPES,
      response_type: 'code',
      redirect_uri: redirectUri,
      ...(state && { state })
    });

    return `https://www.amazon.com/ap/oa?${params.toString()}`;
  }

  /**
   * Scambia authorization code con access token e refresh token
   */
  static async exchangeCodeForTokens(code: string): Promise<AmazonTokenResponse> {
    const redirectUri = getRedirectUri();

    try {
      const response = await axios.post<AmazonTokenResponse>(
        'https://api.amazon.com/auth/o2/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: redirectUri
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error exchanging code for tokens:', error.response?.data || error.message);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  /**
   * Rigenera access token usando refresh token
   */
  static async refreshAccessToken(refreshToken: string): Promise<AmazonTokenResponse> {
    try {
      const response = await axios.post<AmazonTokenResponse>(
        'https://api.amazon.com/auth/o2/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error refreshing access token:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Ottiene i profili Amazon Ads associati all'account
   */
  static async getProfiles(accessToken: string): Promise<AmazonProfile[]> {
    try {
      const response = await axios.get<AmazonProfile[]>(
        'https://advertising-api.amazon.com/v2/profiles',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Amazon-Advertising-API-ClientId': CLIENT_ID,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error fetching profiles:', error.response?.data || error.message);
      throw new Error('Failed to fetch Amazon Ads profiles');
    }
  }

  /**
   * Ottiene informazioni sull'utente da Amazon
   */
  static async getUserInfo(accessToken: string): Promise<{ user_id: string; email: string; name: string }> {
    try {
      const response = await axios.get(
        'https://api.amazon.com/user/profile',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error fetching user info:', error.response?.data || error.message);
      throw new Error('Failed to fetch user information');
    }
  }

  /**
   * Verifica se un token è scaduto
   */
  static isTokenExpired(expiresAt: Date): boolean {
    return new Date() >= expiresAt;
  }

  /**
   * Calcola la data di scadenza del token
   */
  static calculateTokenExpiry(expiresIn: number): Date {
    return new Date(Date.now() + expiresIn * 1000);
  }
}
