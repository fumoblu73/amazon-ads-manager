import { AppDataSource } from '../config/database';
import { KdpBook } from '../models/KdpBook';
import { KdpDailyStats } from '../models/KdpDailyStats';
import { JournalEvent } from '../models/JournalEvent';

const DEMO_USER_ID = 'demo-user';

// Sample books data
const sampleBooks = [
  {
    userId: DEMO_USER_ID,
    asin: 'B0ABC12345',
    title: 'The Mystery of the Lost Key',
    marketplace: 'US',
    author: 'John Smith',
    publishDate: new Date('2024-01-15')
  },
  {
    userId: DEMO_USER_ID,
    asin: 'B0DEF67890',
    title: 'Digital Marketing Mastery',
    marketplace: 'US',
    author: 'Jane Doe',
    publishDate: new Date('2024-02-20')
  },
  {
    userId: DEMO_USER_ID,
    asin: 'B0GHI11223',
    title: 'French Cooking Essentials',
    marketplace: 'FR',
    author: 'Pierre Dubois',
    publishDate: new Date('2024-03-10')
  },
  {
    userId: DEMO_USER_ID,
    asin: 'B0JKL44556',
    title: 'Sci-Fi Adventures',
    marketplace: 'UK',
    author: 'Sarah Johnson',
    publishDate: new Date('2023-12-05')
  },
  {
    userId: DEMO_USER_ID,
    asin: 'B0MNO77889',
    title: 'Healthy Living Guide',
    marketplace: 'DE',
    author: 'Hans Mueller',
    publishDate: new Date('2024-01-28')
  }
];

// Generate daily stats for last 60 days
const generateDailyStats = () => {
  const stats = [];
  const today = new Date();
  const asins = sampleBooks.map(b => b.asin);
  const marketplaces = ['US', 'UK', 'DE', 'FR', 'IT', 'ES'];

  for (let i = 0; i < 60; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    // Generate stats for each book
    asins.forEach((asin, index) => {
      const book = sampleBooks[index];
      const baseRoyalties = 5 + Math.random() * 20;
      const baseSpending = 2 + Math.random() * 10;
      const paidUnits = Math.floor(Math.random() * 10) + 1;
      const freeUnits = Math.floor(Math.random() * 5);
      const kenpReads = Math.floor(Math.random() * 5000) + 1000;

      stats.push({
        userId: DEMO_USER_ID,
        date: dateStr,
        asin,
        marketplace: book.marketplace,
        grossRoyalties: parseFloat(baseRoyalties.toFixed(2)),
        spending: parseFloat(baseSpending.toFixed(2)),
        netRoyalties: parseFloat((baseRoyalties - baseSpending).toFixed(2)),
        paidUnits,
        freeUnits,
        kenpReads,
        overallROI: baseSpending > 0 ? parseFloat((((baseRoyalties - baseSpending) / baseSpending) * 100).toFixed(2)) : null,
        amsROI: baseSpending > 0 ? parseFloat((((baseRoyalties - baseSpending) / baseSpending) * 100).toFixed(2)) : null,
        amsROAS: baseSpending > 0 ? parseFloat(((baseRoyalties / baseSpending) * 100).toFixed(2)) : null
      });
    });

    // Also generate aggregated daily stats (without ASIN)
    const dailyTotalRoyalties = 30 + Math.random() * 50;
    const dailyTotalSpending = 15 + Math.random() * 25;

    marketplaces.forEach(marketplace => {
      stats.push({
        userId: DEMO_USER_ID,
        date: dateStr,
        marketplace,
        grossRoyalties: parseFloat((dailyTotalRoyalties / marketplaces.length).toFixed(2)),
        spending: parseFloat((dailyTotalSpending / marketplaces.length).toFixed(2)),
        netRoyalties: parseFloat(((dailyTotalRoyalties - dailyTotalSpending) / marketplaces.length).toFixed(2)),
        paidUnits: Math.floor(Math.random() * 15) + 5,
        freeUnits: Math.floor(Math.random() * 8),
        kenpReads: Math.floor(Math.random() * 10000) + 2000,
        overallROI: parseFloat((((dailyTotalRoyalties - dailyTotalSpending) / dailyTotalSpending) * 100).toFixed(2)),
        amsROI: parseFloat((((dailyTotalRoyalties - dailyTotalSpending) / dailyTotalSpending) * 100).toFixed(2)),
        amsROAS: parseFloat(((dailyTotalRoyalties / dailyTotalSpending) * 100).toFixed(2))
      });
    });
  }

  return stats;
};

// Generate journal events
const generateJournalEvents = () => {
  const events = [];
  const today = new Date();
  const eventTypes = ['sale', 'kenp_read', 'refund', 'adjustment', 'ad_charge'];
  const asins = sampleBooks.map(b => b.asin);

  for (let i = 0; i < 100; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - Math.floor(Math.random() * 60));
    const dateStr = date.toISOString().split('T')[0];

    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const asin = asins[Math.floor(Math.random() * asins.length)];
    const book = sampleBooks.find(b => b.asin === asin);

    let amount = 0;
    let description = '';

    switch (eventType) {
      case 'sale':
        amount = 2 + Math.random() * 8;
        description = 'Book sale royalty';
        break;
      case 'kenp_read':
        amount = 0.5 + Math.random() * 2;
        description = 'KENP read royalty';
        break;
      case 'refund':
        amount = -(2 + Math.random() * 5);
        description = 'Refund processed';
        break;
      case 'adjustment':
        amount = -1 + Math.random() * 2;
        description = 'Account adjustment';
        break;
      case 'ad_charge':
        amount = -(1 + Math.random() * 5);
        description = 'Amazon Ads charge';
        break;
    }

    events.push({
      userId: DEMO_USER_ID,
      date: dateStr,
      asin,
      title: book?.title,
      marketplace: book?.marketplace,
      eventType,
      description,
      amount: parseFloat(amount.toFixed(2)),
      currency: 'USD',
      quantity: eventType === 'sale' ? 1 : undefined
    });
  }

  return events;
};

export const seedKdpData = async () => {
  try {
    console.log('🌱 Starting KDP data seeding...');

    // Clear existing data
    const bookRepository = AppDataSource.getRepository(KdpBook);
    const statsRepository = AppDataSource.getRepository(KdpDailyStats);
    const eventRepository = AppDataSource.getRepository(JournalEvent);

    await eventRepository.delete({ userId: DEMO_USER_ID });
    await statsRepository.delete({ userId: DEMO_USER_ID });
    await bookRepository.delete({ userId: DEMO_USER_ID });

    console.log('✅ Cleared existing demo data');

    // Insert books
    for (const bookData of sampleBooks) {
      const book = bookRepository.create(bookData);
      await bookRepository.save(book);
    }
    console.log(`✅ Inserted ${sampleBooks.length} books`);

    // Insert daily stats
    const dailyStats = generateDailyStats();
    for (const statData of dailyStats) {
      const stat = statsRepository.create(statData);
      await statsRepository.save(stat);
    }
    console.log(`✅ Inserted ${dailyStats.length} daily stats records`);

    // Insert journal events
    const journalEvents = generateJournalEvents();
    for (const eventData of journalEvents) {
      const event = eventRepository.create(eventData);
      await eventRepository.save(event);
    }
    console.log(`✅ Inserted ${journalEvents.length} journal events`);

    console.log('🎉 KDP data seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding KDP data:', error);
    throw error;
  }
};
