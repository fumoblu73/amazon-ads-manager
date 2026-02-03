import { Router, Response } from 'express';
import { AppDataSource } from '../config/database';
import { AutomationSettings } from '../entities/AutomationSettings';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// ================================================
// GET /api/settings - Recupera settings utente
// ================================================
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const settingsRepository = AppDataSource.getRepository(AutomationSettings);

    let settings = await settingsRepository.findOne({
      where: { userId }
    });

    // Se l'utente non ha settings, crea impostazioni di default
    if (!settings) {
      settings = settingsRepository.create({
        userId,
        // I valori di default sono già definiti nell'entity
      });
      await settingsRepository.save(settings);
    }

    // Formatta la risposta per il frontend
    const response = {
      func1: {
        enabled: settings.func1Enabled,
        bidIncrease: parseFloat(settings.func1BidIncrease.toString()),
        frequency: settings.func1Frequency,
        impressions: settings.func1Impressions,
        clicks: settings.func1Clicks,
      },
      func2: {
        enabled: settings.func2Enabled,
        frequency: settings.func2Frequency,
        timeframeWeeks: settings.func2TimeframeWeeks,
      },
      func3: {
        enabled: settings.func3Enabled,
        frequency: settings.func3Frequency,
        timeframeA: settings.func3TimeframeA,
        timeframeB: settings.func3TimeframeB,
        timeframeC: settings.func3TimeframeC,
        clicksPause: settings.func3ClicksPause,
        clicks65days: settings.func3Clicks65days,
      },
      func4: {
        enabled: settings.func4Enabled,
        frequency: settings.func4Frequency,
        timeframeA: settings.func4TimeframeA,
        timeframeB: settings.func4TimeframeB,
        timeframeC: settings.func4TimeframeC,
        clicksNegative: settings.func4ClicksNegative,
        spendNegative: parseFloat(settings.func4SpendNegative.toString()),
      },
      func5: {
        enabled: settings.func5Enabled,
        frequency: settings.func5Frequency,
        minOrders: settings.func5MinOrders,
        bidBroad: parseFloat(settings.func5BidBroad.toString()),
        bidExact: parseFloat(settings.func5BidExact.toString()),
        bidPhrase: parseFloat(settings.func5BidPhrase.toString()),
        bidExpanded: parseFloat(settings.func5BidExpanded.toString()),
      },
      fastAcos: {
        useVat: settings.useVatInFastAcos ?? true,
        vatPercentage: parseFloat((settings.vatPercentage ?? 22).toString()),
      },
    };

    res.json({
      success: true,
      data: response
    });
  } catch (error: any) {
    console.error('Errore GET /api/settings:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero delle impostazioni',
      details: error.message
    });
  }
});

// ================================================
// PUT /api/settings - Aggiorna settings utente
// ================================================
router.put('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const settingsRepository = AppDataSource.getRepository(AutomationSettings);

    let settings = await settingsRepository.findOne({
      where: { userId }
    });

    if (!settings) {
      settings = settingsRepository.create({ userId });
    }

    // Aggiorna i valori dai dati ricevuti
    const { func1, func2, func3, func4, func5, fastAcos } = req.body;

    if (func1) {
      settings.func1Enabled = func1.enabled ?? settings.func1Enabled;
      settings.func1BidIncrease = func1.bidIncrease ?? settings.func1BidIncrease;
      settings.func1Frequency = func1.frequency ?? settings.func1Frequency;
      settings.func1Impressions = func1.impressions ?? settings.func1Impressions;
      settings.func1Clicks = func1.clicks ?? settings.func1Clicks;
    }

    if (func2) {
      settings.func2Enabled = func2.enabled ?? settings.func2Enabled;
      settings.func2Frequency = func2.frequency ?? settings.func2Frequency;
      settings.func2TimeframeWeeks = func2.timeframeWeeks ?? settings.func2TimeframeWeeks;
    }

    if (func3) {
      settings.func3Enabled = func3.enabled ?? settings.func3Enabled;
      settings.func3Frequency = func3.frequency ?? settings.func3Frequency;
      settings.func3TimeframeA = func3.timeframeA ?? settings.func3TimeframeA;
      settings.func3TimeframeB = func3.timeframeB ?? settings.func3TimeframeB;
      settings.func3TimeframeC = func3.timeframeC ?? settings.func3TimeframeC;
      settings.func3ClicksPause = func3.clicksPause ?? settings.func3ClicksPause;
      settings.func3Clicks65days = func3.clicks65days ?? settings.func3Clicks65days;
    }

    if (func4) {
      settings.func4Enabled = func4.enabled ?? settings.func4Enabled;
      settings.func4Frequency = func4.frequency ?? settings.func4Frequency;
      settings.func4TimeframeA = func4.timeframeA ?? settings.func4TimeframeA;
      settings.func4TimeframeB = func4.timeframeB ?? settings.func4TimeframeB;
      settings.func4TimeframeC = func4.timeframeC ?? settings.func4TimeframeC;
      settings.func4ClicksNegative = func4.clicksNegative ?? settings.func4ClicksNegative;
      settings.func4SpendNegative = func4.spendNegative ?? settings.func4SpendNegative;
    }

    if (func5) {
      settings.func5Enabled = func5.enabled ?? settings.func5Enabled;
      settings.func5Frequency = func5.frequency ?? settings.func5Frequency;
      settings.func5MinOrders = func5.minOrders ?? settings.func5MinOrders;
      settings.func5BidBroad = func5.bidBroad ?? settings.func5BidBroad;
      settings.func5BidExact = func5.bidExact ?? settings.func5BidExact;
      settings.func5BidPhrase = func5.bidPhrase ?? settings.func5BidPhrase;
      settings.func5BidExpanded = func5.bidExpanded ?? settings.func5BidExpanded;
    }

    if (fastAcos) {
      settings.useVatInFastAcos = fastAcos.useVat ?? settings.useVatInFastAcos;
      settings.vatPercentage = fastAcos.vatPercentage ?? settings.vatPercentage;
    }

    await settingsRepository.save(settings);

    res.json({
      success: true,
      message: 'Impostazioni salvate con successo'
    });
  } catch (error: any) {
    console.error('Errore PUT /api/settings:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel salvataggio delle impostazioni',
      details: error.message
    });
  }
});

export default router;
