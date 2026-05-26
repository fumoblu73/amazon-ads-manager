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
import { sendSubmitConfirmation, SubmitSummaryItem } from './emailService';

/**
 * Extracts reportId from a 425 duplicate error response.
 * Amazon returns: "The Request is a duplicate of : <reportId>"
 */
/**
 * Check if a pending report already exists to avoid duplicates.
 */
async function pendingReportExists(
  reportRepo: any, reportId: string, campaignId: string, reportType: string
): Promise<boolean> {
  const existing = await reportRepo.findOne({
    where: { reportId, campaignId, reportType, status: 'submitted' }
  });
  return !!existing;
}

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

    // Invia email conferma submit (se ci sono report)
    if (stats.reportsSubmitted > 0) {
      try {
        // Recupera i report appena creati per il riepilogo email
        const reportRepo = AppDataSource.getRepository(PendingReport);
        const recentReports = await reportRepo.find({
          where: { status: 'submitted' },
          order: { createdAt: 'DESC' },
          take: stats.reportsSubmitted
        });
        const emailItems: SubmitSummaryItem[] = recentReports.map(r => ({
          campaignName: r.campaignName,
          campaignId: r.campaignId,
          reportId: r.reportId,
          functions: JSON.parse(r.functionNumbers),
        }));
        const marketplaces = [...new Set(recentReports.map(r => r.marketplace))].join(', ');
        await sendSubmitConfirmation(emailItems, marketplaces);
      } catch (emailErr: any) {
        console.error(`📧 Errore invio email submit: ${emailErr.message}`);
      }
    }

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
          stats.reportsSubmitted += submitted.count;
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
export async function submitReportsForUser(userId: string): Promise<{ reportsSubmitted: number; errors: number }> {
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

      // Submit spAdvertisedProduct report once per marketplace (for all ASINs)
      try {
        const productReportSubmitted = await submitAdvertisedProductReport(
          userId, marketplace
        );
        stats.reportsSubmitted += productReportSubmitted;
      } catch (error: any) {
        stats.errors++;
        console.error(`❌ [${marketplace}] Error submitting advertised product report: ${error.message}`);
      }

      for (const campaign of activeCampaigns) {
        try {
          const submitted = await submitReportsForCampaign(
            userId, marketplace, campaign, apiService
          );
          stats.reportsSubmitted += submitted.count;
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
 *
 * @param restrictToFunctions - se passato, limita le funzioni considerate a questo subset.
 *   Usato da /test-function per testare una singola funzione isolata (es. [1] = solo F1).
 *   In modalità test, il frequency check viene anche saltato (perché c'è una sola funzione).
 */
export async function submitReportsForCampaign(
  userId: string,
  marketplace: string,
  campaign: any,
  apiService: any,
  dryRun: boolean = false,
  restrictToFunctions?: number[]
): Promise<{ count: number; reportIds: string[] }> {
  const campaignId = campaign.campaignId;
  const campaignName = campaign.name;
  const campaignType = determineCampaignType(campaign);
  const createdAt = getCampaignCreatedAt(campaign);
  let submitted = 0;
  const reportIds: string[] = [];

  // Skip warmup
  if (isInWarmupPeriod(createdAt)) {
    return { count: 0, reportIds: [] };
  }

  const reportRepo = AppDataSource.getRepository(PendingReport);
  const now = new Date();

  // Determine which functions should run for this campaign
  let functionsToRun: number[] = [];

  if (shouldExecuteFunc1(campaignType)) functionsToRun.push(1);
  if (shouldExecuteFunc3(campaignType)) functionsToRun.push(3);
  if (shouldExecuteFunc2(campaignType)) functionsToRun.push(2);
  if (shouldExecuteFunc4(campaignType)) functionsToRun.push(4);
  if (shouldExecuteFunc5(campaignType)) functionsToRun.push(5);

  // FIX ii: se siamo in modalità test (restrictToFunctions passato), riduci alle sole funzioni richieste
  if (restrictToFunctions && restrictToFunctions.length > 0) {
    functionsToRun = functionsToRun.filter(f => restrictToFunctions.includes(f));
    console.log(`   🧪 [TEST MODE] Funzioni ristrette a: ${functionsToRun.join(',')}`);
  }

  if (functionsToRun.length === 0) return { count: 0, reportIds: [] };

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

      // FIX bug 2: include 'sales14d' (mapped via 'sales' alias) so F2/F3/F4 read real ACoS
      // instead of always seeing 0 sales → fascia 5 → wrong placement/bid decisions
      const columns = ['impressions', 'clicks', 'cost', 'purchases14d', 'sales14d'];
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

      if (await pendingReportExists(reportRepo, reportId, campaignId, 'spTargeting')) {
        console.log(`     ⏭️ spTargeting already pending, skipping: ${reportId}`);
        if (!reportIds.includes(reportId)) reportIds.push(reportId);
      } else {
        // Se F3 è incluso, sottometti subito i 2 chunk 65gg e salvali nel record principale
        let reportId65a: string | null = null;
        let reportId65b: string | null = null;

        if (functionsToRun.includes(3)) {
          try {
            const cols65 = ['clicks', 'purchases14d'];

            // Chunk A: ultimi 30 giorni
            const start65a = new Date();
            start65a.setDate(start65a.getDate() - 30);
            const start65aStr = start65a.toISOString().split('T')[0];
            try {
              reportId65a = await apiService.requestReportV3(start65aStr, endDateStr, 'spTargeting', cols65);
            } catch (e: any) {
              const dup = extractReportIdFrom425(e);
              if (dup) { reportId65a = dup; console.log(`     ♻️ 65d-A duplicate, reusing: ${dup}`); }
              else throw e;
            }

            // Chunk B: giorni 31-65
            const start65b = new Date();
            start65b.setDate(start65b.getDate() - 65);
            const end65b = new Date();
            end65b.setDate(end65b.getDate() - 31);
            const start65bStr = start65b.toISOString().split('T')[0];
            const end65bStr = end65b.toISOString().split('T')[0];
            try {
              reportId65b = await apiService.requestReportV3(start65bStr, end65bStr, 'spTargeting', cols65);
            } catch (e: any) {
              const dup = extractReportIdFrom425(e);
              if (dup) { reportId65b = dup; console.log(`     ♻️ 65d-B duplicate, reusing: ${dup}`); }
              else throw e;
            }

            console.log(`     ✅ 65d chunks submitted: A=${reportId65a} B=${reportId65b}`);
          } catch (error: any) {
            console.warn(`     ⚠️ 65d submit failed (F3 continuerà senza dati 65gg): ${error.message}`);
            reportId65a = null;
            reportId65b = null;
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
          maxAttempts: 20,
          dryRun,
          reportId65a,
          reportId65b
        });
        await reportRepo.save(pendingReport);
        submitted++;
        reportIds.push(reportId);
        console.log(`     ✅ spTargeting report submitted: ${reportId}`);
      }
    } catch (error: any) {
      console.error(`     ❌ spTargeting submit failed: ${error.message}`);
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

      if (await pendingReportExists(reportRepo, reportId, campaignId, 'spSearchTerm')) {
        console.log(`     ⏭️ spSearchTerm already pending, skipping: ${reportId}`);
        if (!reportIds.includes(reportId)) reportIds.push(reportId);
      } else {
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
          maxAttempts: 20,
          dryRun
        });
        await reportRepo.save(pendingReport);
        submitted++;
        reportIds.push(reportId);
        console.log(`     ✅ spSearchTerm report submitted: ${reportId}`);
      }
    } catch (error: any) {
      console.error(`     ❌ spSearchTerm submit failed: ${error.message}`);
    }
  }

  return { count: submitted, reportIds };
}

/**
 * Submit spAdvertisedProduct report once per marketplace
 * This report provides productName and productCategory for all advertised ASINs
 * Used to enrich kdp_books table with Amazon catalog metadata
 */
async function submitAdvertisedProductReport(
  userId: string,
  marketplace: string
): Promise<number> {
  const reportRepo = AppDataSource.getRepository(PendingReport);
  const now = new Date();

  // Use last 14 days for advertised product report
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 14);
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = now.toISOString().split('T')[0];

  try {
    let reportId: string;
    try {
      const userApiService = createUserAmazonApiService(userId, marketplace);
      reportId = await userApiService.requestAdvertisedProductReport(startDateStr, endDateStr);
    } catch (submitError: any) {
      const duplicateId = extractReportIdFrom425(submitError);
      if (duplicateId) {
        reportId = duplicateId;
        console.log(`     ♻️ spAdvertisedProduct duplicate, reusing: ${reportId}`);
      } else {
        throw submitError;
      }
    }

    // Check if already submitted (use 'global' as campaignId for marketplace-level reports)
    if (await pendingReportExists(reportRepo, reportId, `${marketplace}_products`, 'spAdvertisedProduct')) {
      console.log(`     ⏭️ spAdvertisedProduct already pending for ${marketplace}, skipping: ${reportId}`);
      return 0;
    }

    const pendingReport = reportRepo.create({
      userId,
      marketplace,
      campaignId: `${marketplace}_products`, // Special ID for marketplace-level report
      campaignName: `All Advertised Products (${marketplace})`,
      campaignType: 0, // 0 = special report, not a campaign
      reportId,
      reportType: 'spAdvertisedProduct',
      columns: JSON.stringify([
        'advertisedAsin', 'advertisedSku', 'campaignId', 'campaignName',
        'adGroupId', 'adGroupName', 'productName', 'productCategory',
        'impressions', 'clicks', 'cost', 'purchases14d', 'sales14d'
      ]),
      startDate: startDateStr,
      endDate: endDateStr,
      status: 'submitted',
      functionNumbers: JSON.stringify([]), // No automation functions, just enrichment
      attempts: 0,
      maxAttempts: 20
    });

    await reportRepo.save(pendingReport);
    console.log(`     ✅ spAdvertisedProduct report submitted for ${marketplace}: ${reportId}`);
    return 1;
  } catch (error: any) {
    console.warn(`     ⚠️ spAdvertisedProduct submit skipped for ${marketplace}: ${error.message}`);
    return 0;
  }
}
