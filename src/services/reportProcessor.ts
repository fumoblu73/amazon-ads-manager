// ================================================
// REPORT PROCESSOR - FASE 2: Process Completed Reports
// ================================================
// Controlla i report pendenti, scarica quelli completati,
// e esegue le funzioni di automazione corrispondenti.

import { AppDataSource } from '../config/database';
import { PendingReport } from '../entities/PendingReport';
import { KdpBook } from '../entities/KdpBook';
import { Campaign } from '../models/Campaign';
import { createMarketplaceApiService } from './MarketplaceApiFactory';
import { In, IsNull } from 'typeorm';
import { parseKdpPrice, calculateBookFastAcos, InkType, TrimSize } from '../utils/printingCost';

import { executeFunc1 } from '../automation/functions/func1';
import { executeFunc2 } from '../automation/functions/func2';
import { executeFunc3 } from '../automation/functions/func3';
import { executeFunc4 } from '../automation/functions/func4';
import { executeFunc5, CampaignMapping } from '../automation/functions/func5';

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
                console.log(`   ✅ ${report.reportId}: kdp_books enriched successfully`);
              } else {
                await executeAutomationFunctions(
                  report, reportData, apiService, marketplace
                );
                report.status = 'processed';
                await reportRepo.save(report);
                stats.processed++;
                console.log(`   ✅ ${report.reportId}: functions executed successfully`);
              }
            } catch (error: any) {
              report.status = 'failed';
              report.errorMessage = `Function execution error: ${error.message}`;
              await reportRepo.save(report);
              stats.failed++;
              console.error(`   ❌ ${report.reportId}: function execution failed: ${error.message}`);
            }

          } else if (statusResponse.status === 'FAILURE' || statusResponse.status === 'FAILED') {
            report.status = 'failed';
            report.errorMessage = `Amazon report failed: ${statusResponse.failureReason || 'Unknown'}`;
            await reportRepo.save(report);
            stats.failed++;
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

    return stats;
  } catch (error: any) {
    console.error('❌ Fatal error in processCompletedReports:', error.message);
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
  marketplace: string
): Promise<void> {
  const functionNumbers: number[] = JSON.parse(report.functionNumbers);
  const cachedApiService = createCachedApiService(apiService, reportData);

  // Load real book data from kdp_books via Campaign.advertisedAsin
  const fallbackBook = { price: 15, printingCost: 3, royaltyPercentage: 60 };
  let book = fallbackBook;

  try {
    const kdpBookRepo = AppDataSource.getRepository(KdpBook);
    const campaignRepo = AppDataSource.getRepository(Campaign);

    // Find Campaign record by amazonCampaignId to get advertisedAsin
    const campaignRecord = await campaignRepo.findOne({
      where: { amazonCampaignId: report.campaignId, marketplace }
    });

    let kdpBook: KdpBook | null = null;
    if (campaignRecord?.advertisedAsin && campaignRecord.userId) {
      kdpBook = await kdpBookRepo.findOne({
        where: { userId: campaignRecord.userId, asin: campaignRecord.advertisedAsin }
      });
    }

    if (kdpBook && kdpBook.price && kdpBook.pageCount) {
      const price = parseKdpPrice(kdpBook.price);
      if (price) {
        const inkType = (kdpBook.inkType || 'black_white') as InkType;
        const trimSize = (kdpBook.trimSize || '6x9') as TrimSize;
        const royaltyPct = Number(kdpBook.royaltyPercentage) || 60;
        const result = calculateBookFastAcos(price, kdpBook.pageCount, marketplace, inkType, royaltyPct, { useVat: true, vatPercentage: 22 }, trimSize);
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
  } catch (err: any) {
    console.warn(`     ⚠️ Error loading book data for campaign ${report.campaignName}: ${err.message}, using fallback`);
  }

  const mockPlacements = { topOfSearch: 0, restOfSearch: 10, productPages: 5 };
  const mockTotalImpressions = 50000;
  const mockAdGroupId = 'mock-adgroup-id';

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
            { bidIncrease: 0.02, frequency: 3, maxImpressions: 20, maxClicks: 0 }
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
            { frequency: 7, placementTimeframeWeeks: 4 }
          );
          break;

        case 3:
          // F3 needs both the current report AND the 65-day report
          // If this is the main report, F3 will use it; the 65d report
          // will be fetched when its own PendingReport is processed
          await executeFunc3(
            report.campaignId,
            report.campaignType as 1 | 2 | 3 | 4,
            report.campaignName,
            marketplace,
            book,
            mockTotalImpressions,
            cachedApiService,
            { frequency: 3, timeframeA: 2000, timeframeB: 3000, timeframeC: 5000, clicksPause: 10, clicks65days: 30 }
          );
          break;

        case 4:
          await executeFunc4(
            report.campaignId,
            report.campaignName,
            marketplace,
            mockAdGroupId,
            book,
            mockTotalImpressions,
            cachedApiService,
            { frequency: 7, timeframeA: 1000, timeframeB: 3000, timeframeC: 5000, clicksNegative: 10, spendNegative: 10 }
          );
          break;

        case 5:
          // F5 needs search terms report
          const mockCampaignMapping: CampaignMapping = {
            campaign5Id: report.campaignId,
            campaign5AdGroupId: mockAdGroupId
          };

          await executeFunc5(
            report.campaignId,
            report.campaignType as 1 | 2 | 3 | 4 | 5,
            marketplace,
            mockCampaignMapping,
            cachedApiService,
            { frequency: 7, minOrders: 1, bidBroad: 0.30, bidExact: 0.50, bidPhrase: 0.40, bidExpanded: 0.30 }
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
      // Find book by ASIN and marketplace (for the user who owns this report)
      const book = await kdpBookRepo.findOne({
        where: {
          asin: asin,
          marketplace: marketplace.toUpperCase(),
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
