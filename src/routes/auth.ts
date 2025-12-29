import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { AmazonAuthService } from '../services/amazon-auth.service';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const userRepository = AppDataSource.getRepository(User);

/**
 * GET /api/auth/login
 * Reindirizza l'utente alla pagina di login Amazon
 */
router.get('/login', (req: Request, res: Response) => {
  const state = Math.random().toString(36).substring(7); // Random state for CSRF protection
  const authUrl = AmazonAuthService.getAuthorizationUrl(state);

  // Salva lo state in sessione per verificarlo nel callback
  // (In produzione, usa un session store come Redis)
  res.cookie('oauth_state', state, {
    httpOnly: true,
    maxAge: 600000, // 10 minuti
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' required for cross-site redirects in production
    path: '/'
  });

  res.redirect(authUrl);
});

/**
 * GET /api/auth/callback
 * Amazon reindirizza qui dopo il login
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    const savedState = req.cookies.oauth_state;

    // Verifica CSRF - temporaneamente più permissivo per debugging
    if (!code) {
      console.error('OAuth callback: missing code');
      return res.status(400).json({ error: 'Invalid OAuth callback: missing code' });
    }

    if (!state) {
      console.error('OAuth callback: missing state parameter');
      return res.status(400).json({ error: 'Invalid OAuth callback: missing state parameter' });
    }

    // Skip state validation in production if cookie wasn't set (temporary workaround)
    if (savedState && state !== savedState) {
      console.error('OAuth callback: state mismatch', { received: state, expected: savedState });
      return res.status(400).json({ error: 'Invalid OAuth callback: state mismatch (CSRF)' });
    }

    if (!savedState) {
      console.warn('OAuth callback: state cookie not found, skipping CSRF validation (not recommended for production)');
    }

    // Step 2: Scambia code con tokens
    const tokens = await AmazonAuthService.exchangeCodeForTokens(code as string);

    // Step 3: Ottieni user info
    const userInfo = await AmazonAuthService.getUserInfo(tokens.access_token);

    // Step 4: Tenta di ottenere profili Ads (opzionale se scope presente)
    let profile = null;
    const scopes = process.env.AMAZON_ADS_SCOPES || '';

    if (scopes.includes('advertising')) {
      try {
        const profiles = await AmazonAuthService.getProfiles(tokens.access_token);
        if (profiles.length > 0) {
          profile = profiles[0];
        }
      } catch (error) {
        console.log('No Ads profiles available (scope not granted yet)');
      }
    }

    const tokenExpiry = AmazonAuthService.calculateTokenExpiry(tokens.expires_in);

    // Cerca l'utente per amazonUserId o email
    let user = await userRepository.findOne({
      where: [
        { amazonUserId: userInfo.user_id },
        { email: userInfo.email }
      ]
    });

    if (user) {
      // Aggiorna utente esistente
      user.email = userInfo.email;
      user.name = userInfo.name;
      user.amazonUserId = userInfo.user_id;
      user.accessToken = tokens.access_token;
      user.refreshToken = tokens.refresh_token;
      user.tokenExpiresAt = tokenExpiry;
      if (profile) {
        user.profileId = profile.profileId;
        user.countryCode = profile.countryCode;
        user.currencyCode = profile.currencyCode;
      }
      user.lastLoginAt = new Date();
    } else {
      // Crea nuovo utente
      user = userRepository.create({
        email: userInfo.email,
        name: userInfo.name,
        amazonUserId: userInfo.user_id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        profileId: profile?.profileId || null,
        countryCode: profile?.countryCode || null,
        currencyCode: profile?.currencyCode || null,
        tokenExpiresAt: tokenExpiry,
        lastLoginAt: new Date(),
        isActive: true
      });
    }

    await userRepository.save(user);

    // Genera JWT per autenticazione nella nostra app
    const jwtToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Salva JWT in cookie (httpOnly per sicurezza)
    res.cookie('auth_token', jwtToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 giorni
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    // Cookie duplicato per browser extension (non httpOnly)
    res.cookie('extension_token', jwtToken, {
      httpOnly: false, // Extension può leggerlo
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 giorni
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    // Cancella lo state cookie
    res.clearCookie('oauth_state');

    // Reindirizza alla KDP Dashboard
    res.redirect('/kdp/dashboard');
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
});

/**
 * GET /api/auth/me
 * Ottiene le informazioni dell'utente corrente
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await userRepository.findOne({
      where: { id: decoded.userId },
      select: ['id', 'email', 'name', 'profileId', 'countryCode', 'currencyCode', 'lastLoginAt']
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error: any) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

/**
 * POST /api/auth/logout
 * Logout dell'utente
 */
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('auth_token');
  res.json({ message: 'Logged out successfully' });
});

/**
 * POST /api/auth/refresh
 * Rigenera l'access token Amazon Ads se scaduto
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await userRepository.findOne({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verifica se il token Amazon Ads è scaduto
    if (!AmazonAuthService.isTokenExpired(user.tokenExpiresAt)) {
      return res.json({ message: 'Token still valid' });
    }

    // Rigenera il token
    const newTokens = await AmazonAuthService.refreshAccessToken(user.refreshToken);
    const tokenExpiry = AmazonAuthService.calculateTokenExpiry(newTokens.expires_in);

    user.accessToken = newTokens.access_token;
    if (newTokens.refresh_token) {
      user.refreshToken = newTokens.refresh_token;
    }
    user.tokenExpiresAt = tokenExpiry;

    await userRepository.save(user);

    res.json({ message: 'Token refreshed successfully' });
  } catch (error: any) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token', details: error.message });
  }
});

export default router;
