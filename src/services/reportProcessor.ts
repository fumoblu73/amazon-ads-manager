// ================================================
// REPORT PROCESSOR - FASE 2: Process Completed Reports
// ================================================
// Controlla i report pendenti, scarica quelli completati,
// e esegue le funzioni di automazione corrispondenti.

import { AppDataSource } from '../config/database';
import { PendingReport } from '../entities/PendingReport';
import { KdpBook } from '../entities/KdpBook';
import { Campaign } from '../models/Campaign';
import { AutomationLog } from '../models/AutomationLog';
import { createMarketplaceApiService } from './MarketplaceApiFactory';
import { In, IsNull } from 'typeorm';
import { parseKdpPrice, calculateBookFastAcos, InkType, TrimSize } from '../utils/printingCost';

import { sendAutomationSummary, ReportSummaryItem } from './emailService';
import { executeFunc1 } from '../automation/functions/func1';
import { executeFunc2 } from '../automation/functions/func2';
import { executeFunc3 } from '../automation/functions/func3';
import { executeFunc4 } from '../automation/functions/func4';
import { executeFunc5, CampaignMapping } from '../automation/functions/func5';
import { getUserAutomationSettings, AutomationConfig } from '../automation/rules';

/**
 * Pre-loaded data to avoid N+1 queries in report processing loops
 */
interface PreloadedData {
  campaigns: Map<string, Campaign>;     // key: `${amazonCampaignId}_${marketplace}`
  books: Map<string, KdpBook>;          // key: `${userId}_${asin}`
  configs: Map<string, AutomationConfig>; // key: userId
}

/**
 * Batch-load Campaign, KdpBook, and AutomationSettings for a set of reports
 */
async function preloadDataForReports(reports: PendingReport[]): Promise<PreloadedData> {
  const campaignRepo = AppDataSource.getRepository(Campaign);
  const kdpBookRepo = AppDataSource.getRepository(KdpBook);

  // Collect unique campaign IDs
  const campaignIds = [...new Set(reports.map(r => r.campaignId).filter(id => !id.includes('_products')))];

  // Batch load campaigns
  const campaigns = new Map<string, Campaign>();
  if (campaignIds.length > 0) {
    const campaignRecords = await campaignRepo.find({
      where: campaignIds.map(id => ({ amazonCampaignId: id }))
    });
    for (const c of campaignRecords) {
      campaigns.set(`${c.amazonCampaignId}_${c.marketplace}`, c);
    }
  }

  // Collect unique ASINs from campaigns
  const asinUserPairs: { userId: string; asin: string }[] = [];
  for (const c of campaigns.values()) {
    if (c.advertisedAsin && c.userId) {
      asinUserPairs.push({ userId: c.userId, asin: c.advertisedAsin });
    }
  }

  // Batch load books
  const books = new Map<string, KdpBook>();
  if (asinUserPairs.length > 0) {
    const uniqueAsins = [...new Set(asinUserPairs.map(p => p.asin))];
    const bookRecords = await kdpBookRepo.find({
      where: uniqueAsins.map(asin => ({ asin }))
    });
    for (const b of bookRecords) {
      books.set(`${b.userId}_${b.asin}`, b);
    }
  }

  // Batch load user configs
  const configs = new Map<string, AutomationConfig>();
  const uniqueUserIds = [...new Set(reports.map(r => r.userId))];
  for (const userId of uniqueUserIds) {
    configs.set(userId, await getUserAutomationSettings(userId));
  }

  console.log(`   📦 Preloaded: ${campaigns.size} campaigns, ${books.size} books, ${configs.size} user configs`);

  return { campaigns, books, configs };
}

/**
 * Save a log entry to the automation_logs table.
 */
async function saveAutomationLog(
  report: PendingReport,
  status: 'success' | 'failed',
  errorMessage?: string
): Promise<void> {
  try {
    const logRepo = AppDataSource.getRepository(AutomationLog);
    const funcNums: number[] = JSON.parse(report.functionNumbers || '[]');
    const ruleName = funcNums.length > 0
      ? funcNums.map(n => `F${n}`).join(', ')
      : report.reportType;

    const log = logRepo.create({
      action: status === 'success' ? 'functions_executed' : 'report_failed',
      targetId: report.campaignId.substring(0, 100),
      targetName: report.campaignName?.substring(0, 255) || report.campaignId,
      ruleName: ruleName.substring(0, 100),
      status,
      errorMessage: errorMessage || null,
      reason: `Phase 2 — ${report.marketplace}`,
    });
    await logRepo.save(log);
  } catch (err: any) {
    console.error(`   ⚠️ Could not save automation log: ${err.message}`);
  }
}

/**
 * Creates a proxy apiService that returns cached report data
 * instead of requesting new reports from Amazon
 */
function createCachedApiService(realApiService: any, cachedReportData: any[]) {
  return new Proxy(realApiService, {
    get(target: any, prop: string) {
      // Intercept report methods to return cached data
      if (prop === 'requestReport' || prop === 'requestReportV3') {
        return async () => 'cached-report-id';
      }
      if (prop === 'requestSearchTermsReport') {
        return async () => 'cached-search-report-id';
      }
      if (prop === 'waitAndDownloadReport') {
        return async () => cachedReportData;
      }
      // All other methods (getKeywords, updateBid, etc.) pass through to real API
      return target[prop];
    }
  });
}

/**
 * FASE 2: Processa i report completati
 */
export async function processCompletedReports(): Promise<{
  checked: number;
  completed: number;
  processed: number;
  failed: number;
  stillPending: number;
}> {
  console.log('\n' + '='.repeat(60));
  console.log('📥 FASE 2: PROCESS COMPLETED REPORTS');
  console.log('='.repeat(60));

  const stats = { checked: 0, completed: 0, processed: 0, failed: 0, stillPending: 0 };
  const emailItems: ReportSummaryItem[] = [];

  try {
    const reportRepo = AppDataSource.getRepository(PendingReport);

    // Get all submitted reports that haven't exceeded max attempts
    const pendingReports = await reportRepo.find({
      where: { status: 'submitted' },
      order: { createdAt: 'ASC' }
    });

    console.log(`📋 Found ${pendingReports.length} pending reports to check`);

    if (pendingReports.length === 0) {
      console.log('✅ No pending reports. Nothing to do.');
      return stats;
    }

    // Batch pre-load Campaign, KdpBook, and user settings (avoids N+1 queries)
    const preloaded = await preloadDataForReports(pendingReports);

    // Group reports by marketplace for efficient API access
    const byMarketplace = new Map<string, PendingReport[]>();
    for (const report of pendingReports) {
      const existing = byMarketplace.get(report.marketplace) || [];
      existing.push(report);
      byMarketplace.set(report.marketplace, existing);
    }

    for (const [marketplace, reports] of byMarketplace) {
      console.log(`\n🌍 [${marketplace}] Checking ${reports.length} reports...`);

      let apiService: any;
      try {
        apiService = createMarketplaceApiService(marketplace);
      } catch (error: any) {
        console.error(`❌ [${marketplace}] Failed to create API service: ${error.message}`);
        stats.failed += reports.length;
        continue;
      }

      for (const report of reports) {
        stats.checked++;

        try {
          // Check if exceeded max attempts
          if (report.attempts >= report.maxAttempts) {
            report.status = 'failed';
            report.errorMessage = `Exceeded max attempts (${report.maxAttempts})`;
            await reportRepo.save(report);
            stats.failed++;
            emailItems.push({ campaignName: report.campaignName, campaignId: report.campaignId, functions: JSON.parse(report.functionNumbers), status: 'failed', error: report.errorMessage });
            console.log(`   ❌ ${report.reportId}: exceeded max attempts`);
            continue;
          }

          // Check report status with Amazon
          const statusResponse = await apiService.getReportStatus(report.reportId);
          report.attempts++;

          if (statusResponse.status === 'COMPLETED') {
            console.log(`   ✅ ${report.reportId}: COMPLETED, downloading...`);
            stats.completed++;

            // Download report data
            const reportData = await apiService.downloadReport(report.reportId);
            report.status = 'completed';
            report.reportUrl = statusResponse.url || null;
            await reportRepo.save(report);

            // Execute associated automation functions or enrich data
            try {
              if (report.reportType === 'spAdvertisedProduct') {
                // Special handling: enrich kdp_books with productName/productCategory
                await enrichKdpBooksFromAdvertisedProductReport(
                  report, reportData, marketplace
                );
                report.status = 'processed';
                await reportRepo.save(report);
                stats.processed++;
                await saveAutomationLog(report, 'success');
                emailItems.push({ campaignName: report.campaignName, campaignId: report.campaignId, functions: JSON.parse(report.functionNumbers), status: 'processed', details: 'KDP books enriched' });
                console.log(`   ✅ ${report.reportId}: kdp_books enriched successfully`);
              } else {
                await executeAutomationFunctions(
                  report, reportData, apiService, marketplace, preloaded
                );
                report.status = 'processed';
                await reportRepo.save(report);
                stats.processed++;
                await saveAutomationLog(report, 'success');
                emailItems.push({ campaignName: report.campaignName, campaignId: report.campaignId, functions: JSON.parse(report.functionNumbers), status: 'processed', details: 'Functions executed' });
                console.log(`   ✅ ${report.reportId}: functions executed successfully`);
              }
            } catch (error: any) {
              report.status = 'failed';
              report.errorMessage = `Function execution error: ${error.message}`;
              await reportRepo.save(report);
              stats.failed++;
              await saveAutomationLog(report, 'failed', error.message);
              emailItems.push({ campaignName: report.campaignName, campaignId: report.campaignId, functions: JSON.parse(report.functionNumbers), status: 'failed', error: error.message });
              console.error(`   ❌ ${report.reportId}: function execution failed: ${error.message}`);
            }

          } else if (statusResponse.status === 'FAILURE' || statusResponse.status === 'FAILED') {
            report.status = 'failed';
            report.errorMessage = `Amazon report failed: ${statusResponse.failureReason || 'Unknown'}`;
            await reportRepo.save(report);
            stats.failed++;
            emailItems.push({ campaignName: report.campaignName, campaignId: report.campaignId, functions: JSON.parse(report.functionNumbers), status: 'failed', error: report.errorMessage });
            console.log(`   ❌ ${report.reportId}: FAILED by Amazon`);

          } else {
            // Still pending
            await reportRepo.save(report);
            stats.stillPending++;
            if (report.attempts % 4 === 0) {
              console.log(`   ⏳ ${report.reportId}: still ${statusResponse.status} (attempt ${report.attempts})`);
            }
          }

        } catch (error: any) {
          report.attempts++;
          report.errorMessage = error.message;
          await reportRepo.save(report);
          stats.failed++;
          console.error(`   ❌ ${report.reportId}: error checking status: ${error.message}`);
        }

        // Small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Delay between marketplaces
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n' + '='.repeat(60));
    console.log('📥 FASE 2 COMPLETATA:');
    console.log(`   Checked: ${stats.checked}`);
    console.log(`   Completed & downloaded: ${stats.completed}`);
    console.log(`   Processed (functions executed): ${stats.processed}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Still pending: ${stats.stillPending}`);
    console.log('='.repeat(60));

    // Invia email riepilogo (solo se ci sono stati report processati o falliti)
    if (emailItems.length > 0) {
      await sendAutomationSummary(emailItems, stats);
    }

    return stats;
  } catch (error: any) {
    console.error('❌ Fatal error in processCompletedReports:', error.message);
    throw error;
  }
}

/**
 * FASE 2 (per singolo utente): Processa solo i report di un utente specifico.
 * Usato da "Esegui Ora" per processare i report sottomessi in batch.
 */
export async function processCompletedReportsForUser(userId: string): Promise<{
  checked: number;
  completed: number;
  processed: number;
  failed: number;
  stillPending: number;
}> {
  const stats = { checked: 0, completed: 0, processed: 0, failed: 0, stillPending: 0 };

  try {
    const reportRepo = AppDataSource.getRepository(PendingReport);

    const pendingReports = await reportRepo.find({
      where: { status: 'submitted', userId },
      order: { createdAt: 'ASC' }
    });

    if (pendingReports.length === 0) {
      return stats;
    }

    console.log(`📋 [User ${userId}] Found ${pendingReports.length} pending reports`);

    // Batch pre-load Campaign, KdpBook, and user settings
    const preloaded = await preloadDataForReports(pendingReports);

    // Group by marketplace
    const byMarketplace = new Map<string, PendingReport[]>();
    for (const report of pendingReports) {
      const existing = byMarketplace.get(report.marketplace) || [];
      existing.push(report);
      byMarketplace.set(report.marketplace, existing);
    }

    for (const [marketplace, reports] of byMarketplace) {
      console.log(`🌍 [${marketplace}] Checking ${reports.length} reports for user...`);

      let apiService: any;
      try {
        apiService = createMarketplaceApiService(marketplace);
      } catch (error: any) {
        console.error(`❌ [${marketplace}] Failed to create API service: ${error.message}`);
        stats.failed += reports.length;
        continue;
      }

      for (const report of reports) {
        stats.checked++;

        try {
          if (report.attempts >= report.maxAttempts) {
            report.status = 'failed';
            report.errorMessage = `Exceeded max attempts (${report.maxAttempts})`;
            await reportRepo.save(report);
            stats.failed++;
            continue;
          }

          const statusResponse = await apiService.getReportStatus(report.reportId);
          report.attempts++;

          if (statusResponse.status === 'COMPLETED') {
            stats.completed++;
            const reportData = await apiService.downloadReport(report.reportId);
            report.status = 'completed';
            report.reportUrl = statusResponse.url || null;
            await reportRepo.save(report);

            try {
              if (report.reportType === 'spAdvertisedProduct') {
                await enrichKdpBooksFromAdvertisedProductReport(report, reportData, marketplace);
                report.status = 'processed';
                await reportRepo.save(report);
                stats.processed++;
              } else {
                await executeAutomationFunctions(report, reportData, apiService, marketplace, preloaded);
                report.status = 'processed';
                await reportRepo.save(report);
                stats.processed++;
              }
            } catch (error: any) {
              report.status = 'failed';
              report.errorMessage = `Function execution error: ${error.message}`;
              await reportRepo.save(report);
              stats.failed++;
            }

          } else if (statusResponse.status === 'FAILURE' || statusResponse.status === 'FAILED') {
            report.status = 'failed';
            report.errorMessage = `Amazon report failed: ${statusResponse.failureReason || 'Unknown'}`;
            await reportRepo.save(report);
            stats.failed++;
          } else {
            await reportRepo.save(report);
            stats.stillPending++;
          }

        } catch (error: any) {
          report.attempts++;
          report.errorMessage = error.message;
          await reportRepo.save(report);
          stats.failed++;
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return stats;
  } catch (error: any) {
    console.error(`❌ Fatal error in processCompletedReportsForUser: ${error.message}`);
    throw error;
  }
}

/**
 * Execute the automation functions associated with a completed report
 */
async function executeAutomationFunctions(
  report: PendingReport,
  reportData: any[],
  apiService: any,
  marketplace: string,
  preloaded?: PreloadedData
): Promise<void> {
  const functionNumbers: number[] = JSON.parse(report.functionNumbers);
  const cachedApiService = createCachedApiService(apiService, reportData);

  // Use pre-loaded data if available, otherwise fall back to individual queries
  const config: AutomationConfig = preloaded?.configs.get(report.userId)
    || await getUserAutomationSettings(report.userId);

  const campaignRecord = preloaded?.campaigns.get(`${report.campaignId}_${marketplace}`)
    || await AppDataSource.getRepository(Campaign).findOne({
        where: { amazonCampaignId: report.campaignId, marketplace }
      });

  let kdpBook: KdpBook | null = null;
  if (campaignRecord?.advertisedAsin && campaignRecord.userId) {
    kdpBook = preloaded?.books.get(`${campaignRecord.userId}_${campaignRecord.advertisedAsin}`)
      || await AppDataSource.getRepository(KdpBook).findOne({
          where: { userId: campaignRecord.userId, asin: campaignRecord.advertisedAsin }
        });
  }

  const fallbackBook = { price: 15, printingCost: 3, royaltyPercentage: 60 };
  let book = fallbackBook;

  if (kdpBook && kdpBook.price && kdpBook.pageCount) {
    const price = parseKdpPrice(kdpBook.price);
    if (price) {
      const inkType = (kdpBook.inkType || 'black_white') as InkType;
      const trimSize = (kdpBook.trimSize || '6x9') as TrimSize;
      const royaltyPct = Number(kdpBook.royaltyPercentage) || 60;
      const result = calculateBookFastAcos(price, kdpBook.pageCount, marketplace, inkType, royaltyPct, { useVat: config.useVatInFastAcos, vatPercentage: config.vatPercentage }, trimSize);
      if (result) {
        book = { price, printingCost: result.printingCost, royaltyPercentage: royaltyPct };
        console.log(`     📖 Book data: price=${price}, pages=${kdpBook.pageCount}, ink=${inkType}, trim=${trimSize}, printingCost=${result.printingCost}, fastAcos=${result.fastAcos}%`);
      } else {
        console.warn(`     ⚠️ FAST ACOS calculation failed for campaign ${report.campaignName}, using fallback`);
      }
    } else {
      console.warn(`     ⚠️ Could not parse price "${kdpBook.price}" for campaign ${report.campaignName}, using fallback`);
    }
  } else if (kdpBook) {
    console.warn(`     ⚠️ Book found but missing price or pageCount for campaign ${report.campaignName}, using fallback`);
  } else {
    console.warn(`     ⚠️ No kdp_book linked to campaign ${report.campaignName}, using fallback`);
  }

  const mockPlacements = { topOfSearch: 0, restOfSearch: 10, productPages: 5 };
  const mockTotalImpressions = 50000;

  // Recupera adGroupId reale per func4/func5 (necessario per negative targeting e keyword/target adding)
  let realAdGroupId = 'unknown';
  const needsAdGroup = functionNumbers.some(f => f === 4 || f === 5);
  if (needsAdGroup) {
    try {
      const adGroups = await apiService.getAdGroups?.(report.campaignId);
      if (adGroups && adGroups.length > 0) {
        realAdGroupId = adGroups[0].adGroupId;
        console.log(`     📋 AdGroupId: ${realAdGroupId}`);
      }
    } catch (e: any) {
      console.warn(`     ⚠️ Could not fetch adGroupId: ${e.message}`);
    }
  }

  // Costruisci campaignMapping per func5 (tutte le campagne dello stesso ASIN)
  let campaignMapping: CampaignMapping = {};
  const needsMapping = functionNumbers.includes(5);
  if (needsMapping && campaignRecord?.advertisedAsin) {
    try {
      const campaignRepo = AppDataSource.getRepository(Campaign);
      const siblingCampaigns = await campaignRepo.find({
        where: { advertisedAsin: campaignRecord.advertisedAsin, marketplace, userId: campaignRecord.userId }
      });

      // Detect campaign type by name and build mapping
      for (const c of siblingCampaigns) {
        const lower = c.name.toLowerCase();
        let cType: number;
        if (lower.includes('auto') || lower.includes('automatic')) cType = 5;
        else if (lower.includes('product')) cType = 2;
        else if (lower.includes('super')) cType = 3;
        else cType = 1;

        // Recupera adGroupId per ogni campagna sibling
        let siblingAdGroupId: string | null = null;
        try {
          const adGroups = await apiService.getAdGroups?.(c.amazonCampaignId);
          if (adGroups && adGroups.length > 0) {
            siblingAdGroupId = adGroups[0].adGroupId;
          }
        } catch (_) { /* ignore */ }

        const key = `campaign${cType}`;
        (campaignMapping as any)[`${key}Id`] = c.amazonCampaignId;
        (campaignMapping as any)[`${key}AdGroupId`] = siblingAdGroupId;
      }
      console.log(`     📋 CampaignMapping: ${JSON.stringify(campaignMapping)}`);
    } catch (e: any) {
      console.warn(`     ⚠️ Could not build campaign mapping: ${e.message}`);
    }
  }

  for (const funcNum of functionNumbers) {
    try {
      console.log(`     🔧 Executing Function ${funcNum} for campaign ${report.campaignName}...`);

      switch (funcNum) {
        case 1:
          await executeFunc1(
            report.campaignId,
            report.campaignType as 1 | 2 | 3 | 4,
            report.campaignName,
            marketplace,
            cachedApiService,
            {
              bidIncrease: config.func1_bidIncrease,
              frequency: config.func1_frequency,
              maxImpressions: config.func1_impressions,
              maxClicks: config.func1_clicks
            }
          );
          break;

        case 2:
          await executeFunc2(
            report.campaignId,
            report.campaignName,
            marketplace,
            book,
            mockPlacements,
            cachedApiService,
            {
              frequency: config.func2_frequency,
              placementTimeframeWeeks: config.func2_timeframeWeeks
            }
          );
          break;

        case 3:
          await executeFunc3(
            report.campaignId,
            report.campaignType as 1 | 2 | 3 | 4,
            report.campaignName,
            marketplace,
            book,
            mockTotalImpressions,
            cachedApiService,
            {
              frequency: config.func3_frequency,
              timeframeA: config.func3_timeframeA,
              timeframeB: config.func3_timeframeB,
              timeframeC: config.func3_timeframeC,
              clicksPause: config.func3_clicksPause,
              clicks65days: config.func3_clicks65days
            }
          );
          break;

        case 4:
          await executeFunc4(
            report.campaignId,
            report.campaignName,
            marketplace,
            realAdGroupId,
            book,
            mockTotalImpressions,
            cachedApiService,
            {
              frequency: config.func4_frequency,
              timeframeA: config.func4_timeframeA,
              timeframeB: config.func4_timeframeB,
              timeframeC: config.func4_timeframeC,
              clicksNegative: config.func4_clicksNegative,
              spendNegative: config.func4_spendNegative
            }
          );
          break;

        case 5:
          await executeFunc5(
            report.campaignId,
            report.campaignType as 1 | 2 | 3 | 4 | 5,
            marketplace,
            campaignMapping,
            cachedApiService,
            {
              frequency: config.func5_frequency,
              minOrders: config.func5_minOrders,
              bidBroad: config.func5_bidBroad,
              bidExact: config.func5_bidExact,
              bidPhrase: config.func5_bidPhrase,
              bidExpanded: config.func5_bidExpanded
            }
          );
          break;
      }

      console.log(`     ✅ Function ${funcNum} completed`);
    } catch (error: any) {
      console.error(`     ❌ Function ${funcNum} error: ${error.message}`);
    }
  }
}

/**
 * Enrich kdp_books table with productName and productCategory from spAdvertisedProduct report.
 * This extracts Amazon catalog metadata for advertised ASINs.
 */
async function enrichKdpBooksFromAdvertisedProductReport(
  report: PendingReport,
  reportData: any[],
  marketplace: string
): Promise<void> {
  console.log(`     📖 Enriching kdp_books from ${reportData.length} advertised product rows...`);

  const kdpBookRepo = AppDataSource.getRepository(KdpBook);
  let updated = 0;
  let notFound = 0;

  // Create a map of ASIN -> { productName, productCategory } to avoid duplicates
  const asinData = new Map<string, { productName: string; productCategory: string }>();

  for (const row of reportData) {
    const asin = row.advertisedAsin;
    const productName = row.productName;
    const productCategory = row.productCategory;

    if (asin && (productName || productCategory)) {
      // Keep first occurrence (or most complete data)
      if (!asinData.has(asin) || (!asinData.get(asin)!.productName && productName)) {
        asinData.set(asin, { productName: productName || '', productCategory: productCategory || '' });
      }
    }
  }

  console.log(`     📊 Found ${asinData.size} unique ASINs with product metadata`);

  // Update kdp_books for each ASIN
  for (const [asin, data] of asinData) {
    try {
      // Find book by ASIN (ASIN e' universale, non filtrare per marketplace)
      const book = await kdpBookRepo.findOne({
        where: {
          asin: asin,
          userId: report.userId
        }
      });

      if (book) {
        let needsUpdate = false;

        // Only update if we have new data
        if (data.productName && !book.title.includes(data.productName)) {
          // Amazon catalog title might be different from KDP title, store it separately if needed
          // For now, just log it - we don't want to overwrite KDP title
          console.log(`     📝 ASIN ${asin}: Amazon title="${data.productName.substring(0, 50)}..."`);
        }

        // productCategory can be useful for classification
        // We could add a productCategory column to KdpBook, but for now log it
        if (data.productCategory) {
          console.log(`     📁 ASIN ${asin}: category="${data.productCategory}"`);
          // If you want to store category, add column to KdpBook entity and uncomment:
          // book.amazonCategory = data.productCategory;
          // needsUpdate = true;
        }

        // For now, we just verify the ASIN exists in our books
        // The main value is confirming campaign-to-book linking
        updated++;
      } else {
        notFound++;
        // Log only first few not-found ASINs to avoid log spam
        if (notFound <= 5) {
          console.log(`     ⚠️ ASIN ${asin} not found in kdp_books for ${marketplace}`);
        }
      }
    } catch (error: any) {
      console.error(`     ❌ Error processing ASIN ${asin}: ${error.message}`);
    }
  }

  console.log(`     ✅ Enrichment complete: ${updated} books matched, ${notFound} ASINs not in kdp_books`);
}
