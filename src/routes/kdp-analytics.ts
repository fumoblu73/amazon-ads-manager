import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { KdpDailyStats } from '../models/KdpDailyStats';
import { KdpBook } from '../models/KdpBook';
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

    const userId = req.userId; // TODO: Get from auth
    const { startDate, endDate} = getDateRange(
      req.query.startDate as string,
      req.query.endDate as string
    );

    const statsRepository = AppDataSource.getRepository(KdpDailyStats);
    const bookRepository = AppDataSource.getRepository(KdpBook);

    // Get overall stats for the period
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

    // Calculate monthly stats (last 30 days)
    const monthlyGross = parseFloat(stats.totalGrossRoyalties || 0);
    const monthlySpending = parseFloat(stats.totalSpending || 0);
    const monthlyNet = parseFloat(stats.totalNetRoyalties || 0);
    const monthlyROI = monthlySpending > 0 ? ((monthlyNet / monthlySpending) * 100) : null;
    const monthlyROAS = monthlySpending > 0 ? ((monthlyGross / monthlySpending) * 100) : null;

    // Get today's stats
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await statsRepository.findOne({
      where: { userId, date: today }
    });

    const dailyGross = todayStats ? parseFloat(todayStats.grossRoyalties.toString()) : 0;
    const dailySpending = todayStats ? parseFloat(todayStats.spending.toString()) : 0;
    const dailyNet = todayStats ? parseFloat(todayStats.netRoyalties.toString()) : 0;
    const dailyROI = dailySpending > 0 ? ((dailyNet / dailySpending) * 100) : null;
    const dailyROAS = dailySpending > 0 ? ((dailyGross / dailySpending) * 100) : null;

    // Get top earners (yesterday and today)
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
    const enrichTopEarners = async (topList: any[]) => {
      const results = [];
      for (const item of topList) {
        const book = await bookRepository.findOne({
          where: { asin: item.asin, userId }
        });
        results.push({
          asin: item.asin,
          title: book?.title || 'Unknown',
          royalties: parseFloat(item.royalties || 0),
          spending: parseFloat(item.spending || 0)
        });
      }
      return results;
    };

    const topEarnersYesterday = await enrichTopEarners(topYesterday);
    const topEarnersToday = await enrichTopEarners(topToday);

    // Build response
    const summary = {
      period: { startDate, endDate },
      overall: {
        monthlyStats: {
          gross: monthlyGross,
          spending: monthlySpending,
          netRoyalties: monthlyNet,
          overallROI: monthlyROI,
          amsROI: monthlyROI,
          amsROAS: monthlyROAS
        },
        dailyStats: {
          gross: dailyGross,
          spending: dailySpending,
          netRoyalties: dailyNet,
          overallROI: dailyROI,
          amsROI: dailyROI,
          amsROAS: dailyROAS
        }
      },
      widgets: {
        paidSales: parseInt(stats.totalPaidUnits || 0),
        freeSales: parseInt(stats.totalFreeUnits || 0),
        kenpReads: parseInt(stats.totalKenpReads || 0),
        totalGrossRoyalties: monthlyGross,
        totalSpending: monthlySpending,
        totalNetRoyalties: monthlyNet,
        avgDailyGross: monthlyGross / 30,
        avgDailyNet: monthlyNet / 30,
        overallROI: monthlyROI,
        amsROAS: monthlyROAS
      },
      topEarners: {
        yesterday: topEarnersYesterday,
        today: topEarnersToday
      }
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

    const userId = req.userId; // TODO: Get from auth
    const { startDate, endDate } = getDateRange(
      req.query.startDate as string,
      req.query.endDate as string
    );

    const statsRepository = AppDataSource.getRepository(KdpDailyStats);
    const bookRepository = AppDataSource.getRepository(KdpBook);

    // Get aggregate stats for period
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
    const chartData = await statsRepository
      .createQueryBuilder('stats')
      .select('stats.date', 'date')
      .addSelect('SUM(stats.grossRoyalties)', 'royalties')
      .addSelect('SUM(stats.spending)', 'spending')
      .where('stats.userId = :userId', { userId })
      .andWhere('stats.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('stats.date')
      .orderBy('stats.date', 'ASC')
      .getRawMany();

    const formattedChartData = chartData.map(row => ({
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

    const books = [];
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

    // Find best month (if data spans multiple months)
    const bestMonth = chartData.length > 0 ? chartData[0].date.substring(0, 7) : null;

    const response = {
      period: { startDate, endDate },
      summary: {
        totalGrossRoyalties: parseFloat(aggregateStats.totalGrossRoyalties || 0),
        totalSpending: parseFloat(aggregateStats.totalSpending || 0),
        totalNetRoyalties: parseFloat(aggregateStats.totalNetRoyalties || 0),
        totalPaidUnits: parseInt(aggregateStats.totalPaidUnits || 0),
        totalFreeUnits: parseInt(aggregateStats.totalFreeUnits || 0)
      },
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

    const userId = req.userId; // TODO: Get from auth
    const { startDate, endDate } = getDateRange(
      req.query.startDate as string,
      req.query.endDate as string
    );

    const statsRepository = AppDataSource.getRepository(KdpDailyStats);

    // Get stats by marketplace
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

    const marketplaceNames: { [key: string]: string } = {
      'US': 'United States',
      'UK': 'United Kingdom',
      'DE': 'Germany',
      'FR': 'France',
      'IT': 'Italy',
      'ES': 'Spain',
      'CA': 'Canada',
      'AU': 'Australia'
    };

    const countriesData = countryStats.map(stat => ({
      marketplace: stat.marketplace,
      countryName: marketplaceNames[stat.marketplace] || stat.marketplace,
      royalties: parseFloat(stat.royalties || 0),
      spending: parseFloat(stat.spending || 0),
      sales: parseInt(stat.sales || 0)
    }));

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
    const month1 = req.query.month1 as string || '2024-01';
    const month2 = req.query.month2 as string || '2024-02';

    // Return mock data if enabled
    if (USE_MOCK_DATA) {
      return res.json(getMockMonthComparison(month1, month2));
    }

    const userId = req.userId; // TODO: Get from auth
    const statsRepository = AppDataSource.getRepository(KdpDailyStats);

    // Helper to get month stats
    const getMonthStats = async (month: string) => {
      const startDate = `${month}-01`;
      const endDate = `${month}-31`; // Simplified, should calculate actual last day

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
        grossRoyalties: parseFloat(stats.totalGrossRoyalties || 0),
        spending: parseFloat(stats.totalSpending || 0),
        netRoyalties: parseFloat(stats.totalNetRoyalties || 0),
        paidUnits: parseInt(stats.totalPaidUnits || 0),
        freeUnits: parseInt(stats.totalFreeUnits || 0),
        kenpReads: parseInt(stats.totalKenpReads || 0)
      };
    };

    const [stats1, stats2] = await Promise.all([
      getMonthStats(month1),
      getMonthStats(month2)
    ]);

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
