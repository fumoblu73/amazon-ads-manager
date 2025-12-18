// ================================================
// USER AMAZON API FACTORY
// ================================================
// Helper to create UserAmazonApiService instances

import { UserAmazonApiService } from './UserAmazonApiService';

/**
 * Creates a new UserAmazonApiService instance for the specified user
 * @param userId - The user ID to create the service for
 * @returns A new UserAmazonApiService instance
 */
export function createUserAmazonApiService(userId: string): UserAmazonApiService {
  return new UserAmazonApiService(userId);
}
