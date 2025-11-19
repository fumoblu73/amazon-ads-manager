import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Campaign } from '../models/Campaign';
import { amazonApiService } from '../services/amazonApi';

const router = Router();

// Middleware per autenticazione Bearer token
const requireAuth = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// ================================================
// GET /api/campaigns - Lista tutte le campagne
// ================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const campaignRepository = AppDataSource.getRepository(Campaign);

    // Filtri opzionali
    const {
      state,
      campaignType,
      marketplace,
      minAcos,
      maxAcos,
      includeConfig
    } = req.query;

    const where: any = {};

    if (state) where.state = state;
    if (campaignType) where.campaignType = campaignType;
    if (marketplace) where.marketplace = marketplace;

    // Query builder per filtri avanzati e join opzionale
    let queryBuilder = campaignRepository
      .createQueryBuilder('campaign')
      .orderBy('campaign.createdAt', 'DESC');

    // Applica filtri base
    if (state) queryBuilder.andWhere('campaign.state = :state', { state });
    if (campaignType) queryBuilder.andWhere('campaign.campaignType = :campaignType', { campaignType });
    if (marketplace) queryBuilder.andWhere('campaign.marketplace = :marketplace', { marketplace });

    // Join con automation_config se richiesto
    if (includeConfig === 'true') {
      queryBuilder
        .leftJoinAndSelect('campaign.automationConfig', 'config')
        .leftJoinAndSelect('config.book', 'book');
    }

    const campaigns = await queryBuilder.getMany();

    // Se richiesto, calcola e filtra per ACoS
    // Nota: ACoS non è salvato nella tabella campaigns, quindi questo filtro
    // richiede dati esterni (reports). Per ora restituiamo tutte le campagne
    // TODO: Implementare calcolo ACoS da reports quando disponibile

    res.json({
      success: true,
      count: campaigns.length,
      filters: {
        state: state || 'all',
        campaignType: campaignType || 'all',
        marketplace: marketplace || 'all'
      },
      data: campaigns
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero delle campagne',
      details: error.message
    });
  }
});

// ================================================
// GET /api/campaigns/profiles - Lista tutti i profili Amazon disponibili
// ================================================
// IMPORTANTE: Deve essere PRIMA di /:id altrimenti Express matcha "profiles" come :id
router.get('/profiles', requireAuth, async (req: Request, res: Response) => {
  try {
    console.log('🔍 Recupero profili Amazon...');

    const profiles = await amazonApiService.getProfiles();

    res.json({
      success: true,
      message: 'Profili recuperati con successo',
      data: profiles.map(p => ({
        profileId: p.profileId,
        countryCode: p.countryCode,
        currencyCode: p.currencyCode,
        timezone: p.timezone,
        accountName: p.accountInfo?.name,
        marketplaceId: p.accountInfo?.marketplaceStringId,
        type: p.accountInfo?.type
      }))
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/campaigns/profiles:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero dei profili',
      details: error.message
    });
  }
});

// ================================================
// GET /api/campaigns/:id - Dettagli campagna singola
// ================================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const campaignRepository = AppDataSource.getRepository(Campaign);
    const campaign = await campaignRepository.findOne({
      where: { id: req.params.id }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campagna non trovata'
      });
    }

    res.json({
      success: true,
      data: campaign
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/campaigns/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero della campagna',
      details: error.message
    });
  }
});

// ================================================
// GET /api/campaigns/amazon/:amazonCampaignId - Trova per Amazon ID
// ================================================
router.get('/amazon/:amazonCampaignId', async (req: Request, res: Response) => {
  try {
    const campaignRepository = AppDataSource.getRepository(Campaign);
    const campaign = await campaignRepository.findOne({
      where: { amazonCampaignId: req.params.amazonCampaignId }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campagna non trovata'
      });
    }

    res.json({
      success: true,
      data: campaign
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/campaigns/amazon/:amazonCampaignId:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero della campagna',
      details: error.message
    });
  }
});

// ================================================
// POST /api/campaigns - Crea nuova campagna
// ================================================
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { amazonCampaignId, name, state, dailyBudget, campaignType, biddingStrategy, notes } = req.body;

    // Validazione campi obbligatori
    if (!amazonCampaignId || !name || !state) {
      return res.status(400).json({
        success: false,
        error: 'Campi obbligatori: amazonCampaignId, name, state'
      });
    }

    const campaignRepository = AppDataSource.getRepository(Campaign);

    // Verifica se campaign già esistente
    const existingCampaign = await campaignRepository.findOne({
      where: { amazonCampaignId }
    });

    if (existingCampaign) {
      return res.status(409).json({
        success: false,
        error: 'Campaign ID Amazon già esistente'
      });
    }

    // Crea nuova campagna
    const campaign = campaignRepository.create({
      amazonCampaignId,
      name,
      state,
      dailyBudget,
      campaignType,
      biddingStrategy,
      notes
    });

    await campaignRepository.save(campaign);

    console.log(`✅ Campagna creata: ${campaign.name} (${campaign.amazonCampaignId})`);

    res.status(201).json({
      success: true,
      data: campaign
    });
  } catch (error: any) {
    console.error('❌ Errore POST /api/campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione della campagna',
      details: error.message
    });
  }
});

// ================================================
// PUT /api/campaigns/:id - Aggiorna campagna esistente
// ================================================
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, state, dailyBudget, campaignType, biddingStrategy, notes } = req.body;

    const campaignRepository = AppDataSource.getRepository(Campaign);
    const campaign = await campaignRepository.findOne({
      where: { id: req.params.id }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campagna non trovata'
      });
    }

    // Aggiorna solo i campi forniti
    if (name !== undefined) campaign.name = name;
    if (state !== undefined) campaign.state = state;
    if (dailyBudget !== undefined) campaign.dailyBudget = dailyBudget;
    if (campaignType !== undefined) campaign.campaignType = campaignType;
    if (biddingStrategy !== undefined) campaign.biddingStrategy = biddingStrategy;
    if (notes !== undefined) campaign.notes = notes;

    await campaignRepository.save(campaign);

    console.log(`✅ Campagna aggiornata: ${campaign.name} (${campaign.amazonCampaignId})`);

    res.json({
      success: true,
      data: campaign
    });
  } catch (error: any) {
    console.error('❌ Errore PUT /api/campaigns/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento della campagna',
      details: error.message
    });
  }
});

// ================================================
// DELETE /api/campaigns/:id - Elimina campagna
// ================================================
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const campaignRepository = AppDataSource.getRepository(Campaign);
    const campaign = await campaignRepository.findOne({
      where: { id: req.params.id }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campagna non trovata'
      });
    }

    await campaignRepository.remove(campaign);

    console.log(`✅ Campagna eliminata: ${campaign.name} (${campaign.amazonCampaignId})`);

    res.json({
      success: true,
      message: 'Campagna eliminata con successo'
    });
  } catch (error: any) {
    console.error('❌ Errore DELETE /api/campaigns/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'eliminazione della campagna',
      details: error.message
    });
  }
});

// ================================================
// POST /api/campaigns/sync-from-amazon - Sincronizza campagne da Amazon API
// ================================================
router.post('/sync-from-amazon', requireAuth, async (req: Request, res: Response) => {
  try {
    // Accetta profileId opzionale nel body della request
    const { profileId } = req.body;

    console.log('🔄 Avvio sincronizzazione campagne da Amazon API...');

    // 1. Se profileId è fornito, recupera info del profilo per ottenere il marketplace
    let marketplace = 'US'; // Default
    if (profileId) {
      const profiles = await amazonApiService.getProfiles();
      const selectedProfile = profiles.find(p => p.profileId.toString() === profileId.toString());

      if (!selectedProfile) {
        return res.status(400).json({
          success: false,
          error: `Profilo ${profileId} non trovato`
        });
      }

      marketplace = selectedProfile.countryCode;
      console.log(`📍 Marketplace selezionato: ${marketplace} (Profile ID: ${profileId})`);
    }

    // 2. Recupera campagne da Amazon API
    const amazonCampaigns = profileId
      ? await amazonApiService.getCampaignsForProfile(profileId)
      : await amazonApiService.getCampaigns();
    console.log(`📥 Trovate ${amazonCampaigns.length} campagne su Amazon per marketplace ${marketplace}`);

    const campaignRepository = AppDataSource.getRepository(Campaign);

    let created = 0;
    let updated = 0;
    let errors = 0;

    // 3. Per ogni campagna Amazon, crea o aggiorna nel database
    for (const amazonCampaign of amazonCampaigns) {
      try {
        // Cerca se la campagna esiste già nel database (per questo marketplace)
        let campaign = await campaignRepository.findOne({
          where: {
            amazonCampaignId: amazonCampaign.campaignId.toString(),
            marketplace: marketplace
          }
        });

        if (campaign) {
          // Aggiorna campagna esistente
          campaign.name = amazonCampaign.name;
          campaign.state = amazonCampaign.state;
          campaign.dailyBudget = amazonCampaign.budget?.budget || null;
          campaign.campaignType = amazonCampaign.targetingType || null;
          campaign.biddingStrategy = amazonCampaign.biddingStrategy || null;

          await campaignRepository.save(campaign);
          updated++;
          console.log(`✏️  Aggiornata: ${campaign.name} (${marketplace})`);
        } else {
          // Crea nuova campagna
          campaign = campaignRepository.create({
            amazonCampaignId: amazonCampaign.campaignId.toString(),
            marketplace: marketplace,
            name: amazonCampaign.name,
            state: amazonCampaign.state,
            dailyBudget: amazonCampaign.budget?.budget || null,
            campaignType: amazonCampaign.targetingType || null,
            biddingStrategy: amazonCampaign.biddingStrategy || null,
            notes: `Sincronizzata da Amazon (${marketplace}) il ${new Date().toISOString()}`
          });

          await campaignRepository.save(campaign);
          created++;
          console.log(`✅ Creata: ${campaign.name} (${marketplace})`);
        }
      } catch (error: any) {
        console.error(`❌ Errore sincronizzazione campagna ${amazonCampaign.campaignId}:`, error.message);
        errors++;
      }
    }

    console.log(`✅ Sincronizzazione completata: ${created} create, ${updated} aggiornate, ${errors} errori`);

    res.json({
      success: true,
      message: 'Sincronizzazione completata',
      data: {
        total: amazonCampaigns.length,
        created,
        updated,
        errors
      }
    });
  } catch (error: any) {
    console.error('❌ Errore POST /api/campaigns/sync-from-amazon:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella sincronizzazione delle campagne',
      details: error.message
    });
  }
});

// ================================================
// GET /api/campaigns/stats/summary - Statistiche aggregate
// ================================================
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const campaignRepository = AppDataSource.getRepository(Campaign);

    const [campaigns, totalCount] = await campaignRepository.findAndCount();

    // Conteggi per stato
    const enabledCount = campaigns.filter(c => c.state === 'enabled').length;
    const pausedCount = campaigns.filter(c => c.state === 'paused').length;
    const archivedCount = campaigns.filter(c => c.state === 'archived').length;

    // Budget totale
    const totalBudget = campaigns
      .filter(c => c.dailyBudget)
      .reduce((sum, c) => sum + parseFloat(c.dailyBudget.toString()), 0);

    res.json({
      success: true,
      data: {
        total: totalCount,
        byState: {
          enabled: enabledCount,
          paused: pausedCount,
          archived: archivedCount
        },
        totalDailyBudget: Math.round(totalBudget * 100) / 100
      }
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/campaigns/stats/summary:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel calcolo delle statistiche',
      details: error.message
    });
  }
});

export default router;
