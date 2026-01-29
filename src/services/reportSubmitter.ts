// ================================================
// REPORT SUBMITTER - FASE 1: Submit Reports
// ================================================
// Sottomette le richieste report ad Amazon API v3
// e salva i reportId nella tabella pending_reports.
// Non aspetta il completamento dei report.

import { AppDataSource } from '../config/database';
import { PendingReport } from '../entities/PendingReport';
import { User } from '../entities/User';
import { AutomationSettings } from '../entities/AutomationSettings';
import { createMarketplaceApiService, getConfiguredMarketplaces } from './MarketplaceApiFactory';
import { createUserAmazonApiService } from './UserAmazonApiFactory';
import { isInWarmupPeriod, getCampaignCreatedAt, formatDateForAmazon } from '../utils/timeframe';
import { automationScheduler } from '../automation/scheduler';

/**
 * Extracts reportId from a 425 duplicate error response.
 * Amazon returns: "The Request is a duplicate of : <reportId>"
 */
function extractReportIdFrom425(error: any): string | null {
  try {
    const detail = error?.response?.data?.detail || error?.message || '';
    const match = detail.match(/duplicate of\s*:\s*(.+)$/i);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}
import { shouldExecuteFunc1 } from '../automation/functions/func1';
import { shouldExecuteFunc2 } from '../automation/functions/func2';
import { shouldExecuteFunc3 } from '../automation/functions/func3';
import { shouldExecuteFunc4 } from '../automation/functions/func4';
import { shouldExecuteFunc5 } from '../automation/functions/func5';
import { IsNull, Not } from 'typeorm';

/**
 * Determina il tipo di campagna (1-5) in base al nome
 */
function determineCampaignType(campaign: any): 1 | 2 | 3 | 4 | 5 {
  const name = campaign.name.toLowerCase();
  if (name.includes('auto') || name.includes('automatic')) return 5;
  if (name.includes('super') && name.includes('keyword')) return 3;
  if (name.includes('super') && name.includes('product')) return 4;
  if (name.includes('product')) return 2;
  return 1;
}

/**
 * FASE 1: Sottomette i report per tutti gli utenti attivi
 */
export async function submitReportsForAllUsers(): Promise<{
  usersProcessed: number;
  reportsSubmitted: number;
  errors: number;
}> {
  console.log('\n' + '='.repeat(60));
  console.log('📤 FASE 1: SUBMIT REPORTS');
  console.log('='.repeat(60));

  const stats = { usersProcessed: 0, reportsSubmitted: 0, errors: 0 };

  try {
    const userRepo = AppDataSource.getRepository(User);
    const users = await userRepo.find({
      where: { isActive: true, amazonUserId: Not(IsNull()) }
    });

    console.log(`👥 Found ${users.length} active users with Amazon auth`);

    if (users.length === 0) {
      console.log('⚠️  No active users. Using global credentials...');
      const globalStats = await submitReportsGlobal();
      return { ...stats, ...globalStats };
    }

    for (const user of users) {
      try {
        console.log(`\n👤 Processing user: ${user.email} (${user.id})`);
        const userStats = await submitReportsForUser(user.id);
        stats.reportsSubmitted += userStats.reportsSubmitted;
        stats.errors += userStats.errors;
        stats.usersProcessed++;
      } catch (error: any) {
        stats.errors++;
        console.error(`❌ Error for user ${user.email}: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📤 FASE 1 COMPLETATA: ${stats.reportsSubmitted} report sottomessi, ${stats.errors} errori`);
    console.log('='.repeat(60));

    return stats;
  } catch (error: any) {
    console.error('❌ Fatal error in submitReportsForAllUsers:', error.message);
    throw error;
  }
}

/**
 * Submit reports using global (env var) credentials
 */
async function submitReportsGlobal(): Promise<{ reportsSubmitted: number; errors: number }> {
  const stats = { reportsSubmitted: 0, errors: 0 };
  const configuredMarketplaces = getConfiguredMarketplaces();

  for (const marketplace of configuredMarketplaces) {
    try {
      const apiService = createMarketplaceApiService(marketplace);
      const campaigns = await apiService.getCampaigns();
      const activeCampaigns = campaigns.filter((c: any) =>
        c.state === 'enabled' || c.state === 'ENABLED'
      );

      console.log(`🌍 [${marketplace}] ${activeCampaigns.length} active campaigns`);

      for (const campaign of activeCampaigns) {
        try {
          const submitted = await submitReportsForCampaign(
            'global', marketplace, campaign, apiService
          );
          stats.reportsSubmitted += submitted;
        } catch (error: any) {
          stats.errors++;
          console.error(`❌ [${marketplace}] Error campaign ${campaign.name}: ${error.message}`);
        }
      }
    } catch (error: any) {
      stats.errors++;
      console.error(`❌ [${marketplace}] Marketplace error: ${error.message}`);
    }
  }

  return stats;
}

/**
 * Submit reports for a specific user across all marketplaces
 */
async function submitReportsForUser(userId: string): Promise<{ reportsSubmitted: number; errors: number }> {
  const stats = { reportsSubmitted: 0, errors: 0 };
  const configuredMarketplaces = getConfiguredMarketplaces();

  for (const marketplace of configuredMarketplaces) {
    try {
      const apiService = createMarketplaceApiService(marketplace);
      const campaigns = await apiService.getCampaigns();
      const activeCampaigns = campaigns.filter((c: any) =>
        c.state === 'enabled' || c.state === 'ENABLED'
      );

      console.log(`🌍 [${marketplace}] ${activeCampaigns.length} active campaigns`);

      for (const campaign of activeCampaigns) {
        try {
          const submitted = await submitReportsForCampaign(
            userId, marketplace, campaign, apiService
          );
          stats.reportsSubmitted += submitted;
        } catch (error: any) {
          stats.errors++;
          console.error(`❌ [${marketplace}] Error campaign ${campaign.name}: ${error.message}`);
        }
      }

      // Delay tra marketplace per rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      stats.errors++;
      console.error(`❌ [${marketplace}] Marketplace error: ${error.message}`);
    }
  }

  return stats;
}

/**
 * Submit needed reports for a single campaign
 * Returns number of reports submitted
 */
async function submitReportsForCampaign(
  userId: string,
  marketplace: string,
  campaign: any,
  apiService: any
): Promise<number> {
  const campaignId = campaign.campaignId;
  const campaignName = campaign.name;
  const campaignType = determineCampaignType(campaign);
  const createdAt = getCampaignCreatedAt(campaign);
  let submitted = 0;

  // Skip warmup
  if (isInWarmupPeriod(createdAt)) {
    return 0;
  }

  const reportRepo = AppDataSource.getRepository(PendingReport);
  const now = new Date();

  // Determine which functions should run for this campaign
  const functionsToRun: number[] = [];

  if (shouldExecuteFunc1(campaignType)) functionsToRun.push(1);
  if (shouldExecuteFunc3(campaignType)) functionsToRun.push(3);
  if (shouldExecuteFunc2(campaignType)) functionsToRun.push(2);
  if (shouldExecuteFunc4(campaignType)) functionsToRun.push(4);
  if (shouldExecuteFunc5(campaignType)) functionsToRun.push(5);

  if (functionsToRun.length === 0) return 0;

  console.log(`   📢 ${campaignName} (tipo ${campaignType}): funzioni ${functionsToRun.join(',')}`);

  // === REPORT 1: spTargeting (needed by F1, F2, F3, F4) ===
  const needsSpTargeting = functionsToRun.some(f => [1, 2, 3, 4].includes(f));
  if (needsSpTargeting) {
    try {
      // Use longest timeframe needed: F2 needs 28 days, F3 dynamic, F1 needs 3 days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 28); // 4 weeks covers all
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = now.toISOString().split('T')[0];

      const columns = ['impressions', 'clicks', 'cost', 'purchases14d'];
      let reportId: string;
      try {
        reportId = await apiService.requestReportV3(
          startDateStr, endDateStr, 'spTargeting', columns
        );
      } catch (submitError: any) {
        const duplicateId = extractReportIdFrom425(submitError);
        if (duplicateId) {
          reportId = duplicateId;
          console.log(`     ♻️ spTargeting duplicate, reusing: ${reportId}`);
        } else {
          throw submitError;
        }
      }

      const pendingReport = reportRepo.create({
        userId,
        marketplace,
        campaignId,
        campaignName,
        campaignType,
        reportId,
        reportType: 'spTargeting',
        columns: JSON.stringify(columns),
        startDate: startDateStr,
        endDate: endDateStr,
        status: 'submitted',
        functionNumbers: JSON.stringify(functionsToRun.filter(f => [1, 2, 3, 4].includes(f))),
        attempts: 0,
        maxAttempts: 20
      });
      await reportRepo.save(pendingReport);
      submitted++;
      console.log(`     ✅ spTargeting report submitted: ${reportId}`);
    } catch (error: any) {
      console.error(`     ❌ spTargeting submit failed: ${error.message}`);
    }
  }

  // === REPORT 2: spTargeting 65 days (needed by F3 for pause check) ===
  if (functionsToRun.includes(3)) {
    try {
      const startDate65 = new Date();
      startDate65.setDate(startDate65.getDate() - 31); // Amazon API v3 max range is 31 days
      const startDateStr = startDate65.toISOString().split('T')[0];
      const endDateStr = now.toISOString().split('T')[0];

      const columns = ['clicks', 'purchases14d'];
      let reportId: string;
      try {
        reportId = await apiService.requestReportV3(
          startDateStr, endDateStr, 'spTargeting', columns
        );
      } catch (submitError: any) {
        const duplicateId = extractReportIdFrom425(submitError);
        if (duplicateId) {
          reportId = duplicateId;
          console.log(`     ♻️ spTargeting_31d duplicate, reusing: ${reportId}`);
        } else {
          throw submitError;
        }
      }

      const pendingReport = reportRepo.create({
        userId,
        marketplace,
        campaignId,
        campaignName,
        campaignType,
        reportId,
        reportType: 'spTargeting_65d',
        columns: JSON.stringify(columns),
        startDate: startDateStr,
        endDate: endDateStr,
        status: 'submitted',
        functionNumbers: JSON.stringify([3]),
        attempts: 0,
        maxAttempts: 20
      });
      await reportRepo.save(pendingReport);
      submitted++;
      console.log(`     ✅ spTargeting 65d report submitted: ${reportId}`);
    } catch (error: any) {
      console.error(`     ❌ spTargeting 65d submit failed: ${error.message}`);
    }
  }

  // === REPORT 3: spSearchTerm (needed by F4 and F5) ===
  const needsSearchTerm = functionsToRun.some(f => [4, 5].includes(f));
  if (needsSearchTerm) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = now.toISOString().split('T')[0];

      let reportId: string;
      try {
        reportId = await apiService.requestSearchTermsReport(startDateStr, endDateStr, campaignId);
      } catch (submitError: any) {
        const duplicateId = extractReportIdFrom425(submitError);
        if (duplicateId) {
          reportId = duplicateId;
          console.log(`     ♻️ spSearchTerm duplicate, reusing: ${reportId}`);
        } else {
          throw submitError;
        }
      }

      const pendingReport = reportRepo.create({
        userId,
        marketplace,
        campaignId,
        campaignName,
        campaignType,
        reportId,
        reportType: 'spSearchTerm',
        columns: JSON.stringify(['searchTerm', 'impressions', 'clicks', 'cost', 'purchases14d']),
        startDate: startDateStr,
        endDate: endDateStr,
        status: 'submitted',
        functionNumbers: JSON.stringify(functionsToRun.filter(f => [4, 5].includes(f))),
        attempts: 0,
        maxAttempts: 20
      });
      await reportRepo.save(pendingReport);
      submitted++;
      console.log(`     ✅ spSearchTerm report submitted: ${reportId}`);
    } catch (error: any) {
      console.error(`     ❌ spSearchTerm submit failed: ${error.message}`);
    }
  }

  return submitted;
}
