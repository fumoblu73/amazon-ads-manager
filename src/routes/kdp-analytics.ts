import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { KdpDailyStats } from '../models/KdpDailyStats';
import { KdpBook } from '../models/KdpBook';
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

// Helper function to get date range
const getDateRange = (startDate?: string, endDate?: string) => {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
};

// Helper to format currency
const formatCurrency = (value: number): string => {
  return value.toFixed(2);
};

// ================================================
// GET /api/kdp/dashboard/summary - Dashboard principale
// ================================================
router.get('/dashboard/summary', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Return mock data if enabled
    if (USE_MOCK_DATA) {
      return res.json(getMockDashboardSummary());
    }

    const userId = req.userId;
    const { startDate, endDate} = getDateRange(
      req.query.startDate as string,
      req.query.endDate as string
    );

    const statsRepository = AppDataSource.getRepository(KdpDailyStats);
    const bookRepository = AppDataSource.getRepository(KdpBook);
    const snapshotRepository = AppDataSource.getRepository(KdpSalesSnapshot);

    // Prima prova a ottenere l'ultimo snapshot da client-side scraping
    const latestSnapshot = await snapshotRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' }
    });

    // Get overall stats for the period from KdpDailyStats
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

    // Use snapshot data if available, otherwise use KdpDailyStats
    let monthlyGross = parseFloat(stats?.totalGrossRoyalties || 0);
    let monthlySpending = parseFloat(stats?.totalSpending || 0);
    let monthlyNet = parseFloat(stats?.totalNetRoyalties || 0);
    let totalPaidUnits = parseInt(stats?.totalPaidUnits || 0);
    let totalFreeUnits = parseInt(stats?.totalFreeUnits || 0);
    let totalKenpReads = parseInt(stats?.totalKenpReads || 0);
    let topEarnersToday: any[] = [];
    let topEarnersYesterday: any[] = [];

    // Se abbiamo uno snapshot recente, usa i suoi dati
    if (latestSnapshot) {
      console.log(`📊 Using KdpSalesSnapshot data from ${latestSnapshot.createdAt}`);

      // Usa i dati dallo snapshot se non ci sono dati in KdpDailyStats
      if (monthlyGross === 0 && latestSnapshot.totalRoyalties) {
        monthlyGross = parseFloat(latestSnapshot.totalRoyalties.toString());
        monthlyNet = monthlyGross; // No spending data from KDP Reports
      }

      if (totalPaidUnits === 0) {
        totalPaidUnits = (latestSnapshot.printOrders || 0) + (latestSnapshot.digitalOrders || 0);
      }

      if (totalKenpReads === 0 && latestSnapshot.kenpRead) {
        totalKenpReads = latestSnapshot.kenpRead;
      }

      // Usa top titles dallo snapshot
      if (latestSnapshot.topTitles && latestSnapshot.topTitles.length > 0) {
        topEarnersToday = latestSnapshot.topTitles.map((t: any) => ({
          bookId: t.asin,
          asin: t.asin,
          title: t.title || 'Unknown',
          royalties: t.royalties || 0,
          spending: 0
        }));
      }
    }

    const monthlyROI = monthlySpending > 0 ? ((monthlyNet / monthlySpending) * 100) : null;
    const monthlyROAS = monthlySpending > 0 ? ((monthlyGross / monthlySpending) * 100) : null;

    // Get today's stats from KdpDailyStats
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await statsRepository.findOne({
      where: { userId, date: today }
    });

    const dailyGross = todayStats ? parseFloat(todayStats.grossRoyalties.toString()) : 0;
    const dailySpending = todayStats ? parseFloat(todayStats.spending.toString()) : 0;
    const dailyNet = todayStats ? parseFloat(todayStats.netRoyalties.toString()) : 0;
    const dailyROI = dailySpending > 0 ? ((dailyNet / dailySpending) * 100) : null;
    const dailyROAS = dailySpending > 0 ? ((dailyGross / dailySpending) * 100) : null;

    // Get top earners from KdpDailyStats (if we don't have them from snapshot)
    if (topEarnersToday.length === 0) {
      const topToday = await statsRepository
        .createQueryBuilder('stats')
        .select('stats.asin', 'asin')
        .addSelect('SUM(stats.grossRoyalties)', 'royalties')
        .addSelect('SUM(stats.spending)', 'spending')
        .where('stats.userId = :userId', { userId })
        .andWhere('stats.date = :date', { date: today })
        .andWhere('stats.asin IS NOT NULL')
        .groupBy('stats.asin')
        .orderBy('SUM(stats.grossRoyalties)', 'DESC')
        .limit(10)
        .getRawMany();

      // Enrich with book titles
      for (const item of topToday) {
        const book = await bookRepository.findOne({
          where: { asin: item.asin, userId }
        });
        topEarnersToday.push({
          bookId: item.asin,
          asin: item.asin,
          title: book?.title || 'Unknown',
          royalties: parseFloat(item.royalties || 0),
          spending: parseFloat(item.spending || 0)
        });
      }
    }

    // Get yesterday's top earners from KdpDailyStats
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const topYesterday = await statsRepository
      .createQueryBuilder('stats')
      .select('stats.asin', 'asin')
      .addSelect('SUM(stats.grossRoyalties)', 'royalties')
      .addSelect('SUM(stats.spending)', 'spending')
      .where('stats.userId = :userId', { userId })
      .andWhere('stats.date = :date', { date: yesterday })
      .andWhere('stats.asin IS NOT NULL')
      .groupBy('stats.asin')
      .orderBy('SUM(stats.grossRoyalties)', 'DESC')
      .limit(10)
      .getRawMany();

    for (const item of topYesterday) {
      const book = await bookRepository.findOne({
        where: { asin: item.asin, userId }
      });
      topEarnersYesterday.push({
        bookId: item.asin,
        asin: item.asin,
        title: book?.title || 'Unknown',
        royalties: parseFloat(item.royalties || 0),
        spending: parseFloat(item.spending || 0)
      });
    }

    // Calcola numero libri totali dell'utente
    const totalLiveBooks = await bookRepository.count({
      where: { userId }
    });

    // Build response
    const summary = {
      period: { startDate, endDate },
      overall: {
        monthlyStats: {
          adOrders: totalPaidUnits,
          grossRoyalties: monthlyGross,
          spending: monthlySpending,
          netRoyalties: monthlyNet,
          overallROI: monthlyROI,
          amsROI: monthlyROI,
          amsACoS: monthlyROAS ? (100 / monthlyROAS * 100) : null
        },
        dailyStats: {
          adOrders: 0,
          grossRoyalties: dailyGross,
          spending: dailySpending,
          netRoyalties: dailyNet,
          overallROI: dailyROI,
          amsROI: dailyROI,
          amsACoS: dailyROAS ? (100 / dailyROAS * 100) : null
        }
      },
      widgets: {
        grossRoyaltiesEstimator: monthlyGross,
        todayNetRoyalties: dailyNet,
        yesterdayNetRoyalties: 0,
        kenpReadsThisMonth: totalKenpReads,
        totalLiveBooks: totalLiveBooks || 0,
        dailyAvgGrossRoyalties: monthlyGross / 30,
        dailyAvgNetRoyalties: monthlyNet / 30,
        estimatedProjection: monthlyGross,
        bookSalesThisMonth: totalPaidUnits
      },
      topEarners: {
        yesterday: topEarnersYesterday,
        today: topEarnersToday
      },
      // Include snapshot info for debugging
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
    if (summary.totalGrossRoyalties === 0 && formattedChartData.length === 0) {
      const latestSnapshot = await snapshotRepository.findOne({
        where: { userId },
        order: { createdAt: 'DESC' }
      });

      if (latestSnapshot) {
        // Use snapshot summary data
        summary = {
          totalGrossRoyalties: parseFloat(latestSnapshot.totalRoyalties?.toString() || '0'),
          totalSpending: 0,
          totalNetRoyalties: parseFloat(latestSnapshot.totalRoyalties?.toString() || '0'),
          totalPaidUnits: (latestSnapshot.printOrders || 0) + (latestSnapshot.digitalOrders || 0),
          totalFreeUnits: 0
        };

        // Use dailyOrders from snapshot for chart data
        if (latestSnapshot.dailyOrders && latestSnapshot.dailyOrders.length > 0) {
          formattedChartData = latestSnapshot.dailyOrders.map((d: any) => ({
            date: d.date,
            royalties: 0, // dailyOrders only has order counts, not royalties
            spending: 0,
            orders: d.orders || 0
          }));
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
    }

    // Find best month (if data spans multiple months)
    const bestMonth = formattedChartData.length > 0 ? formattedChartData[0].date?.substring(0, 7) : null;

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

    // Get best performing date
    const bestDate = formattedChartData.length > 0
      ? formattedChartData.reduce((max, curr) => curr.value > max.value ? curr : max).date
      : null;

    // Get book-level data
    const bookStats = await statsRepository
      .createQueryBuilder('stats')
      .select('stats.asin', 'asin')
      .addSelect('SUM(stats.grossRoyalties)', 'grossRoyalties')
      .addSelect('SUM(stats.spending)', 'spending')
      .where('stats.userId = :userId', { userId })
      .andWhere('stats.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('stats.asin IS NOT NULL')
      .groupBy('stats.asin')
      .orderBy('SUM(stats.grossRoyalties)', 'DESC')
      .getRawMany();

    const books = [];
    for (const stat of bookStats) {
      const book = await bookRepository.findOne({
        where: { asin: stat.asin, userId }
      });
      books.push({
        asin: stat.asin,
        title: book?.title || 'Unknown',
        grossRoyalties: parseFloat(stat.grossRoyalties || 0),
        spending: parseFloat(stat.spending || 0)
      });
    }

    const response = {
      totalNetRoyalties: parseFloat(totalNet.totalNetRoyalties || 0),
      bestDate,
      chartData: formattedChartData,
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
      // If month2 is current month and has no data, use snapshot
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
      // If month1 is current month and has no data, use snapshot
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
