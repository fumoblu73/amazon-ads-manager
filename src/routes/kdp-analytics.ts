import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { KdpDailyStats } from '../models/KdpDailyStats';
import { KdpBook } from '../entities/KdpBook';
import { KdpSalesSnapshot } from '../entities/KdpSalesSnapshot';
import { Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import {
  getMockDashboardSummary,
  getMockHistoricalStats,
  getMockBookStats,
  getMockCountryStats,
  getMockMonthComparison
} from '../utils/mock-kdp-data';
import { authMiddleware } from '../middleware/auth';
import { MonthlyAdsSpend } from '../entities/MonthlyAdsSpend';
import { KdpDailyStats as KdpDailyStatsEntity } from '../entities/KdpDailyStats';
import { AutomationSettings } from '../entities/AutomationSettings';

const router = Router();
const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true';

// Extended Request interface with userId
interface AuthRequest extends Request {
  userId?: string;
  // Explicitly include Express Request properties for TypeScript compatibility
  query: any;
  body: any;
  params: any;
}

// Helper function to get date range - DEFAULT: 1st of current month to today
const getDateRange = (startDate?: string, endDate?: string) => {
  const now = new Date();
  const end = endDate ? new Date(endDate) : now;

  // Default start: first day of current month
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = startDate ? new Date(startDate) : defaultStart;

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
};

// Helper function to get previous month range
const getPreviousMonthRange = () => {
  const now = new Date();
  const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  return {
    startDate: firstDayPrevMonth.toISOString().split('T')[0],
    endDate: lastDayPrevMonth.toISOString().split('T')[0],
    monthLabel: firstDayPrevMonth.toLocaleDateString('en-US', { month: 'short' })
  };
};

// Helper function to get current month range (1st to today)
const getCurrentMonthRange = () => {
  const now = new Date();
  const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    startDate: firstDayCurrentMonth.toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0],
    monthLabel: now.toLocaleDateString('en-US', { month: 'short' })
  };
};

// Helper to calculate percentage change
const calculatePercentChange = (current: number, previous: number): number | null => {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
};

// Helper to format currency
const formatCurrency = (value: number): string => {
  return value.toFixed(2);
};

// ================================================
// GET /api/kdp/dashboard/summary - Dashboard principale (Publisher Champ style)
// ================================================
router.get('/dashboard/summary', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Return mock data if enabled
    if (USE_MOCK_DATA) {
      return res.json(getMockDashboardSummary());
    }

    const userId = req.userId;
    const statsRepository = AppDataSource.getRepository(KdpDailyStats);
    const bookRepository = AppDataSource.getRepository(KdpBook);
    const snapshotRepository = AppDataSource.getRepository(KdpSalesSnapshot);

    // Get dynamic date ranges
    const currentMonth = getCurrentMonthRange();
    const previousMonth = getPreviousMonthRange();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Helper to get stats for a date range
    const getStatsForRange = async (start: string, end: string) => {
      const stats = await statsRepository
        .createQueryBuilder('stats')
        .select('SUM(stats.grossRoyalties)', 'totalGrossRoyalties')
        .addSelect('SUM(stats.spending)', 'totalSpending')
        .addSelect('SUM(stats.netRoyalties)', 'totalNetRoyalties')
        .addSelect('SUM(stats.paidUnits)', 'totalPaidUnits')
        .addSelect('SUM(stats.freeUnits)', 'totalFreeUnits')
        .addSelect('SUM(stats.kenpReads)', 'totalKenpReads')
        .where('stats.userId = :userId', { userId })
        .andWhere('stats.date BETWEEN :start AND :end', { start, end })
        .getRawOne();

      return {
        grossRoyalties: parseFloat(stats?.totalGrossRoyalties || 0),
        spending: parseFloat(stats?.totalSpending || 0),
        netRoyalties: parseFloat(stats?.totalNetRoyalties || 0),
        paidUnits: parseInt(stats?.totalPaidUnits || 0),
        freeUnits: parseInt(stats?.totalFreeUnits || 0),
        kenpReads: parseInt(stats?.totalKenpReads || 0),
        printOrders: 0,
        digitalOrders: 0
      };
    };

    // Helper to get stats for a single day
    const getStatsForDay = async (date: string) => {
      const stats = await statsRepository.findOne({
        where: { userId, date }
      });
      // Sum per-book digital/print orders from kdp_daily_stats
      const perBookRepo = AppDataSource.getRepository(KdpDailyStatsEntity);
      const perBook = await perBookRepo
        .createQueryBuilder('s')
        .innerJoin('kdp_books', 'b', 'b.id = s.book_id AND b.user_id = :userId', { userId })
        .select('SUM(s.ebook_sales)', 'digitalOrders')
        .addSelect('SUM(s.paperback_sales + s.hardcover_sales)', 'printOrders')
        .where('s.date = :date', { date })
        .getRawOne();
      return {
        grossRoyalties: stats ? parseFloat(stats.grossRoyalties.toString()) : 0,
        spending: stats ? parseFloat(stats.spending.toString()) : 0,
        netRoyalties: stats ? parseFloat(stats.netRoyalties.toString()) : 0,
        paidUnits: stats ? parseInt(stats.paidUnits.toString()) : 0,
        kenpReads: stats ? parseInt(stats.kenpReads.toString()) : 0,
        digitalOrders: parseInt(perBook?.digitalOrders || 0),
        printOrders: parseInt(perBook?.printOrders || 0)
      };
    };

    // Get stats for current and previous month
    let currentMonthStats = await getStatsForRange(currentMonth.startDate, currentMonth.endDate);
    let previousMonthStats = await getStatsForRange(previousMonth.startDate, previousMonth.endDate);

    // Get stats for today and yesterday
    let todayStats = await getStatsForDay(today);
    let yesterdayStats = await getStatsForDay(yesterday);

    // Get latest snapshot for fallback data
    const latestSnapshot = await snapshotRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' }
    });

    let topEarnersToday: any[] = [];

    // If we have snapshot data and no KdpDailyStats, use snapshot
    if (latestSnapshot) {
      // Build historical data map for easy lookup
      const historicalMap = new Map<string, any>();
      if (latestSnapshot.historicalMonths && latestSnapshot.historicalMonths.length > 0) {
        latestSnapshot.historicalMonths.forEach((hm: any) => {
          historicalMap.set(hm.month, hm);
        });
      }

      // Use snapshot data for current month if KdpDailyStats is empty
      if (currentMonthStats.grossRoyalties === 0) {
        const currentMonthKey = currentMonth.startDate.substring(0, 7); // YYYY-MM
        const currentMonthHistorical = historicalMap.get(currentMonthKey);

        if (currentMonthHistorical) {
          const gross = currentMonthHistorical.totalRoyalties || 0;
          currentMonthStats = {
            grossRoyalties: gross,
            spending: currentMonthStats.spending,
            netRoyalties: gross - currentMonthStats.spending,
            paidUnits: (currentMonthHistorical.printOrders || 0) + (currentMonthHistorical.digitalOrders || 0),
            freeUnits: 0,
            kenpReads: currentMonthHistorical.kenpRead || 0,
            printOrders: currentMonthHistorical.printOrders || 0,
            digitalOrders: currentMonthHistorical.digitalOrders || 0
          };
        } else if (latestSnapshot.totalRoyalties) {
          const gross = parseFloat(latestSnapshot.totalRoyalties.toString());
          currentMonthStats = {
            grossRoyalties: gross,
            spending: currentMonthStats.spending,
            netRoyalties: gross - currentMonthStats.spending,
            paidUnits: (latestSnapshot.printOrders || 0) + (latestSnapshot.digitalOrders || 0),
            freeUnits: 0,
            kenpReads: latestSnapshot.kenpRead || 0,
            printOrders: latestSnapshot.printOrders || 0,
            digitalOrders: latestSnapshot.digitalOrders || 0
          };
        }
      }

      // Use historical months for previous month stats if available
      if (previousMonthStats.grossRoyalties === 0) {
        const prevMonthKey = previousMonth.startDate.substring(0, 7); // YYYY-MM
        const prevMonthData = historicalMap.get(prevMonthKey);

        if (prevMonthData) {
          const prevGross = prevMonthData.totalRoyalties || 0;
          previousMonthStats = {
            grossRoyalties: prevGross,
            spending: previousMonthStats.spending,
            netRoyalties: prevGross - previousMonthStats.spending,
            paidUnits: (prevMonthData.printOrders || 0) + (prevMonthData.digitalOrders || 0),
            freeUnits: 0,
            kenpReads: prevMonthData.kenpRead || 0,
            printOrders: prevMonthData.printOrders || 0,
            digitalOrders: prevMonthData.digitalOrders || 0
          };
        }
      }

      // Use top titles from snapshot
      if (latestSnapshot.topTitles && latestSnapshot.topTitles.length > 0) {
        topEarnersToday = latestSnapshot.topTitles.map((t: any) => ({
          bookId: t.asin,
          asin: t.asin,
          title: t.title || 'Unknown',
          royalties: t.royalties || 0,
          spending: 0,
          coverUrl: null,
          bsrRank: null
        }));
      }
    }

    // Get monthly ADS spend from monthly_ads_spend + book_spend_cache (more reliable than kdp_daily_stats.spending)
    const currentYm = currentMonth.startDate.slice(0, 7);  // 'YYYY-MM'
    const previousYm = previousMonth.startDate.slice(0, 7);
    let currentMonthSpend = 0;
    let previousMonthSpend = 0;
    try {
      // monthly_ads_spend has month-to-date spend (updated by process-reports Mon/Wed/Fri)
      const spendRows: Array<{ year_month: string; total: string }> = await AppDataSource.query(`
        SELECT year_month, SUM(total_spend)::float AS total
        FROM monthly_ads_spend
        WHERE user_id = $1 AND year_month IN ($2, $3)
        GROUP BY year_month
      `, [userId, currentYm, previousYm]);
      for (const row of spendRows) {
        if (row.year_month === currentYm) currentMonthSpend = parseFloat(row.total || '0');
        if (row.year_month === previousYm) previousMonthSpend = parseFloat(row.total || '0');
      }
    } catch (e) {
      console.warn('[Dashboard] monthly spend query failed:', e);
    }

    // Fetch VAT percentage from AutomationSettings
    const automationSettingsRepo = AppDataSource.getRepository(AutomationSettings);
    const automationSettings = await automationSettingsRepo.findOne({ where: { userId } });
    const vatPercentage = automationSettings?.vatPercentage ? Number(automationSettings.vatPercentage) : 22;

    // Helper: ROI adjusted for VAT on ADS spend
    const calcVatROI = (royalties: number, spend: number): number | null => {
      if (spend <= 0) return null;
      const vatAdjustedSpend = spend * (1 + vatPercentage / 100);
      return (royalties / vatAdjustedSpend) * 100;
    };

    // calcGrossSales placeholder — replaced by per-book async queries below
    const calcGrossSales = (_p: number, _d: number) => null as number | null;

    // Calculate ROI/ACOS for current month
    const currentROI = currentMonthSpend > 0
      ? ((currentMonthStats.netRoyalties / currentMonthSpend) * 100) : null;
    const currentACoS = currentMonthStats.grossRoyalties > 0 && currentMonthSpend > 0
      ? ((currentMonthSpend / currentMonthStats.grossRoyalties) * 100) : null;

    // Calculate ROI/ACOS for previous month
    const previousROI = previousMonthSpend > 0
      ? ((previousMonthStats.netRoyalties / previousMonthSpend) * 100) : null;
    const previousACoS = previousMonthStats.grossRoyalties > 0 && previousMonthSpend > 0
      ? ((previousMonthSpend / previousMonthStats.grossRoyalties) * 100) : null;

    // Calculate ROI/ACOS for today
    const todayROI = todayStats.spending > 0
      ? ((todayStats.netRoyalties / todayStats.spending) * 100) : null;
    const todayACoS = todayStats.grossRoyalties > 0 && todayStats.spending > 0
      ? ((todayStats.spending / todayStats.grossRoyalties) * 100) : null;

    // Calculate ROI/ACOS for yesterday
    const yesterdayROI = yesterdayStats.spending > 0
      ? ((yesterdayStats.netRoyalties / yesterdayStats.spending) * 100) : null;
    const yesterdayACoS = yesterdayStats.grossRoyalties > 0 && yesterdayStats.spending > 0
      ? ((yesterdayStats.spending / yesterdayStats.grossRoyalties) * 100) : null;

    // Get top earners from KdpDailyStats if not from snapshot
    if (topEarnersToday.length === 0) {
      const topToday = await statsRepository
        .createQueryBuilder('stats')
        .select('stats.asin', 'asin')
        .addSelect('SUM(stats.grossRoyalties)', 'royalties')
        .addSelect('SUM(stats.spending)', 'spending')
        .where('stats.userId = :userId', { userId })
        .andWhere('stats.date BETWEEN :start AND :end', {
          start: currentMonth.startDate,
          end: currentMonth.endDate
        })
        .andWhere('stats.asin IS NOT NULL')
        .groupBy('stats.asin')
        .orderBy('SUM(stats.grossRoyalties)', 'DESC')
        .limit(10)
        .getRawMany();

      for (const item of topToday) {
        const book = await bookRepository.findOne({
          where: { asin: item.asin, userId }
        });
        topEarnersToday.push({
          bookId: item.asin,
          asin: item.asin,
          title: book?.title || 'Unknown',
          royalties: parseFloat(item.royalties || 0),
          spending: parseFloat(item.spending || 0),
          coverUrl: book?.coverUrl || null,
          bsrRank: book?.bsrRank || null
        });
      }
    }

    // Get top earners for previous month
    const topEarnersPrevMonth: any[] = [];
    const topPrevMonth = await statsRepository
      .createQueryBuilder('stats')
      .select('stats.asin', 'asin')
      .addSelect('SUM(stats.grossRoyalties)', 'royalties')
      .addSelect('SUM(stats.spending)', 'spending')
      .where('stats.userId = :userId', { userId })
      .andWhere('stats.date BETWEEN :start AND :end', {
        start: previousMonth.startDate,
        end: previousMonth.endDate
      })
      .andWhere('stats.asin IS NOT NULL')
      .groupBy('stats.asin')
      .orderBy('SUM(stats.grossRoyalties)', 'DESC')
      .limit(10)
      .getRawMany();

    for (const item of topPrevMonth) {
      const book = await bookRepository.findOne({
        where: { asin: item.asin, userId }
      });
      topEarnersPrevMonth.push({
        bookId: item.asin,
        asin: item.asin,
        title: book?.title || 'Unknown',
        royalties: parseFloat(item.royalties || 0),
        spending: parseFloat(item.spending || 0),
        coverUrl: book?.coverUrl || null,
        bsrRank: book?.bsrRank || null
      });
    }

    // Get monthly chart data for the last 12 months (Publisher Champ style)
    const monthlyChartData: Array<{month: string; label: string; royalties: number; spending: number}> = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

      const monthStats = await statsRepository
        .createQueryBuilder('stats')
        .select('SUM(stats.grossRoyalties)', 'royalties')
        .addSelect('SUM(stats.spending)', 'spending')
        .where('stats.userId = :userId', { userId })
        .andWhere('stats.date BETWEEN :start AND :end', {
          start: monthStart.toISOString().split('T')[0],
          end: monthEnd.toISOString().split('T')[0]
        })
        .getRawOne();

      monthlyChartData.push({
        month: monthStart.toISOString().split('T')[0],
        label: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        royalties: parseFloat(monthStats?.royalties || 0),
        spending: parseFloat(monthStats?.spending || 0)
      });
    }

    // If we have snapshot with historical months, use it to fill in chart data
    if (latestSnapshot) {
      // Use historicalMonths from snapshot if available
      if (latestSnapshot.historicalMonths && latestSnapshot.historicalMonths.length > 0) {
        // Map historical months by month key (YYYY-MM)
        const historicalMap = new Map();
        latestSnapshot.historicalMonths.forEach((hm: any) => {
          historicalMap.set(hm.month, hm);
        });

        // Update chart data with historical values
        monthlyChartData.forEach(chartMonth => {
          const monthKey = chartMonth.month.substring(0, 7); // YYYY-MM
          const historicalData = historicalMap.get(monthKey);
          if (historicalData && chartMonth.royalties === 0) {
            chartMonth.royalties = historicalData.totalRoyalties || 0;
            chartMonth.spending = 0; // Historical snapshot data doesn't include ADS spend
          }
        });
      }

      // Fallback: use current month data from snapshot
      const lastMonthData = monthlyChartData[monthlyChartData.length - 1];
      if (lastMonthData.royalties === 0 && latestSnapshot.totalRoyalties) {
        lastMonthData.royalties = parseFloat(latestSnapshot.totalRoyalties.toString());
        lastMonthData.spending = 0;
      }
    }

    // Get daily chart data for the last 60 days
    const daily60Start = new Date();
    daily60Start.setDate(daily60Start.getDate() - 59);
    const daily60StartStr = daily60Start.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    const dailyChartRaw = await statsRepository
      .createQueryBuilder('stats')
      .select('stats.date', 'date')
      .addSelect('SUM(stats.grossRoyalties)', 'royalties')
      .addSelect('SUM(stats.spending)', 'spending')
      .where('stats.userId = :userId', { userId })
      .andWhere('stats.date BETWEEN :start AND :end', { start: daily60StartStr, end: todayStr })
      .groupBy('stats.date')
      .orderBy('stats.date', 'ASC')
      .getRawMany();

    const dailyChartData = dailyChartRaw.map((row: any) => ({
      date: row.date,
      label: formatDateShort(row.date),
      royalties: parseFloat(row.royalties || 0),
      spending: parseFloat(row.spending || 0)
    }));

    // Get ADS spend per marketplace:
    // - Historical months: from monthly_ads_spend table
    // - Current month: from book_spend_cache (7d rolling, more accurate)
    const currentYm2 = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const spendByMarketplace: Record<string, Array<{ yearMonth: string; spend: number }>> = {};
    try {
      // Historical spend from monthly_ads_spend
      const histSpendRows: Array<{ marketplace: string; year_month: string; spend: string }> = await AppDataSource.query(`
        SELECT marketplace, year_month, total_spend::float AS spend
        FROM monthly_ads_spend
        WHERE user_id = $1 AND total_spend > 0
        ORDER BY year_month ASC
      `, [userId]);
      for (const row of histSpendRows) {
        const mp = (row.marketplace || '').toUpperCase();
        const ym = row.year_month;
        if (mp && ym) {
          if (!spendByMarketplace[mp]) spendByMarketplace[mp] = [];
          spendByMarketplace[mp].push({ yearMonth: ym, spend: parseFloat(row.spend || '0') });
        }
      }
      // Current month spend from book_spend_cache (overrides monthly_ads_spend for current month)
      const cacheRows: Array<{ marketplace: string; spend: string }> = await AppDataSource.query(`
        SELECT marketplace, SUM(spend_7d)::float AS spend
        FROM book_spend_cache
        WHERE user_id = $1 AND spend_7d > 0
        GROUP BY marketplace
      `, [userId]);
      for (const row of cacheRows) {
        const mp = (row.marketplace || '').toUpperCase();
        if (mp) {
          if (!spendByMarketplace[mp]) spendByMarketplace[mp] = [];
          // Replace current month entry if exists, otherwise push
          const idx = spendByMarketplace[mp].findIndex(e => e.yearMonth === currentYm2);
          const entry = { yearMonth: currentYm2, spend: parseFloat(row.spend || '0') };
          if (idx >= 0) spendByMarketplace[mp][idx] = entry;
          else spendByMarketplace[mp].push(entry);
        }
      }
    } catch (e) {
      console.warn('[Dashboard] spend query failed:', e);
    }

    // Build per-marketplace monthly chart:
    // - Net royalties estimated via historicalMonths total × marketplace % (from latest snapshot.marketplaceData)
    // - ADS spend from book_spend_cache (7d rolling, mapped to current month; historical months show spend=0)
    // - 'ALL' view: exact net royalties (historicalMonths total - combined spend) + combined spend
    const chartByMarketplace: Record<string, Array<{ yearMonth: string; label: string; royalties: number; spend: number }>> = {};

    // historicalMonths fallback (for 'ALL' chart when monthly_royalties has gaps)
    const histRoyMap = new Map<string, number>();
    if (latestSnapshot?.historicalMonths?.length > 0) {
      latestSnapshot.historicalMonths.forEach((hm: any) => histRoyMap.set(hm.month, hm.totalRoyalties || 0));
    }

    // Per-marketplace royalties from monthly_royalties table (exact, per month)
    const royByMarketplace: Record<string, Map<string, number>> = {};
    try {
      const royRows: Array<{ marketplace: string; year_month: string; royalties: string }> = await AppDataSource.query(`
        SELECT marketplace, year_month, royalties::float AS royalties
        FROM monthly_royalties
        WHERE user_id = $1 AND royalties > 0
        ORDER BY year_month ASC
      `, [userId]);
      for (const row of royRows) {
        const mp = (row.marketplace || '').toUpperCase();
        if (!royByMarketplace[mp]) royByMarketplace[mp] = new Map();
        royByMarketplace[mp].set(row.year_month, parseFloat(row.royalties || '0'));
      }
    } catch (e) {
      console.warn('[Dashboard] monthly_royalties query failed:', e);
    }

    // Build allRoyMap: sum per-marketplace royalties by month; fallback to histRoyMap for missing months
    const allRoyMap = new Map<string, number>();
    for (const rMap of Object.values(royByMarketplace)) {
      for (const [ym, r] of rMap.entries()) {
        allRoyMap.set(ym, (allRoyMap.get(ym) || 0) + r);
      }
    }
    for (const [ym, r] of histRoyMap.entries()) {
      if (!allRoyMap.has(ym)) allRoyMap.set(ym, r); // fallback only where monthly_royalties has no data
    }

    // Build per-marketplace charts using exact royalties from monthly_royalties
    const globalAllSpendMap = new Map<string, number>();
    for (const entries of Object.values(spendByMarketplace)) {
      for (const e of entries) globalAllSpendMap.set(e.yearMonth, (globalAllSpendMap.get(e.yearMonth) || 0) + e.spend);
    }
    // globalMonths for per-marketplace: only months from actual monthly_royalties + ADS spend
    // (excludes histRoyMap-only months like current month before KDP sync, avoiding misleading 0-bars)
    const globalRoyMonths = new Set<string>();
    for (const rMap of Object.values(royByMarketplace)) {
      for (const ym of rMap.keys()) globalRoyMonths.add(ym);
    }
    const globalMonths = new Set([...globalAllSpendMap.keys(), ...globalRoyMonths]);
    // globalMonthsAll for ALL chart: also includes histRoyMap fallback months (e.g. current month from snapshot)
    const globalMonthsAll = new Set([...globalMonths, ...allRoyMap.keys()]);

    const allMarketplaces = new Set([...Object.keys(spendByMarketplace), ...Object.keys(royByMarketplace)]);
    for (const mp of allMarketplaces) {
      const spMap = new Map((spendByMarketplace[mp] || []).map(s => [s.yearMonth, s.spend]));
      const rMap = royByMarketplace[mp] || new Map<string, number>();
      chartByMarketplace[mp] = [...globalMonths].sort().map(ym => {
        const gross = rMap.get(ym) || 0;
        const spend = spMap.get(ym) || 0;
        return {
          yearMonth: ym,
          label: new Date(ym + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          royalties: gross,  // gross KDP royalties (independent bar, not net of ADS)
          spend
        };
      });
    }

    // Build 'ALL' combined view — uses globalMonthsAll (includes histRoyMap fallback months)
    if (globalMonthsAll.size > 0) {
      chartByMarketplace['ALL'] = [...globalMonthsAll].sort().map(ym => {
          const totalSpend = globalAllSpendMap.get(ym) || 0;
          const grossRoy = allRoyMap.get(ym) || 0;
          return {
            yearMonth: ym,
            label: new Date(ym + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            royalties: grossRoy,  // gross KDP royalties (independent bar, not net of ADS)
            spend: totalSpend
          };
      });
    }

    // Count live paperback books only
    const totalLiveBooks = await bookRepository.count({
      where: { userId, format: 'Paperback' }
    });

    // Parse price string handling both "." and "," as decimal separator
    const parsePrice = (priceStr: string | null | undefined): number => {
      if (!priceStr) return 0;
      // Remove currency symbols/text, replace comma decimal separator with dot
      const cleaned = priceStr.replace(/[^0-9.,]/g, '').replace(',', '.');
      return parseFloat(cleaned) || 0;
    };

    // Per-book gross sales for a date range using kdp_daily_stats JOIN kdp_books
    // Returns null if no per-book data found for the period (→ show "ND" in UI)
    const calcPerBookGrossSales = async (start: string, end: string): Promise<number | null> => {
      const perBookRepo = AppDataSource.getRepository(KdpDailyStatsEntity);
      const rows = await perBookRepo
        .createQueryBuilder('ds')
        .innerJoin('kdp_books', 'b', 'b.id = ds.book_id AND b.user_id = :userId', { userId })
        .select('SUM(ds.paperback_sales + ds.hardcover_sales)', 'printSales')
        .addSelect('SUM(ds.ebook_sales)', 'ebookSales')
        .addSelect('b.price', 'printPrice')
        .addSelect('b.ebook_price', 'ebookPrice')
        .where('ds.date BETWEEN :start AND :end', { start, end })
        .groupBy('b.id')
        .addGroupBy('b.price')
        .addGroupBy('b.ebook_price')
        .getRawMany();

      if (!rows || rows.length === 0) return null;

      let total = 0;
      for (const row of rows) {
        const pp = parsePrice(row.printPrice);
        const ep = parsePrice(row.ebookPrice);
        total += (parseInt(row.printSales || 0) * pp) + (parseInt(row.ebookSales || 0) * ep);
      }
      return total;
    };

    // Compute gross sales for current month, previous month, today, yesterday
    const [currentMonthGrossSales, previousMonthGrossSales, todayGrossSales, yesterdayGrossSales] =
      await Promise.all([
        calcPerBookGrossSales(currentMonth.startDate, currentMonth.endDate),
        calcPerBookGrossSales(previousMonth.startDate, previousMonth.endDate),
        calcPerBookGrossSales(today, today),
        calcPerBookGrossSales(yesterday, yesterday),
      ]);

    // Legacy: used only for widgets card (kept for backward compat)
    const paperbackBooks = await bookRepository.find({ where: { userId, format: 'Paperback' } });
    let printPrice = 0;
    let ebookPrice = 0;
    for (const book of paperbackBooks) {
      if (printPrice === 0 && book.price) { const p = parsePrice(book.price); if (p > 0) printPrice = p; }
      if (ebookPrice === 0 && book.ebookPrice) { const p = parsePrice(book.ebookPrice); if (p > 0) ebookPrice = p; }
      if (printPrice > 0 && ebookPrice > 0) break;
    }
    const grossSalesEstimate = currentMonthGrossSales ??
      ((printPrice * (currentMonthStats.printOrders || 0)) + (ebookPrice * (currentMonthStats.digitalOrders || 0)));

    // Calculate days in current month so far
    const daysInCurrentMonth = Math.ceil(
      (new Date(currentMonth.endDate).getTime() - new Date(currentMonth.startDate).getTime())
      / (1000 * 60 * 60 * 24)
    ) + 1;

    // Calculate daily averages
    const dailyAvgGross = daysInCurrentMonth > 0 ? currentMonthStats.grossRoyalties / daysInCurrentMonth : 0;
    const dailyAvgNet = daysInCurrentMonth > 0 ? currentMonthStats.netRoyalties / daysInCurrentMonth : 0;

    // Calculate estimated projection for full month
    const daysInFullMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0
    ).getDate();
    const projectedGross = dailyAvgGross * daysInFullMonth;

    // Build response in Publisher Champ style
    const summary = {
      // Dynamic period (1st of month → today)
      period: {
        startDate: currentMonth.startDate,
        endDate: currentMonth.endDate,
        label: `${currentMonth.monthLabel} 1st → ${currentMonth.monthLabel} ${new Date().getDate()}${getOrdinalSuffix(new Date().getDate())}`
      },

      // Overall Monthly Stats (Previous Month vs Current Month)
      overall: {
        monthlyStats: {
          previousMonth: {
            label: previousMonth.monthLabel,
            adOrders: previousMonthStats.paidUnits,
            paperbacks: previousMonthStats.printOrders || 0,
            digitalOrders: previousMonthStats.digitalOrders || 0,
            reads: previousMonthStats.kenpReads || 0,
            grossSales: previousMonthGrossSales,
            grossRoyalties: previousMonthStats.grossRoyalties,
            spending: previousMonthSpend,
            netRoyalties: previousMonthStats.netRoyalties,
            overallROI: previousROI,
            vatROI: calcVatROI(previousMonthStats.netRoyalties, previousMonthSpend),
            amsROI: previousROI,
            amsACoS: previousACoS
          },
          currentMonth: {
            label: currentMonth.monthLabel,
            adOrders: currentMonthStats.paidUnits,
            paperbacks: currentMonthStats.printOrders || 0,
            digitalOrders: currentMonthStats.digitalOrders || 0,
            reads: currentMonthStats.kenpReads || 0,
            grossSales: currentMonthGrossSales,
            grossRoyalties: currentMonthStats.grossRoyalties,
            spending: currentMonthSpend,
            netRoyalties: currentMonthStats.netRoyalties,
            overallROI: currentROI,
            vatROI: calcVatROI(currentMonthStats.netRoyalties, currentMonthSpend),
            amsROI: currentROI,
            amsACoS: currentACoS
          },
          change: {
            adOrders: calculatePercentChange(currentMonthStats.paidUnits, previousMonthStats.paidUnits),
            paperbacks: calculatePercentChange(currentMonthStats.printOrders || 0, previousMonthStats.printOrders || 0),
            digitalOrders: calculatePercentChange(currentMonthStats.digitalOrders || 0, previousMonthStats.digitalOrders || 0),
            reads: calculatePercentChange(currentMonthStats.kenpReads || 0, previousMonthStats.kenpReads || 0),
            grossSales: (currentMonthGrossSales !== null && previousMonthGrossSales !== null) ? calculatePercentChange(currentMonthGrossSales, previousMonthGrossSales) : null,
            grossRoyalties: calculatePercentChange(currentMonthStats.grossRoyalties, previousMonthStats.grossRoyalties),
            spending: calculatePercentChange(currentMonthSpend, previousMonthSpend),
            netRoyalties: calculatePercentChange(currentMonthStats.netRoyalties, previousMonthStats.netRoyalties)
          }
        },

        // Overall Daily Stats (Yesterday vs Today)
        dailyStats: {
          yesterday: {
            label: formatDateShort(yesterday),
            adOrders: yesterdayStats.paidUnits,
            paperbacks: yesterdayStats.printOrders || 0,
            digitalOrders: yesterdayStats.digitalOrders || 0,
            reads: yesterdayStats.kenpReads || 0,
            grossSales: yesterdayGrossSales,
            grossRoyalties: yesterdayStats.grossRoyalties,
            spending: yesterdayStats.spending,
            netRoyalties: yesterdayStats.netRoyalties,
            overallROI: yesterdayROI,
            vatROI: calcVatROI(yesterdayStats.netRoyalties, yesterdayStats.spending),
            amsROI: yesterdayROI,
            amsACoS: yesterdayACoS
          },
          today: {
            label: formatDateShort(today),
            adOrders: todayStats.paidUnits,
            paperbacks: todayStats.printOrders || 0,
            digitalOrders: todayStats.digitalOrders || 0,
            reads: todayStats.kenpReads || 0,
            grossSales: todayGrossSales,
            grossRoyalties: todayStats.grossRoyalties,
            spending: todayStats.spending,
            netRoyalties: todayStats.netRoyalties,
            overallROI: todayROI,
            vatROI: calcVatROI(todayStats.netRoyalties, todayStats.spending),
            amsROI: todayROI,
            amsACoS: todayACoS
          },
          change: {
            adOrders: calculatePercentChange(todayStats.paidUnits, yesterdayStats.paidUnits),
            paperbacks: calculatePercentChange(todayStats.printOrders || 0, yesterdayStats.printOrders || 0),
            digitalOrders: calculatePercentChange(todayStats.digitalOrders || 0, yesterdayStats.digitalOrders || 0),
            reads: calculatePercentChange(todayStats.kenpReads || 0, yesterdayStats.kenpReads || 0),
            grossSales: (todayGrossSales !== null && yesterdayGrossSales !== null) ? calculatePercentChange(todayGrossSales, yesterdayGrossSales) : null,
            grossRoyalties: calculatePercentChange(todayStats.grossRoyalties, yesterdayStats.grossRoyalties),
            spending: calculatePercentChange(todayStats.spending, yesterdayStats.spending),
            netRoyalties: calculatePercentChange(todayStats.netRoyalties, yesterdayStats.netRoyalties)
          }
        }
      },

      // Widgets
      widgets: {
        grossRoyaltiesEstimator: currentMonthStats.grossRoyalties,
        netRoyaltiesThisMonth: currentMonthStats.netRoyalties,
        grossSalesEstimate,
        todayNetRoyalties: todayStats.netRoyalties,
        yesterdayNetRoyalties: yesterdayStats.netRoyalties,
        kenpReadsThisMonth: currentMonthStats.kenpReads,
        totalLiveBooks: totalLiveBooks || 0,
        dailyAvgGrossRoyalties: dailyAvgGross,
        dailyAvgNetRoyalties: dailyAvgNet,
        estimatedProjection: projectedGross,
        bookSalesThisMonth: currentMonthStats.paidUnits,
        // Organic = digital orders, Inorganic = ad orders (from spending > 0)
        organicOrders: currentMonthStats.digitalOrders || 0,
        inorganicOrders: currentMonthStats.printOrders || 0,
        preOrders: 0, // Pre-orders not tracked in current schema
        // Additional widgets for percentage changes
        royaltiesChange: calculatePercentChange(currentMonthStats.grossRoyalties, previousMonthStats.grossRoyalties),
        ordersChange: calculatePercentChange(currentMonthStats.paidUnits, previousMonthStats.paidUnits)
      },

      // Top Earners (Previous Month vs Current Month)
      topEarners: {
        previousMonth: topEarnersPrevMonth,
        currentMonth: topEarnersToday
      },

      // Chart data
      charts: {
        monthly: {
          label: 'Monthly Performance',
          data: monthlyChartData
        },
        daily: {
          label: 'Daily Performance (60d)',
          data: dailyChartData
        },
        byMarketplace: chartByMarketplace
      },

      // Snapshot info for debugging
      snapshotInfo: latestSnapshot ? {
        id: latestSnapshot.id,
        createdAt: latestSnapshot.createdAt,
        source: latestSnapshot.source,
        currency: latestSnapshot.currency,
        totalRoyalties: latestSnapshot.totalRoyalties,
        printOrders: latestSnapshot.printOrders,
        digitalOrders: latestSnapshot.digitalOrders
      } : null
    };

    res.json(summary);
  } catch (error: any) {
    console.error('❌ Errore GET /api/kdp/dashboard/summary:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero del dashboard',
      details: error.message
    });
  }
});

// Helper to get ordinal suffix (1st, 2nd, 3rd, etc.)
function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

// Helper to format date as DD/MM
function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

// ================================================
// GET /api/kdp/analytics/historical - Statistiche storiche
// ================================================
router.get('/analytics/historical', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Return mock data if enabled
    if (USE_MOCK_DATA) {
      return res.json(getMockHistoricalStats());
    }

    const userId = req.userId;
    const { startDate, endDate } = getDateRange(
      req.query.startDate as string,
      req.query.endDate as string
    );

    const statsRepository = AppDataSource.getRepository(KdpDailyStats);
    const bookRepository = AppDataSource.getRepository(KdpBook);
    const snapshotRepository = AppDataSource.getRepository(KdpSalesSnapshot);

    // Get aggregate stats for period from KdpDailyStats
    const aggregateStats = await statsRepository
      .createQueryBuilder('stats')
      .select('SUM(stats.grossRoyalties)', 'totalGrossRoyalties')
      .addSelect('SUM(stats.spending)', 'totalSpending')
      .addSelect('SUM(stats.netRoyalties)', 'totalNetRoyalties')
      .addSelect('SUM(stats.paidUnits)', 'totalPaidUnits')
      .addSelect('SUM(stats.freeUnits)', 'totalFreeUnits')
      .where('stats.userId = :userId', { userId })
      .andWhere('stats.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getRawOne();

    // Get chart data (daily aggregates)
    let chartData = await statsRepository
      .createQueryBuilder('stats')
      .select('stats.date', 'date')
      .addSelect('SUM(stats.grossRoyalties)', 'royalties')
      .addSelect('SUM(stats.spending)', 'spending')
      .where('stats.userId = :userId', { userId })
      .andWhere('stats.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('stats.date')
      .orderBy('stats.date', 'ASC')
      .getRawMany();

    let formattedChartData = chartData.map(row => ({
      date: row.date,
      royalties: parseFloat(row.royalties || 0),
      spending: parseFloat(row.spending || 0)
    }));

    // Get book-level stats
    const bookStats = await statsRepository
      .createQueryBuilder('stats')
      .select('stats.asin', 'asin')
      .addSelect('SUM(stats.grossRoyalties)', 'grossRoyalties')
      .addSelect('SUM(stats.spending)', 'spending')
      .addSelect('SUM(stats.netRoyalties)', 'netRoyalties')
      .where('stats.userId = :userId', { userId })
      .andWhere('stats.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('stats.asin IS NOT NULL')
      .groupBy('stats.asin')
      .orderBy('SUM(stats.grossRoyalties)', 'DESC')
      .getRawMany();

    let books: any[] = [];
    for (const stat of bookStats) {
      const book = await bookRepository.findOne({
        where: { asin: stat.asin, userId }
      });
      books.push({
        asin: stat.asin,
        title: book?.title || 'Unknown',
        cover: book?.coverUrl || undefined,
        grossRoyalties: parseFloat(stat.grossRoyalties || 0),
        spending: parseFloat(stat.spending || 0),
        netRoyalties: parseFloat(stat.netRoyalties || 0)
      });
    }

    // Initialize summary with KdpDailyStats data
    let summary = {
      totalGrossRoyalties: parseFloat(aggregateStats?.totalGrossRoyalties || 0),
      totalSpending: parseFloat(aggregateStats?.totalSpending || 0),
      totalNetRoyalties: parseFloat(aggregateStats?.totalNetRoyalties || 0),
      totalPaidUnits: parseInt(aggregateStats?.totalPaidUnits || 0),
      totalFreeUnits: parseInt(aggregateStats?.totalFreeUnits || 0)
    };

    // If no data in KdpDailyStats, try to get from latest snapshot
    const latestSnapshot = await snapshotRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' }
    });

    if (summary.totalGrossRoyalties === 0 && latestSnapshot) {
      // Calculate totals from historicalMonths if available
      if (latestSnapshot.historicalMonths && latestSnapshot.historicalMonths.length > 0) {
        let totalRoyalties = 0;
        let totalOrders = 0;
        let totalReads = 0;

        latestSnapshot.historicalMonths.forEach((hm: any) => {
          totalRoyalties += hm.totalRoyalties || 0;
          totalOrders += (hm.printOrders || 0) + (hm.digitalOrders || 0);
          totalReads += hm.kenpRead || 0;
        });

        summary = {
          totalGrossRoyalties: totalRoyalties,
          totalSpending: 0,
          totalNetRoyalties: totalRoyalties,
          totalPaidUnits: totalOrders,
          totalFreeUnits: 0
        };

        // Build monthly chart data from historicalMonths
        formattedChartData = latestSnapshot.historicalMonths.map((hm: any) => ({
          date: `${hm.month}-01`,
          label: hm.label,
          royalties: hm.totalRoyalties || 0,
          spending: 0,
          orders: (hm.printOrders || 0) + (hm.digitalOrders || 0),
          reads: hm.kenpRead || 0
        })).reverse(); // Oldest first
      } else {
        // Fallback to current month data
        summary = {
          totalGrossRoyalties: parseFloat(latestSnapshot.totalRoyalties?.toString() || '0'),
          totalSpending: 0,
          totalNetRoyalties: parseFloat(latestSnapshot.totalRoyalties?.toString() || '0'),
          totalPaidUnits: (latestSnapshot.printOrders || 0) + (latestSnapshot.digitalOrders || 0),
          totalFreeUnits: 0
        };
      }

      // Use topTitles from snapshot for books
      if (latestSnapshot.topTitles && latestSnapshot.topTitles.length > 0) {
        books = latestSnapshot.topTitles.map((t: any) => ({
          asin: t.asin,
          title: t.title || 'Unknown',
          grossRoyalties: t.royalties || 0,
          spending: 0,
          netRoyalties: t.royalties || 0
        }));
      }
    }

    // Find best month
    let bestMonth = null;
    if (formattedChartData.length > 0) {
      const best = formattedChartData.reduce((max: any, curr: any) =>
        (curr.royalties || 0) > (max.royalties || 0) ? curr : max
      );
      bestMonth = best.date?.substring(0, 7);
    }

    const response = {
      period: { startDate, endDate },
      summary,
      chartData: formattedChartData,
      books,
      bestMonth
    };

    res.json(response);
  } catch (error: any) {
    console.error('❌ Errore GET /api/kdp/analytics/historical:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero delle statistiche storiche',
      details: error.message
    });
  }
});

// ================================================
// GET /api/kdp/analytics/book-stats - Statistiche per libro
// ================================================
router.get('/analytics/book-stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Return mock data if enabled
    if (USE_MOCK_DATA) {
      return res.json(getMockBookStats());
    }

    const userId = req.userId; // TODO: Get from auth
    const { startDate, endDate } = getDateRange(
      req.query.startDate as string,
      req.query.endDate as string
    );
    const metric = req.query.metric || 'spending_vs_royalties';

    const statsRepository = AppDataSource.getRepository(KdpDailyStats);
    const bookRepository = AppDataSource.getRepository(KdpBook);

    // Get aggregate stats
    const totalNet = await statsRepository
      .createQueryBuilder('stats')
      .select('SUM(stats.netRoyalties)', 'totalNetRoyalties')
      .where('stats.userId = :userId', { userId })
      .andWhere('stats.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getRawOne();

    // Get chart data based on metric
    let chartData = [];
    switch (metric) {
      case 'spending_vs_royalties':
        chartData = await statsRepository
          .createQueryBuilder('stats')
          .select('stats.date', 'date')
          .addSelect('SUM(stats.spending + stats.grossRoyalties)', 'value')
          .where('stats.userId = :userId', { userId })
          .andWhere('stats.date BETWEEN :startDate AND :endDate', { startDate, endDate })
          .groupBy('stats.date')
          .orderBy('stats.date', 'ASC')
          .getRawMany();
        break;

      case 'books_sold':
        chartData = await statsRepository
          .createQueryBuilder('stats')
          .select('stats.date', 'date')
          .addSelect('SUM(stats.paidUnits)', 'value')
          .where('stats.userId = :userId', { userId })
          .andWhere('stats.date BETWEEN :startDate AND :endDate', { startDate, endDate })
          .groupBy('stats.date')
          .orderBy('stats.date', 'ASC')
          .getRawMany();
        break;

      case 'kenp_reads':
        chartData = await statsRepository
          .createQueryBuilder('stats')
          .select('stats.date', 'date')
          .addSelect('SUM(stats.kenpReads)', 'value')
          .where('stats.userId = :userId', { userId })
          .andWhere('stats.date BETWEEN :startDate AND :endDate', { startDate, endDate })
          .groupBy('stats.date')
          .orderBy('stats.date', 'ASC')
          .getRawMany();
        break;

      case 'net_royalties':
      default:
        chartData = await statsRepository
          .createQueryBuilder('stats')
          .select('stats.date', 'date')
          .addSelect('SUM(stats.netRoyalties)', 'value')
          .where('stats.userId = :userId', { userId })
          .andWhere('stats.date BETWEEN :startDate AND :endDate', { startDate, endDate })
          .groupBy('stats.date')
          .orderBy('stats.date', 'ASC')
          .getRawMany();
    }

    const formattedChartData = chartData.map(row => ({
      date: row.date,
      value: parseFloat(row.value || 0)
    }));

    // Get book-level data (exclude __AGGREGATE__ rows used for ad spend tracking)
    const bookStats = await statsRepository
      .createQueryBuilder('stats')
      .select('stats.asin', 'asin')
      .addSelect('SUM(stats.grossRoyalties)', 'grossRoyalties')
      .addSelect('SUM(stats.spending)', 'spending')
      .where('stats.userId = :userId', { userId })
      .andWhere('stats.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('stats.asin IS NOT NULL')
      .andWhere("stats.asin != '__AGGREGATE__'")
      .groupBy('stats.asin')
      .orderBy('SUM(stats.grossRoyalties)', 'DESC')
      .getRawMany();

    let books: any[] = [];
    for (const stat of bookStats) {
      // Prefer the entry with most metadata (page_count not null first)
      const bookEntries = await bookRepository.find({
        where: { asin: stat.asin, userId },
        order: { pageCount: { direction: 'DESC', nulls: 'LAST' } }
      });
      const book = bookEntries[0] ?? null;
      books.push({
        asin: stat.asin,
        title: book?.title || 'Unknown',
        grossRoyalties: parseFloat(stat.grossRoyalties || 0),
        spending: parseFloat(stat.spending || 0),
        pageCount: book?.pageCount ?? undefined,
        bsrRank: book?.bsrRank ?? undefined,
        bsrCategory: book?.bsrCategory ?? undefined
      });
    }

    // Fallback to snapshot if no data
    let totalNetRoyalties = parseFloat(totalNet?.totalNetRoyalties || 0);
    let finalChartData = formattedChartData;
    let bestDate = formattedChartData.length > 0
      ? formattedChartData.reduce((max, curr) => curr.value > max.value ? curr : max).date
      : null;

    if (totalNetRoyalties === 0 || formattedChartData.length === 0) {
      const snapshotRepository = AppDataSource.getRepository(KdpSalesSnapshot);
      const latestSnapshot = await snapshotRepository.findOne({
        where: { userId },
        order: { createdAt: 'DESC' }
      });

      if (latestSnapshot) {
        // Use historicalMonths for chart data
        if (latestSnapshot.historicalMonths && latestSnapshot.historicalMonths.length > 0) {
          finalChartData = latestSnapshot.historicalMonths.map((hm: any) => ({
            date: `${hm.month}-01`,
            value: metric === 'kenp_reads' ? (hm.kenpRead || 0) :
                   metric === 'books_sold' ? ((hm.printOrders || 0) + (hm.digitalOrders || 0)) :
                   (hm.totalRoyalties || 0)
          })).reverse();

          totalNetRoyalties = latestSnapshot.historicalMonths.reduce(
            (sum: number, hm: any) => sum + (hm.totalRoyalties || 0), 0
          );

          if (finalChartData.length > 0) {
            const best = finalChartData.reduce((max: any, curr: any) =>
              (curr.value || 0) > (max.value || 0) ? curr : max
            );
            bestDate = best.date;
          }
        }

        // Use topTitles for books if empty
        if (books.length === 0 && latestSnapshot.topTitles && latestSnapshot.topTitles.length > 0) {
          for (const t of latestSnapshot.topTitles) {
            const kdpBook = await bookRepository.findOne({ where: { asin: t.asin, userId } });
            books.push({
              asin: t.asin,
              title: t.title || 'Unknown',
              grossRoyalties: t.royalties || 0,
              spending: 0,
              pageCount: kdpBook?.pageCount ?? undefined,
              bsrRank: kdpBook?.bsrRank ?? undefined,
              bsrCategory: kdpBook?.bsrCategory ?? undefined
            });
          }
        }
      }
    }

    const response = {
      totalNetRoyalties,
      bestDate,
      chartData: finalChartData,
      books
    };

    res.json(response);
  } catch (error: any) {
    console.error('❌ Errore GET /api/kdp/analytics/book-stats:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero delle statistiche per libro',
      details: error.message
    });
  }
});

// ================================================
// GET /api/kdp/analytics/country - Statistiche per paese
// ================================================
router.get('/analytics/country', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Return mock data if enabled
    if (USE_MOCK_DATA) {
      return res.json(getMockCountryStats());
    }

    const userId = req.userId;
    const { startDate, endDate } = getDateRange(
      req.query.startDate as string,
      req.query.endDate as string
    );

    const statsRepository = AppDataSource.getRepository(KdpDailyStats);
    const snapshotRepository = AppDataSource.getRepository(KdpSalesSnapshot);

    const marketplaceNames: { [key: string]: string } = {
      'US': 'United States',
      'UK': 'United Kingdom',
      'DE': 'Germany',
      'FR': 'France',
      'IT': 'Italy',
      'ES': 'Spain',
      'CA': 'Canada',
      'AU': 'Australia',
      'JP': 'Japan',
      'BR': 'Brazil',
      'MX': 'Mexico',
      'IN': 'India',
      'NL': 'Netherlands',
      'PL': 'Poland',
      'SE': 'Sweden'
    };

    // Get stats by marketplace from KdpDailyStats
    const countryStats = await statsRepository
      .createQueryBuilder('stats')
      .select('stats.marketplace', 'marketplace')
      .addSelect('SUM(stats.grossRoyalties)', 'royalties')
      .addSelect('SUM(stats.spending)', 'spending')
      .addSelect('SUM(stats.paidUnits + stats.freeUnits)', 'sales')
      .where('stats.userId = :userId', { userId })
      .andWhere('stats.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('stats.marketplace IS NOT NULL')
      .groupBy('stats.marketplace')
      .orderBy('SUM(stats.grossRoyalties)', 'DESC')
      .getRawMany();

    let countriesData = countryStats.map(stat => ({
      marketplace: stat.marketplace,
      countryName: marketplaceNames[stat.marketplace] || stat.marketplace,
      royalties: parseFloat(stat.royalties || 0),
      spending: parseFloat(stat.spending || 0),
      sales: parseInt(stat.sales || 0)
    }));

    // If no data in KdpDailyStats, try to get from latest snapshot
    if (countriesData.length === 0) {
      const latestSnapshot = await snapshotRepository.findOne({
        where: { userId },
        order: { createdAt: 'DESC' }
      });

      if (latestSnapshot && latestSnapshot.marketplaceData && latestSnapshot.marketplaceData.length > 0) {
        countriesData = latestSnapshot.marketplaceData.map((mp: any) => ({
          marketplace: mp.marketplace,
          countryName: marketplaceNames[mp.marketplace] || mp.marketplace,
          royalties: parseFloat(mp.royalties || 0),
          spending: 0,
          sales: parseInt(mp.orders || 0)
        }));
      }
    }

    // Calculate total global
    const totalGross = countriesData.reduce((sum, c) => sum + c.royalties, 0);
    const totalSpending = countriesData.reduce((sum, c) => sum + c.spending, 0);
    const overallROI = totalSpending > 0 ? ((totalGross - totalSpending) / totalSpending) * 100 : null;
    const amsROAS = totalSpending > 0 ? (totalGross / totalSpending) * 100 : null;

    // Get chart data (time series by marketplace)
    const chartData = await statsRepository
      .createQueryBuilder('stats')
      .select('stats.date', 'date')
      .addSelect('stats.marketplace', 'marketplace')
      .addSelect('SUM(stats.grossRoyalties)', 'royalties')
      .where('stats.userId = :userId', { userId })
      .andWhere('stats.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('stats.marketplace IS NOT NULL')
      .groupBy('stats.date, stats.marketplace')
      .orderBy('stats.date', 'ASC')
      .getRawMany();

    // Transform to chart format
    const chartByDate: { [date: string]: any } = {};
    chartData.forEach(row => {
      if (!chartByDate[row.date]) {
        chartByDate[row.date] = { date: row.date };
      }
      chartByDate[row.date][row.marketplace] = parseFloat(row.royalties || 0);
    });

    const formattedChartData = Object.values(chartByDate);

    const response = {
      period: { startDate, endDate },
      totalGlobal: {
        gross: totalGross,
        overallROI,
        amsROI: overallROI,
        amsROAS
      },
      countriesData,
      chartData: formattedChartData
    };

    res.json(response);
  } catch (error: any) {
    console.error('❌ Errore GET /api/kdp/analytics/country:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero delle statistiche per paese',
      details: error.message
    });
  }
});

// ================================================
// GET /api/kdp/analytics/month-comparison - Confronto mensile
// ================================================
router.get('/analytics/month-comparison', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const month1 = req.query.month1 as string || '2024-11';
    const month2 = req.query.month2 as string || '2024-12';

    // Return mock data if enabled
    if (USE_MOCK_DATA) {
      return res.json(getMockMonthComparison(month1, month2));
    }

    const userId = req.userId;
    const statsRepository = AppDataSource.getRepository(KdpDailyStats);
    const snapshotRepository = AppDataSource.getRepository(KdpSalesSnapshot);

    // Helper to get month stats from KdpDailyStats
    const getMonthStatsFromDaily = async (month: string) => {
      const startDate = `${month}-01`;
      const endDate = `${month}-31`;

      const stats = await statsRepository
        .createQueryBuilder('stats')
        .select('SUM(stats.grossRoyalties)', 'totalGrossRoyalties')
        .addSelect('SUM(stats.spending)', 'totalSpending')
        .addSelect('SUM(stats.netRoyalties)', 'totalNetRoyalties')
        .addSelect('SUM(stats.paidUnits)', 'totalPaidUnits')
        .addSelect('SUM(stats.freeUnits)', 'totalFreeUnits')
        .addSelect('SUM(stats.kenpReads)', 'totalKenpReads')
        .where('stats.userId = :userId', { userId })
        .andWhere('stats.date BETWEEN :startDate AND :endDate', { startDate, endDate })
        .getRawOne();

      return {
        month,
        grossRoyalties: parseFloat(stats?.totalGrossRoyalties || 0),
        spending: parseFloat(stats?.totalSpending || 0),
        netRoyalties: parseFloat(stats?.totalNetRoyalties || 0),
        paidUnits: parseInt(stats?.totalPaidUnits || 0),
        freeUnits: parseInt(stats?.totalFreeUnits || 0),
        kenpReads: parseInt(stats?.totalKenpReads || 0)
      };
    };

    // Get stats from KdpDailyStats first
    let [stats1, stats2] = await Promise.all([
      getMonthStatsFromDaily(month1),
      getMonthStatsFromDaily(month2)
    ]);

    // If no data in KdpDailyStats, try to get from latest snapshot for current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get latest snapshot to fill in missing data
    const latestSnapshot = await snapshotRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' }
    });

    if (latestSnapshot) {
      // Helper to get month data from historicalMonths
      const getFromHistorical = (month: string) => {
        if (latestSnapshot.historicalMonths && latestSnapshot.historicalMonths.length > 0) {
          const histData = latestSnapshot.historicalMonths.find((hm: any) => hm.month === month);
          if (histData) {
            return {
              month,
              grossRoyalties: histData.totalRoyalties || 0,
              spending: 0,
              netRoyalties: histData.totalRoyalties || 0,
              paidUnits: (histData.printOrders || 0) + (histData.digitalOrders || 0),
              freeUnits: 0,
              kenpReads: histData.kenpRead || 0
            };
          }
        }
        return null;
      };

      // Try to get stats from historicalMonths if KdpDailyStats is empty
      if (stats1.grossRoyalties === 0) {
        const fromHist = getFromHistorical(month1);
        if (fromHist) stats1 = fromHist;
      }

      if (stats2.grossRoyalties === 0) {
        const fromHist = getFromHistorical(month2);
        if (fromHist) stats2 = fromHist;
      }

      // Fallback for current month to current snapshot data
      if (month2 === currentMonth && stats2.grossRoyalties === 0) {
        stats2 = {
          month: month2,
          grossRoyalties: parseFloat(latestSnapshot.totalRoyalties?.toString() || '0'),
          spending: 0,
          netRoyalties: parseFloat(latestSnapshot.totalRoyalties?.toString() || '0'),
          paidUnits: (latestSnapshot.printOrders || 0) + (latestSnapshot.digitalOrders || 0),
          freeUnits: 0,
          kenpReads: latestSnapshot.kenpRead || 0
        };
      }
      if (month1 === currentMonth && stats1.grossRoyalties === 0) {
        stats1 = {
          month: month1,
          grossRoyalties: parseFloat(latestSnapshot.totalRoyalties?.toString() || '0'),
          spending: 0,
          netRoyalties: parseFloat(latestSnapshot.totalRoyalties?.toString() || '0'),
          paidUnits: (latestSnapshot.printOrders || 0) + (latestSnapshot.digitalOrders || 0),
          freeUnits: 0,
          kenpReads: latestSnapshot.kenpRead || 0
        };
      }
    }

    const response = {
      month1: stats1,
      month2: stats2,
      comparison: {
        grossRoyaltiesDiff: stats2.grossRoyalties - stats1.grossRoyalties,
        spendingDiff: stats2.spending - stats1.spending,
        netRoyaltiesDiff: stats2.netRoyalties - stats1.netRoyalties,
        paidUnitsDiff: stats2.paidUnits - stats1.paidUnits,
        freeUnitsDiff: stats2.freeUnits - stats1.freeUnits,
        kenpReadsDiff: stats2.kenpReads - stats1.kenpReads
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('❌ Errore GET /api/kdp/analytics/month-comparison:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel confronto mensile',
      details: error.message
    });
  }
});

export default router;
