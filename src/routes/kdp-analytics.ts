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
      return {
        grossRoyalties: stats ? parseFloat(stats.grossRoyalties.toString()) : 0,
        spending: stats ? parseFloat(stats.spending.toString()) : 0,
        netRoyalties: stats ? parseFloat(stats.netRoyalties.toString()) : 0,
        paidUnits: stats ? parseInt(stats.paidUnits.toString()) : 0,
        kenpReads: stats ? parseInt(stats.kenpReads.toString()) : 0
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
      console.log(`📊 Using KdpSalesSnapshot data from ${latestSnapshot.createdAt}`);
      console.log(`📊 Snapshot historicalMonths count: ${latestSnapshot.historicalMonths?.length || 0}`);

      // Build historical data map for easy lookup
      const historicalMap = new Map<string, any>();
      if (latestSnapshot.historicalMonths && latestSnapshot.historicalMonths.length > 0) {
        latestSnapshot.historicalMonths.forEach((hm: any) => {
          historicalMap.set(hm.month, hm);
          console.log(`📊 Historical month: ${hm.month} = $${hm.totalRoyalties || 0}`);
        });
      }

      // Use snapshot data for current month if KdpDailyStats is empty
      if (currentMonthStats.grossRoyalties === 0) {
        const currentMonthKey = currentMonth.startDate.substring(0, 7); // YYYY-MM
        const currentMonthHistorical = historicalMap.get(currentMonthKey);

        if (currentMonthHistorical) {
          console.log(`📊 Using historical data for current month: ${currentMonthKey} = $${currentMonthHistorical.totalRoyalties}`);
          currentMonthStats = {
            grossRoyalties: currentMonthHistorical.totalRoyalties || 0,
            spending: 0,
            netRoyalties: currentMonthHistorical.totalRoyalties || 0,
            paidUnits: (currentMonthHistorical.printOrders || 0) + (currentMonthHistorical.digitalOrders || 0),
            freeUnits: 0,
            kenpReads: currentMonthHistorical.kenpRead || 0,
            printOrders: currentMonthHistorical.printOrders || 0,
            digitalOrders: currentMonthHistorical.digitalOrders || 0
          };
        } else if (latestSnapshot.totalRoyalties) {
          console.log(`📊 Using snapshot totalRoyalties for current month: $${latestSnapshot.totalRoyalties}`);
          currentMonthStats = {
            grossRoyalties: parseFloat(latestSnapshot.totalRoyalties.toString()),
            spending: 0,
            netRoyalties: parseFloat(latestSnapshot.totalRoyalties.toString()),
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
          console.log(`📊 Using historical data for previous month: ${prevMonthKey} = $${prevMonthData.totalRoyalties}`);
          previousMonthStats = {
            grossRoyalties: prevMonthData.totalRoyalties || 0,
            spending: 0,
            netRoyalties: prevMonthData.totalRoyalties || 0,
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

    // Calculate ROI/ACOS for current month
    const currentROI = currentMonthStats.spending > 0
      ? ((currentMonthStats.netRoyalties / currentMonthStats.spending) * 100) : null;
    const currentACoS = currentMonthStats.grossRoyalties > 0 && currentMonthStats.spending > 0
      ? ((currentMonthStats.spending / currentMonthStats.grossRoyalties) * 100) : null;

    // Calculate ROI/ACOS for previous month
    const previousROI = previousMonthStats.spending > 0
      ? ((previousMonthStats.netRoyalties / previousMonthStats.spending) * 100) : null;
    const previousACoS = previousMonthStats.grossRoyalties > 0 && previousMonthStats.spending > 0
      ? ((previousMonthStats.spending / previousMonthStats.grossRoyalties) * 100) : null;

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
    const monthlyChartData: Array<{month: string; label: string; royalties: number; orders: number}> = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

      const monthStats = await statsRepository
        .createQueryBuilder('stats')
        .select('SUM(stats.grossRoyalties)', 'royalties')
        .addSelect('SUM(stats.paidUnits)', 'orders')
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
        orders: parseInt(monthStats?.orders || 0)
      });
    }

    // If we have snapshot with historical months, use it to fill in chart data
    if (latestSnapshot) {
      // Use historicalMonths from snapshot if available
      if (latestSnapshot.historicalMonths && latestSnapshot.historicalMonths.length > 0) {
        console.log(`📊 Using historical data from snapshot: ${latestSnapshot.historicalMonths.length} months`);

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
            chartMonth.orders = (historicalData.printOrders || 0) + (historicalData.digitalOrders || 0);
          }
        });
      }

      // Fallback: use current month data from snapshot
      const lastMonthData = monthlyChartData[monthlyChartData.length - 1];
      if (lastMonthData.royalties === 0 && latestSnapshot.totalRoyalties) {
        lastMonthData.royalties = parseFloat(latestSnapshot.totalRoyalties.toString());
        lastMonthData.orders = (latestSnapshot.printOrders || 0) + (latestSnapshot.digitalOrders || 0);
      }
    }

    // Count total live books
    const totalLiveBooks = await bookRepository.count({
      where: { userId }
    });

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
            reads: previousMonthStats.kenpReads || 0,
            grossRoyalties: previousMonthStats.grossRoyalties,
            spending: previousMonthStats.spending,
            netRoyalties: previousMonthStats.netRoyalties,
            overallROI: previousROI,
            amsROI: previousROI,
            amsACoS: previousACoS
          },
          currentMonth: {
            label: currentMonth.monthLabel,
            adOrders: currentMonthStats.paidUnits,
            paperbacks: currentMonthStats.printOrders || 0,
            reads: currentMonthStats.kenpReads || 0,
            grossRoyalties: currentMonthStats.grossRoyalties,
            spending: currentMonthStats.spending,
            netRoyalties: currentMonthStats.netRoyalties,
            overallROI: currentROI,
            amsROI: currentROI,
            amsACoS: currentACoS
          },
          change: {
            adOrders: calculatePercentChange(currentMonthStats.paidUnits, previousMonthStats.paidUnits),
            paperbacks: calculatePercentChange(currentMonthStats.printOrders || 0, previousMonthStats.printOrders || 0),
            reads: calculatePercentChange(currentMonthStats.kenpReads || 0, previousMonthStats.kenpReads || 0),
            grossRoyalties: calculatePercentChange(currentMonthStats.grossRoyalties, previousMonthStats.grossRoyalties),
            spending: calculatePercentChange(currentMonthStats.spending, previousMonthStats.spending),
            netRoyalties: calculatePercentChange(currentMonthStats.netRoyalties, previousMonthStats.netRoyalties)
          }
        },

        // Overall Daily Stats (Yesterday vs Today)
        dailyStats: {
          yesterday: {
            label: formatDateShort(yesterday),
            adOrders: yesterdayStats.paidUnits,
            paperbacks: 0,
            reads: yesterdayStats.kenpReads || 0,
            grossRoyalties: yesterdayStats.grossRoyalties,
            spending: yesterdayStats.spending,
            netRoyalties: yesterdayStats.netRoyalties,
            overallROI: yesterdayROI,
            amsROI: yesterdayROI,
            amsACoS: yesterdayACoS
          },
          today: {
            label: formatDateShort(today),
            adOrders: todayStats.paidUnits,
            paperbacks: 0,
            reads: todayStats.kenpReads || 0,
            grossRoyalties: todayStats.grossRoyalties,
            spending: todayStats.spending,
            netRoyalties: todayStats.netRoyalties,
            overallROI: todayROI,
            amsROI: todayROI,
            amsACoS: todayACoS
          },
          change: {
            adOrders: calculatePercentChange(todayStats.paidUnits, yesterdayStats.paidUnits),
            paperbacks: null,
            reads: calculatePercentChange(todayStats.kenpReads || 0, yesterdayStats.kenpReads || 0),
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

      // Monthly chart data (last 12 months - Publisher Champ style)
      charts: {
        monthly: {
          label: 'Monthly Performance',
          data: monthlyChartData
        }
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

    let books: any[] = [];
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
          books = latestSnapshot.topTitles.map((t: any) => ({
            asin: t.asin,
            title: t.title || 'Unknown',
            grossRoyalties: t.royalties || 0,
            spending: 0
          }));
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
