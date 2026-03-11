// ================================================
// SPEND CACHE SERVICE
// ================================================
// Gestisce il popolamento di book_spend_cache tramite report spTargeting.
// Usato da:
//   - refresh-spend (submit) + collect-spend (collect) per tutti i giorni
//   - processCompletedReports (Option C+) per Lun/Mer/Ven

import { AppDataSource } from '../config/database';
import { PendingReport } from '../entities/PendingReport';
import { User } from '../entities/User';
import { createMarketplaceApiService, isMarketplaceConfigured } from './MarketplaceApiFactory';

export const SPEND_CACHE_REPORT_TYPE = 'spSpendCache';
const SPEND_CACHE_COLUMNS = ['campaignId', 'cost', 'sales14d', 'impressions', 'clicks'];
const MARKETPLACES = ['US', 'CA', 'UK', 'DE', 'FR', 'IT', 'ES', 'AU'];

// ================================================
// Submit: invia report spTargeting 7d per ogni marketplace
// Salva i reportId in pending_reports (status=submitted)
// ================================================
export async function submitSpendCacheReports(): Promise<{ submitted: number; errors: number }> {
  const end = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  console.log(`\n💰 [Spend Cache] Submit report spesa ${start} → ${end}`);

  const reportRepo = AppDataSource.getRepository(PendingReport);
  const userRepo = AppDataSource.getRepository(User);
  const users = await userRepo.find({ where: { isActive: true } });

  let submitted = 0;
  let errors = 0;

  for (const marketplace of MARKETPLACES) {
    if (!isMarketplaceConfigured(marketplace)) continue;

    try {
      const apiService = createMarketplaceApiService(marketplace);
      const reportId = await apiService.requestReportV3(
        start, end, 'spTargeting', SPEND_CACHE_COLUMNS
      );

      for (const user of users) {
        // Evita duplicati per stesso reportId + user
        const existing = await reportRepo.findOne({
          where: { reportId, userId: user.id, reportType: SPEND_CACHE_REPORT_TYPE }
        });
        if (existing) continue;

        const pending = reportRepo.create({
          userId: user.id,
          marketplace,
          campaignId: 'SPEND_CACHE',
          campaignName: 'Spend Cache Update',
          campaignType: 0,
          reportId,
          reportType: SPEND_CACHE_REPORT_TYPE,
          columns: JSON.stringify(SPEND_CACHE_COLUMNS),
          startDate: start,
          endDate: end,
          status: 'submitted',
          functionNumbers: JSON.stringify([]),
          attempts: 0,
          maxAttempts: 20
        });
        await reportRepo.save(pending);
        submitted++;
      }
      console.log(`   ✅ [Spend Cache] ${marketplace}: report ${reportId} sottomesso`);
    } catch (e: any) {
      console.error(`   ❌ [Spend Cache] ${marketplace}: submit fallito: ${e.message}`);
      errors++;
    }
  }

  console.log(`💰 [Spend Cache] Submit completato: ${submitted} report, ${errors} errori`);
  return { submitted, errors };
}

// ================================================
// Collect: controlla i pending spSpendCache e aggiorna book_spend_cache
// Chiamato da collect-spend endpoint (tutti i giorni) e da processCompletedReports (Lun/Mer/Ven)
// ================================================
export async function collectSpendCacheReports(): Promise<{ processed: number; pending: number; failed: number }> {
  const reportRepo = AppDataSource.getRepository(PendingReport);
  const pendingReports = await reportRepo.find({
    where: { reportType: SPEND_CACHE_REPORT_TYPE, status: 'submitted' },
    order: { createdAt: 'ASC' }
  });

  if (pendingReports.length === 0) {
    console.log('💰 [Spend Cache] Nessun report spesa pendente');
    return { processed: 0, pending: 0, failed: 0 };
  }

  console.log(`\n💰 [Spend Cache] Collect: ${pendingReports.length} report da controllare`);
  const stats = { processed: 0, pending: 0, failed: 0 };

  for (const report of pendingReports) {
    try {
      const apiService = createMarketplaceApiService(report.marketplace);
      const statusResponse = await apiService.getReportStatus(report.reportId);
      report.attempts++;

      if (statusResponse.status === 'COMPLETED') {
        const data = await apiService.downloadReport(report.reportId);
        await updateSpendCacheFromReportData(data, report.marketplace, report.userId);
        report.status = 'processed';
        report.reportUrl = statusResponse.url || null;
        stats.processed++;
        console.log(`   ✅ [Spend Cache] ${report.marketplace}: book_spend_cache aggiornato`);
      } else if (statusResponse.status === 'FAILURE' || statusResponse.status === 'FAILED') {
        report.status = 'failed';
        report.errorMessage = 'Amazon report failed';
        stats.failed++;
        console.error(`   ❌ [Spend Cache] ${report.marketplace}: report fallito`);
      } else if (report.attempts >= report.maxAttempts) {
        report.status = 'failed';
        report.errorMessage = `Max attempts (${report.maxAttempts}) superato`;
        stats.failed++;
        console.error(`   ❌ [Spend Cache] ${report.marketplace}: max attempts superato`);
      } else {
        stats.pending++;
        console.log(`   ⏳ [Spend Cache] ${report.marketplace}: ancora PENDING (${report.attempts}/${report.maxAttempts})`);
      }

      await reportRepo.save(report);
    } catch (e: any) {
      console.error(`   ❌ [Spend Cache] Errore ${report.marketplace}: ${e.message}`);
      stats.failed++;
    }
  }

  console.log(`💰 [Spend Cache] Collect completato: ${stats.processed} ok, ${stats.pending} pending, ${stats.failed} falliti`);
  return stats;
}

// ================================================
// Aggrega reportData per ASIN e aggiorna book_spend_cache
// ================================================
export async function updateSpendCacheFromReportData(
  reportData: any[],
  marketplace: string,
  userId: string
): Promise<void> {
  if (!reportData.length) return;

  // Aggrega per campaignId
  const byCampaign = new Map<string, { spend: number; sales: number; impressions: number; clicks: number }>();
  for (const row of reportData) {
    const cid = String(row.campaignId || '');
    if (!cid) continue;
    const existing = byCampaign.get(cid) || { spend: 0, sales: 0, impressions: 0, clicks: 0 };
    byCampaign.set(cid, {
      spend: existing.spend + (parseFloat(row.cost) || 0),
      sales: existing.sales + (parseFloat(row.sales14d) || 0),
      impressions: existing.impressions + (parseInt(row.impressions) || 0),
      clicks: existing.clicks + (parseInt(row.clicks) || 0),
    });
  }

  if (!byCampaign.size) return;

  // Mappa campaignId → advertised_asin dal DB
  const campaignIds = [...byCampaign.keys()];
  const campaigns: Array<{ amazon_campaign_id: string; advertised_asin: string }> =
    await AppDataSource.query(
      `SELECT amazon_campaign_id, advertised_asin
       FROM campaigns
       WHERE user_id = $1 AND marketplace = $2
         AND amazon_campaign_id = ANY($3)
         AND advertised_asin IS NOT NULL`,
      [userId, marketplace, campaignIds]
    );

  // Aggrega per ASIN
  const byAsin = new Map<string, { spend: number; sales: number; impressions: number; clicks: number }>();
  for (const c of campaigns) {
    const data = byCampaign.get(c.amazon_campaign_id);
    if (!data) continue;
    const existing = byAsin.get(c.advertised_asin) || { spend: 0, sales: 0, impressions: 0, clicks: 0 };
    byAsin.set(c.advertised_asin, {
      spend: existing.spend + data.spend,
      sales: existing.sales + data.sales,
      impressions: existing.impressions + data.impressions,
      clicks: existing.clicks + data.clicks,
    });
  }

  if (!byAsin.size) {
    console.log(`   ⚠️ [Spend Cache] ${marketplace}: nessun ASIN trovato nelle campagne`);
    return;
  }

  // Upsert in book_spend_cache
  for (const [asin, data] of byAsin) {
    await AppDataSource.query(
      `INSERT INTO book_spend_cache (user_id, marketplace, asin, ad_type, spend_7d, sales_7d, impressions_7d, clicks_7d, updated_at)
       VALUES ($1, $2, $3, 'SP', $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id, marketplace, asin, ad_type)
       DO UPDATE SET
         spend_7d = EXCLUDED.spend_7d,
         sales_7d = EXCLUDED.sales_7d,
         impressions_7d = EXCLUDED.impressions_7d,
         clicks_7d = EXCLUDED.clicks_7d,
         updated_at = NOW()`,
      [userId, marketplace, asin, data.spend, data.sales, data.impressions, data.clicks]
    );
  }

  // Aggiorna totali aggregati sull'utente
  const userRepo = AppDataSource.getRepository(User);
  const [cacheTotal] = await AppDataSource.query(
    `SELECT COALESCE(SUM(spend_7d), 0)::float AS total_spend,
            COALESCE(SUM(sales_7d), 0)::float AS total_sales
     FROM book_spend_cache WHERE user_id = $1`,
    [userId]
  );
  await userRepo.update(userId, {
    spendCache7d: parseFloat(cacheTotal.total_spend),
    salesCache7d: parseFloat(cacheTotal.total_sales),
    spendCacheUpdatedAt: new Date()
  });

  console.log(`   💰 [Spend Cache] ${marketplace}: ${byAsin.size} ASIN aggiornati`);
}
