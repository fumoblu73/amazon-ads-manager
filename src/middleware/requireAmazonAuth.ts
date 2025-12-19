// ================================================
// REQUIRE AMAZON AUTH MIDDLEWARE
// ================================================
// Ensures user has valid Amazon OAuth credentials before accessing
// endpoints that require Amazon Ads API access

import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { AmazonAuthService } from '../services/amazon-auth.service';

/**
 * Extended Request interface with user authentication info
 */
export interface AuthRequest extends Request {
  userId?: string;
  user?: User;
  amazonAuthValid?: boolean;
}

/**
 * Middleware that requires valid Amazon OAuth authentication
 *
 * Prerequisites:
 * - authMiddleware must run first to set req.userId
 *
 * Checks:
 * 1. User exists in database
 * 2. User has completed Amazon OAuth (has amazonUserId and refreshToken)
 * 3. User's access token is valid (refreshes if expired)
 * 4. User account is active
 *
 * Sets:
 * - req.user: Full User object
 * - req.amazonAuthValid: true if all checks pass
 *
 * Returns 401/403 if checks fail
 */
export const requireAmazonAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if authMiddleware ran
    if (!req.userId) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
        message: 'Please log in first'
      });
      return;
    }

    // Load user from database
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: req.userId } });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
        message: 'Your account could not be found'
      });
      return;
    }

    // Check if user has connected Amazon account
    if (!user.amazonUserId || !user.refreshToken) {
      res.status(403).json({
        success: false,
        error: 'Amazon authentication required',
        message: 'Please connect your Amazon Ads account to use this feature',
        authUrl: '/api/auth/amazon',
        requiresAction: 'CONNECT_AMAZON'
      });
      return;
    }

    // Check if user account is active
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        error: 'Account inactive',
        message: 'Your Amazon connection has expired. Please reconnect your account.',
        authUrl: '/api/auth/amazon',
        requiresAction: 'RECONNECT_AMAZON'
      });
      return;
    }

    // Check if token expired and refresh if needed
    if (user.tokenExpiresAt && AmazonAuthService.isTokenExpired(user.tokenExpiresAt)) {
      try {
        console.log(`🔄 Refreshing expired token for user ${user.id}...`);

        const newTokens = await AmazonAuthService.refreshAccessToken(user.refreshToken);

        // Update user with new tokens
        user.accessToken = newTokens.access_token;
        user.refreshToken = newTokens.refresh_token;
        user.tokenExpiresAt = AmazonAuthService.calculateTokenExpiry(newTokens.expires_in);
        user.lastLoginAt = new Date();
        await userRepo.save(user);

        console.log(`✅ Token refreshed successfully for user ${user.id}`);
      } catch (error: any) {
        console.error(`❌ Token refresh failed for user ${user.id}:`, error);

        // Mark user as inactive
        user.isActive = false;
        await userRepo.save(user);

        res.status(401).json({
          success: false,
          error: 'Amazon token expired',
          message: 'Your Amazon authorization has expired. Please reconnect your account.',
          authUrl: '/api/auth/amazon',
          requiresAction: 'RECONNECT_AMAZON'
        });
        return;
      }
    }

    // All checks passed
    req.user = user;
    req.amazonAuthValid = true;
    next();
  } catch (error: any) {
    console.error('Amazon auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication check failed',
      message: 'An error occurred while verifying your Amazon connection'
    });
  }
};
