import { Between } from 'typeorm';
import { AppDataSource } from '../config/database';
import { KdpBook } from '../entities/KdpBook';
import { KdpDailyStats } from '../entities/KdpDailyStats';

export interface BsrDataPoint {
  date: string;
  bsr: number | null;
  adSpend: number;
  sales: number;
}

export interface BsrStatistics {
  currentBsr: number | null;
  lowestBsr: number | null; // Il BSR più basso (migliore)
  highestBsr: number | null; // Il BSR più alto (peggiore)
  averageBsr: number | null;
  medianBsr: number | null;
  trend: 'improving' | 'declining' | 'stable' | 'no_data';
  trendPercentage: number | null; // Variazione % rispetto all'inizio periodo
  daysTracked: number;
  daysWithoutData: number;
}

export interface BsrCorrelation {
  correlation: number; // Correlazione Pearson tra Ad Spend e BSR (-1 a 1)
  interpretation: string;
  adSpendImpact: 'positive' | 'negative' | 'neutral' | 'insufficient_data';
  averageAdSpend: number;
  averageBsrWhenSpending: number | null;
  averageBsrWhenNotSpending: number | null;
}

export interface BsrAnalysis {
  bookId: string;
  bookTitle: string;
  asin: string;
  marketplace: string;
  period: {
    startDate: string;
    endDate: string;
  };
  statistics: BsrStatistics;
  correlation: BsrCorrelation;
  history: BsrDataPoint[];
}

export class BsrService {
  /**
   * Analizza lo storico BSR di un libro con statistiche e correlazioni
   */
  static async analyzeBsr(
    bookId: string,
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<BsrAnalysis | null> {
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

    if (dailyStats.length === 0) {
      return null;
    }

    // Prepara i dati per l'analisi
    const history: BsrDataPoint[] = dailyStats.map(stat => {
      const dateStr = stat.date instanceof Date
        ? stat.date.toISOString().split('T')[0]
        : String(stat.date).split('T')[0];

      const sales =
        (stat.ebookSales || 0) +
        (stat.paperbackSales || 0) +
        (stat.hardcoverSales || 0);

      return {
        date: dateStr,
        bsr: stat.bsr || null,
        adSpend: Number(stat.adSpend || 0),
        sales
      };
    });

    // Calcola statistiche BSR
    const statistics = this.calculateBsrStatistics(history);

    // Calcola correlazione BSR vs Ad Spend
    const correlation = this.calculateBsrCorrelation(history);

    return {
      bookId: book.id,
      bookTitle: book.title,
      asin: book.asin,
      marketplace: book.marketplace,
      period: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      statistics,
      correlation,
      history
    };
  }

  /**
   * Calcola statistiche BSR
   */
  private static calculateBsrStatistics(history: BsrDataPoint[]): BsrStatistics {
    const bsrValues = history
      .filter(h => h.bsr !== null)
      .map(h => h.bsr as number);

    if (bsrValues.length === 0) {
      return {
        currentBsr: null,
        lowestBsr: null,
        highestBsr: null,
        averageBsr: null,
        medianBsr: null,
        trend: 'no_data',
        trendPercentage: null,
        daysTracked: history.length,
        daysWithoutData: history.length
      };
    }

    // BSR corrente (ultimo disponibile)
    const currentBsr = history
      .slice()
      .reverse()
      .find(h => h.bsr !== null)?.bsr || null;

    // Statistiche di base
    const lowestBsr = Math.min(...bsrValues); // Migliore rank
    const highestBsr = Math.max(...bsrValues); // Peggiore rank
    const averageBsr = Math.round(bsrValues.reduce((a, b) => a + b, 0) / bsrValues.length);

    // Mediana
    const sortedBsr = [...bsrValues].sort((a, b) => a - b);
    const mid = Math.floor(sortedBsr.length / 2);
    const medianBsr =
      sortedBsr.length % 2 === 0
        ? Math.round((sortedBsr[mid - 1] + sortedBsr[mid]) / 2)
        : sortedBsr[mid];

    // Analisi trend (confronta primo e ultimo BSR)
    const firstBsr = bsrValues[0];
    const lastBsr = bsrValues[bsrValues.length - 1];
    const bsrChange = lastBsr - firstBsr;
    const trendPercentage = Math.round((bsrChange / firstBsr) * 100);

    let trend: 'improving' | 'declining' | 'stable' | 'no_data';
    if (bsrChange < -500) {
      trend = 'improving'; // BSR diminuisce = migliora
    } else if (bsrChange > 500) {
      trend = 'declining'; // BSR aumenta = peggiora
    } else {
      trend = 'stable';
    }

    return {
      currentBsr,
      lowestBsr,
      highestBsr,
      averageBsr,
      medianBsr,
      trend,
      trendPercentage,
      daysTracked: history.length,
      daysWithoutData: history.length - bsrValues.length
    };
  }

  /**
   * Calcola la correlazione tra BSR e Ad Spend
   * Correlazione negativa = più spesa pubblicitaria, BSR migliore (desiderabile)
   */
  private static calculateBsrCorrelation(history: BsrDataPoint[]): BsrCorrelation {
    // Filtra solo i giorni con BSR disponibile
    const validData = history.filter(h => h.bsr !== null);

    if (validData.length < 3) {
      return {
        correlation: 0,
        interpretation: 'Dati insufficienti per calcolare la correlazione (minimo 3 giorni)',
        adSpendImpact: 'insufficient_data',
        averageAdSpend: 0,
        averageBsrWhenSpending: null,
        averageBsrWhenNotSpending: null
      };
    }

    // Calcola correlazione di Pearson
    const n = validData.length;
    const bsrValues = validData.map(d => d.bsr as number);
    const adSpendValues = validData.map(d => d.adSpend);

    const meanBsr = bsrValues.reduce((a, b) => a + b, 0) / n;
    const meanAdSpend = adSpendValues.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomBsr = 0;
    let denomAdSpend = 0;

    for (let i = 0; i < n; i++) {
      const bsrDiff = bsrValues[i] - meanBsr;
      const adSpendDiff = adSpendValues[i] - meanAdSpend;

      numerator += bsrDiff * adSpendDiff;
      denomBsr += bsrDiff * bsrDiff;
      denomAdSpend += adSpendDiff * adSpendDiff;
    }

    const correlation =
      denomBsr === 0 || denomAdSpend === 0
        ? 0
        : numerator / Math.sqrt(denomBsr * denomAdSpend);

    // Interpreta la correlazione
    let interpretation: string;
    let adSpendImpact: 'positive' | 'negative' | 'neutral' | 'insufficient_data';

    if (Math.abs(correlation) < 0.3) {
      interpretation = 'Correlazione debole: la spesa pubblicitaria ha poco impatto sul BSR';
      adSpendImpact = 'neutral';
    } else if (correlation < -0.3) {
      interpretation =
        'Correlazione negativa: aumentando la spesa pubblicitaria, il BSR migliora (diminuisce)';
      adSpendImpact = 'positive';
    } else {
      interpretation =
        'Correlazione positiva: aumentando la spesa pubblicitaria, il BSR peggiora (aumenta)';
      adSpendImpact = 'negative';
    }

    // Calcola BSR medio quando si spende vs quando non si spende
    const daysWithSpending = validData.filter(d => d.adSpend > 0);
    const daysWithoutSpending = validData.filter(d => d.adSpend === 0);

    const averageBsrWhenSpending =
      daysWithSpending.length > 0
        ? Math.round(
            daysWithSpending.reduce((sum, d) => sum + (d.bsr as number), 0) /
              daysWithSpending.length
          )
        : null;

    const averageBsrWhenNotSpending =
      daysWithoutSpending.length > 0
        ? Math.round(
            daysWithoutSpending.reduce((sum, d) => sum + (d.bsr as number), 0) /
              daysWithoutSpending.length
          )
        : null;

    return {
      correlation: Math.round(correlation * 100) / 100,
      interpretation,
      adSpendImpact,
      averageAdSpend: Math.round(meanAdSpend * 100) / 100,
      averageBsrWhenSpending,
      averageBsrWhenNotSpending
    };
  }

  /**
   * Confronta il BSR di più libri nello stesso periodo
   */
  static async compareBsr(
    bookIds: string[],
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    bookId: string;
    bookTitle: string;
    asin: string;
    statistics: BsrStatistics;
  }>> {
    const results = [];

    for (const bookId of bookIds) {
      const analysis = await this.analyzeBsr(bookId, userId, startDate, endDate);

      if (analysis) {
        results.push({
          bookId: analysis.bookId,
          bookTitle: analysis.bookTitle,
          asin: analysis.asin,
          statistics: analysis.statistics
        });
      }
    }

    return results;
  }
}
