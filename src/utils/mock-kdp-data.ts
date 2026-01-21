// Mock data for KDP endpoints when USE_MOCK_DATA=true

export const mockBooks = [
  {
    id: '1',
    userId: 'demo-user',
    asin: 'B0ABC12345',
    title: 'The Mystery of the Lost Key',
    marketplace: 'US',
    format: 'eBook',
    author: 'John Smith',
    publicationDate: '2024-01-15',
    kenpc: 250,
    lastSyncDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    userId: 'demo-user',
    asin: 'B0DEF67890',
    title: 'Digital Marketing Mastery',
    marketplace: 'US',
    format: 'eBook',
    author: 'Jane Doe',
    publicationDate: '2024-02-20',
    kenpc: 180,
    lastSyncDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '3',
    userId: 'demo-user',
    asin: 'B0GHI11223',
    title: 'French Cooking Essentials',
    marketplace: 'FR',
    format: 'Paperback',
    author: 'Pierre Dubois',
    publicationDate: '2024-03-10',
    kenpc: 0,
    lastSyncDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const getMockDashboardSummary = () => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const currentMonthLabel = now.toLocaleDateString('en-US', { month: 'short' });
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthLabel = prevMonthDate.toLocaleDateString('en-US', { month: 'short' });

  // Generate monthly chart data (last 12 months)
  const monthlyChartData = [];
  for (let i = 11; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlyChartData.push({
      month: monthDate.toISOString().split('T')[0],
      label: monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      royalties: 800 + Math.random() * 600,
      orders: 80 + Math.floor(Math.random() * 60)
    });
  }

  return {
    period: {
      startDate: firstOfMonth,
      endDate: today,
      label: `${currentMonthLabel} 1st → ${currentMonthLabel} ${now.getDate()}th`
    },
    overall: {
      monthlyStats: {
        previousMonth: {
          label: prevMonthLabel,
          adOrders: 112,
          paperbacks: 45,
          reads: 38500,
          grossRoyalties: 1150.30,
          spending: 450.20,
          netRoyalties: 700.10,
          overallROI: 155.50,
          amsROI: 155.50,
          amsACoS: 39.14
        },
        currentMonth: {
          label: currentMonthLabel,
          adOrders: 128,
          paperbacks: 52,
          reads: 45680,
          grossRoyalties: 1250.50,
          spending: 480.25,
          netRoyalties: 770.25,
          overallROI: 160.42,
          amsROI: 160.42,
          amsACoS: 38.42
        },
        change: {
          adOrders: 14.3,
          paperbacks: 15.6,
          reads: 18.6,
          grossRoyalties: 8.7,
          spending: 6.7,
          netRoyalties: 10.0
        }
      },
      dailyStats: {
        yesterday: {
          label: `${new Date(yesterday).getDate()}/${new Date(yesterday).getMonth() + 1}`,
          adOrders: 5,
          paperbacks: 2,
          reads: 1520,
          grossRoyalties: 48.50,
          spending: 18.20,
          netRoyalties: 30.30,
          overallROI: 166.48,
          amsROI: 166.48,
          amsACoS: 37.53
        },
        today: {
          label: `${now.getDate()}/${now.getMonth() + 1}`,
          adOrders: 4,
          paperbacks: 1,
          reads: 1280,
          grossRoyalties: 42.30,
          spending: 15.80,
          netRoyalties: 26.50,
          overallROI: 167.72,
          amsROI: 167.72,
          amsACoS: 37.35
        },
        change: {
          adOrders: -20.0,
          paperbacks: -50.0,
          reads: -15.8,
          grossRoyalties: -12.8,
          spending: -13.2,
          netRoyalties: -12.5
        }
      }
    },
    widgets: {
      grossRoyaltiesEstimator: 1250.50,
      netRoyaltiesThisMonth: 770.25,
      todayNetRoyalties: 26.50,
      yesterdayNetRoyalties: 30.30,
      kenpReadsThisMonth: 45680,
      totalLiveBooks: 12,
      dailyAvgGrossRoyalties: 41.68,
      dailyAvgNetRoyalties: 25.67,
      estimatedProjection: 1450.00,
      bookSalesThisMonth: 128,
      organicOrders: 85,
      inorganicOrders: 43,
      preOrders: 12,
      royaltiesChange: 8.7,
      ordersChange: 14.3
    },
    topEarners: {
      previousMonth: [
        { bookId: '1', asin: 'B0ABC12345', title: 'The Mystery of the Lost Key', royalties: 425.20, spending: 165.40, coverUrl: null, bsrRank: 12450 },
        { bookId: '2', asin: 'B0DEF67890', title: 'Digital Marketing Mastery', royalties: 380.50, spending: 185.60, coverUrl: null, bsrRank: 8920 },
        { bookId: '3', asin: 'B0GHI11223', title: 'French Cooking Essentials', royalties: 220.10, spending: 68.25, coverUrl: null, bsrRank: 25680 }
      ],
      currentMonth: [
        { bookId: '2', asin: 'B0DEF67890', title: 'Digital Marketing Mastery', royalties: 520.30, spending: 195.40, coverUrl: null, bsrRank: 6840 },
        { bookId: '1', asin: 'B0ABC12345', title: 'The Mystery of the Lost Key', royalties: 418.80, spending: 172.50, coverUrl: null, bsrRank: 14200 },
        { bookId: '3', asin: 'B0GHI11223', title: 'French Cooking Essentials', royalties: 286.60, spending: 82.35, coverUrl: null, bsrRank: 21450 }
      ]
    },
    charts: {
      monthly: {
        label: 'Monthly Performance',
        data: monthlyChartData
      }
    },
    snapshotInfo: {
      id: 'mock-snapshot-001',
      createdAt: new Date().toISOString(),
      source: 'mock-data',
      currency: 'USD',
      totalRoyalties: 1250.50,
      printOrders: 52,
      digitalOrders: 76
    }
  };
};

export const getMockHistoricalStats = () => {
  const today = new Date();
  const chartData = [];

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    chartData.push({
      date: date.toISOString().split('T')[0],
      royalties: 30 + Math.random() * 50,
      spending: 10 + Math.random() * 25
    });
  }

  return {
    period: {
      startDate: chartData[0].date,
      endDate: chartData[chartData.length - 1].date
    },
    summary: {
      totalGrossRoyalties: 1250.50,
      totalSpending: 480.25,
      totalNetRoyalties: 770.25,
      totalPaidUnits: 145,
      totalFreeUnits: 28,
      totalReads: 45680
    },
    chartData,
    books: [
      { id: '1', asin: 'B0ABC12345', title: 'The Mystery of the Lost Key', grossRoyalties: 520.30, spending: 195.40, netRoyalties: 324.90 },
      { id: '2', asin: 'B0DEF67890', title: 'Digital Marketing Mastery', grossRoyalties: 480.10, spending: 210.60, netRoyalties: 269.50 },
      { id: '3', asin: 'B0GHI11223', title: 'French Cooking Essentials', grossRoyalties: 250.10, spending: 74.25, netRoyalties: 175.85 }
    ],
    bestMonth: '2024-03'
  };
};

export const getMockBookStats = () => {
  const today = new Date();
  const chartData = [];

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    chartData.push({
      date: date.toISOString().split('T')[0],
      value: 20 + Math.random() * 40
    });
  }

  return {
    period: {
      startDate: chartData[0].date,
      endDate: chartData[chartData.length - 1].date
    },
    totalNetRoyalties: 770.25,
    bestDate: chartData.reduce((max, curr) => curr.value > max.value ? curr : max).date,
    chartData,
    books: [
      {
        asin: 'B0ABC12345',
        title: 'The Mystery of the Lost Key',
        paperbacks: 45,
        distribution: 'Amazon + Expanded',
        hardcover: 12,
        ebooksPaid: 68,
        ebooksFree: 15,
        audiobooks: 8,
        adOrders: 43,
        adClicks: 328,
        reads: 15680,
        grossRoyalties: 520.30,
        spending: 195.40
      },
      {
        asin: 'B0DEF67890',
        title: 'Digital Marketing Mastery',
        paperbacks: 38,
        distribution: 'Amazon Only',
        hardcover: 0,
        ebooksPaid: 52,
        ebooksFree: 8,
        audiobooks: 0,
        adOrders: 52,
        adClicks: 412,
        reads: 18500,
        grossRoyalties: 480.10,
        spending: 210.60
      },
      {
        asin: 'B0GHI11223',
        title: 'French Cooking Essentials',
        paperbacks: 28,
        distribution: 'Amazon + Expanded',
        hardcover: 5,
        ebooksPaid: 35,
        ebooksFree: 5,
        audiobooks: 0,
        adOrders: 33,
        adClicks: 245,
        reads: 11500,
        grossRoyalties: 250.10,
        spending: 74.25
      }
    ]
  };
};

export const getMockCountryStats = () => {
  const today = new Date();
  const chartData = [];

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    chartData.push({
      date: date.toISOString().split('T')[0],
      US: 15 + Math.random() * 20,
      UK: 10 + Math.random() * 15,
      DE: 8 + Math.random() * 12,
      FR: 5 + Math.random() * 10,
      IT: 3 + Math.random() * 8,
      ES: 2 + Math.random() * 6
    });
  }

  return {
    period: {
      startDate: chartData[0].date,
      endDate: chartData[chartData.length - 1].date
    },
    totalGlobal: {
      gross: 1250.50,
      overallROI: 160.42,
      amsROI: 160.42,
      amsROAS: 260.42
    },
    countriesData: [
      { marketplace: 'US', countryName: 'United States', royalties: 650.30, spending: 280.50, sales: 85 },
      { marketplace: 'UK', countryName: 'United Kingdom', royalties: 280.15, spending: 110.20, sales: 32 },
      { marketplace: 'DE', countryName: 'Germany', royalties: 180.40, spending: 58.30, sales: 18 },
      { marketplace: 'FR', countryName: 'France', royalties: 90.25, spending: 22.10, sales: 7 },
      { marketplace: 'IT', countryName: 'Italy', royalties: 35.20, spending: 7.05, sales: 2 },
      { marketplace: 'ES', countryName: 'Spain', royalties: 14.20, spending: 2.10, sales: 1 }
    ],
    chartData
  };
};

export const getMockMonthComparison = (month1: string, month2: string) => {
  return {
    month1: {
      month: month1,
      grossRoyalties: 1150.30,
      spending: 450.20,
      netRoyalties: 700.10,
      paidUnits: 132,
      freeUnits: 24,
      kenpReads: 41250
    },
    month2: {
      month: month2,
      grossRoyalties: 1250.50,
      spending: 480.25,
      netRoyalties: 770.25,
      paidUnits: 145,
      freeUnits: 28,
      kenpReads: 45680
    },
    comparison: {
      grossRoyaltiesDiff: 100.20,
      spendingDiff: 30.05,
      netRoyaltiesDiff: 70.15,
      paidUnitsDiff: 13,
      freeUnitsDiff: 4,
      kenpReadsDiff: 4430
    }
  };
};
