import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { AppDataSource } from '../config/database';
import { KdpBook } from '../entities/KdpBook';
import { KdpDailyStats } from '../entities/KdpDailyStats';

export interface AnalyticsMetrics {
  totalRoyalties: number;
  totalAdSpend: number;
  netProfit: number;
  roi: number | null; // percentuale
  acos: number | null; // percentuale
  roas: number | null; // ratio
  totalSales: number; // unità vendute totali
  totalKenpReads: number;
  averageBsr: number | null;
  daysWithData: number;
}

export interface DailyAnalytics {
  date: string;
  royalties: number;
  adSpend: number;
  netProfit: number;
  roi: number | null;
  acos: number | null;
  sales: number;
  kenpReads: number;
  bsr: number | null;
}

export interface AnalyticsResponse {
  bookId: string;
  bookTitle: string;
  asin: string;
  marketplace: string;
  period: {
    startDate: string;
    endDate: string;
  };
  overall: AnalyticsMetrics;
  daily: DailyAnalytics[];
}

export class AnalyticsService {
  /**
   * Calcola le metriche analytics per un libro in un periodo specificato
   */
  static async calculateBookAnalytics(
    bookId: string,
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AnalyticsResponse | null> {
    const bookRepo = AppDataSource.getRepository(KdpBook);
    const statsRepo = AppDataSource.getRepository(KdpDailyStats);

    // Verifica che il libro appartenga all'utente
    const book = await bookRepo.findOne({
      where: { id: bookId, userId }
    });

    if (!book) {
      return null;
    }

    // Recupera le statistiche giornaliere nel periodo
    const dailyStats = await statsRepo.find({
      where: {
        bookId,
        date: Between(startDate, endDate)
      },
      order: { date: 'ASC' }
    });

    // Calcola metriche aggregate
    let totalRoyalties = 0;
    let totalAdSpend = 0;
    let totalSales = 0;
    let totalKenpReads = 0;
    let bsrSum = 0;
    let bsrCount = 0;

    const daily: DailyAnalytics[] = dailyStats.map(stat => {
      const dayRoyalties =
        Number(stat.ebookRoyalty || 0) +
        Number(stat.paperbackRoyalty || 0) +
        Number(stat.hardcoverRoyalty || 0) +
        Number(stat.kenpRoyalty || 0);

      const dayAdSpend = Number(stat.adSpend || 0);
      const dayNetProfit = dayRoyalties - dayAdSpend;
      const daySales =
        (stat.ebookSales || 0) +
        (stat.paperbackSales || 0) +
        (stat.hardcoverSales || 0);
      const dayKenpReads = stat.kenpReads || 0;

      // Accumula per metriche totali
      totalRoyalties += dayRoyalties;
      totalAdSpend += dayAdSpend;
      totalSales += daySales;
      totalKenpReads += dayKenpReads;

      if (stat.bsr) {
        bsrSum += stat.bsr;
        bsrCount++;
      }

      // TypeORM può restituire date come string o Date, gestisci entrambi i casi
      const dateStr = stat.date instanceof Date
        ? stat.date.toISOString().split('T')[0]
        : String(stat.date).split('T')[0];

      return {
        date: dateStr,
        royalties: Math.round(dayRoyalties * 100) / 100,
        adSpend: Math.round(dayAdSpend * 100) / 100,
        netProfit: Math.round(dayNetProfit * 100) / 100,
        roi: dayAdSpend > 0 ? Math.round((dayNetProfit / dayAdSpend) * 10000) / 100 : null,
        acos: dayRoyalties > 0 ? Math.round((dayAdSpend / dayRoyalties) * 10000) / 100 : null,
        sales: daySales,
        kenpReads: dayKenpReads,
        bsr: stat.bsr || null
      };
    });

    // Calcola metriche complessive
    const netProfit = totalRoyalties - totalAdSpend;
    const roi = totalAdSpend > 0 ? (netProfit / totalAdSpend) * 100 : null;
    const acos = totalRoyalties > 0 ? (totalAdSpend / totalRoyalties) * 100 : null;
    const roas = totalAdSpend > 0 ? totalRoyalties / totalAdSpend : null;
    const averageBsr = bsrCount > 0 ? Math.round(bsrSum / bsrCount) : null;

    const overall: AnalyticsMetrics = {
      totalRoyalties: Math.round(totalRoyalties * 100) / 100,
      totalAdSpend: Math.round(totalAdSpend * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      roi: roi !== null ? Math.round(roi * 100) / 100 : null,
      acos: acos !== null ? Math.round(acos * 100) / 100 : null,
      roas: roas !== null ? Math.round(roas * 100) / 100 : null,
      totalSales,
      totalKenpReads,
      averageBsr,
      daysWithData: dailyStats.length
    };

    return {
      bookId: book.id,
      bookTitle: book.title,
      asin: book.asin,
      marketplace: book.marketplace,
      period: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      overall,
      daily
    };
  }

  /**
   * Calcola le metriche aggregate per tutti i libri di un utente
   */
  static async calculateUserAnalytics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    overall: AnalyticsMetrics;
    byBook: Array<{
      bookId: string;
      bookTitle: string;
      asin: string;
      metrics: AnalyticsMetrics;
    }>;
  }> {
    const bookRepo = AppDataSource.getRepository(KdpBook);
    const statsRepo = AppDataSource.getRepository(KdpDailyStats);

    // Recupera tutti i libri dell'utente
    const books = await bookRepo.find({
      where: { userId }
    });

    let totalRoyalties = 0;
    let totalAdSpend = 0;
    let totalSales = 0;
    let totalKenpReads = 0;
    let totalDaysWithData = 0;
    let bsrSum = 0;
    let bsrCount = 0;

    const byBook = [];

    for (const book of books) {
      const dailyStats = await statsRepo.find({
        where: {
          bookId: book.id,
          date: Between(startDate, endDate)
        }
      });

      let bookRoyalties = 0;
      let bookAdSpend = 0;
      let bookSales = 0;
      let bookKenpReads = 0;

      dailyStats.forEach(stat => {
        const dayRoyalties =
          Number(stat.ebookRoyalty || 0) +
          Number(stat.paperbackRoyalty || 0) +
          Number(stat.hardcoverRoyalty || 0) +
          Number(stat.kenpRoyalty || 0);

        bookRoyalties += dayRoyalties;
        bookAdSpend += Number(stat.adSpend || 0);
        bookSales += (stat.ebookSales || 0) + (stat.paperbackSales || 0) + (stat.hardcoverSales || 0);
        bookKenpReads += stat.kenpReads || 0;

        if (stat.bsr) {
          bsrSum += stat.bsr;
          bsrCount++;
        }
      });

      totalRoyalties += bookRoyalties;
      totalAdSpend += bookAdSpend;
      totalSales += bookSales;
      totalKenpReads += bookKenpReads;
      totalDaysWithData += dailyStats.length;

      const bookNetProfit = bookRoyalties - bookAdSpend;

      byBook.push({
        bookId: book.id,
        bookTitle: book.title,
        asin: book.asin,
        metrics: {
          totalRoyalties: Math.round(bookRoyalties * 100) / 100,
          totalAdSpend: Math.round(bookAdSpend * 100) / 100,
          netProfit: Math.round(bookNetProfit * 100) / 100,
          roi: bookAdSpend > 0 ? Math.round((bookNetProfit / bookAdSpend) * 10000) / 100 : null,
          acos: bookRoyalties > 0 ? Math.round((bookAdSpend / bookRoyalties) * 10000) / 100 : null,
          roas: bookAdSpend > 0 ? Math.round((bookRoyalties / bookAdSpend) * 100) / 100 : null,
          totalSales: bookSales,
          totalKenpReads: bookKenpReads,
          averageBsr: null, // Per ora non calcoliamo media BSR per libro singolo
          daysWithData: dailyStats.length
        }
      });
    }

    const netProfit = totalRoyalties - totalAdSpend;

    const overall: AnalyticsMetrics = {
      totalRoyalties: Math.round(totalRoyalties * 100) / 100,
      totalAdSpend: Math.round(totalAdSpend * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      roi: totalAdSpend > 0 ? Math.round((netProfit / totalAdSpend) * 10000) / 100 : null,
      acos: totalRoyalties > 0 ? Math.round((totalAdSpend / totalRoyalties) * 10000) / 100 : null,
      roas: totalAdSpend > 0 ? Math.round((totalRoyalties / totalAdSpend) * 100) / 100 : null,
      totalSales,
      totalKenpReads,
      averageBsr: bsrCount > 0 ? Math.round(bsrSum / bsrCount) : null,
      daysWithData: totalDaysWithData
    };

    return {
      overall,
      byBook
    };
  }
}
