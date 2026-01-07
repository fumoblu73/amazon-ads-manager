import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Campaign } from '../models/Campaign';
import { User } from '../entities/User';
import { amazonApiService } from '../services/amazonApi';
import { createUserAmazonApiService } from '../services/UserAmazonApiFactory';
import { authMiddleware } from '../middleware/auth';
import { requireAmazonAuth, requireAmazonTokens, AuthRequest } from '../middleware/requireAmazonAuth';

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
// GET /api/campaigns - Lista campagne dell'utente autenticato
// ================================================
router.get('/', authMiddleware, requireAmazonAuth, async (req: AuthRequest, res: Response) => {
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

    // Query builder per filtri avanzati - FILTRA PER USERID
    let queryBuilder = campaignRepository
      .createQueryBuilder('campaign')
      .where('campaign.userId = :userId', { userId: req.userId })
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
// GET /api/campaigns/profiles - Lista profili Amazon dell'utente
// IMPORTANTE: Deve essere PRIMA di /:id altrimenti Express matcha "profiles" come :id
// ================================================
router.get('/profiles', authMiddleware, requireAmazonTokens, async (req: AuthRequest, res: Response) => {
  try {
    console.log(`🔍 Fetching Amazon profiles for user ${req.userId}...`);

    const apiService = createUserAmazonApiService(req.userId!);
    const profiles = await apiService.getProfiles();

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
    console.error('❌ Error GET /api/campaigns/profiles:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero dei profili',
      details: error.message
    });
  }
});

// ================================================
// POST /api/campaigns/select-profile - Salva profilo selezionato dall'utente
// ================================================
router.post('/select-profile', authMiddleware, requireAmazonTokens, async (req: AuthRequest, res: Response) => {
  try {
    const { profileId, countryCode, currencyCode } = req.body;

    if (!profileId) {
      return res.status(400).json({
        success: false,
        error: 'profileId is required'
      });
    }

    console.log(`💾 Saving profile ${profileId} for user ${req.userId}...`);

    const userRepository = AppDataSource.getRepository(User);
    await userRepository.update(req.userId!, {
      profileId: parseInt(profileId),
      countryCode: countryCode || null,
      currencyCode: currencyCode || null
    });

    console.log(`✅ Profile ${profileId} saved successfully`);

    res.json({
      success: true,
      message: 'Profile selected successfully',
      data: {
        profileId: parseInt(profileId),
        countryCode,
        currencyCode
      }
    });
  } catch (error: any) {
    console.error('❌ Error POST /api/campaigns/select-profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save profile',
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
// POST /api/campaigns/sync-from-amazon - Sincronizza campagne da Amazon API (per-user)
// ================================================
router.post('/sync-from-amazon', authMiddleware, requireAmazonAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { profileId } = req.body;

    console.log(`🔄 Starting campaign sync for user ${req.userId}...`);

    const apiService = createUserAmazonApiService(req.userId!);
    const campaignRepository = AppDataSource.getRepository(Campaign);
    let created = 0;
    let updated = 0;
    let errors = 0;

    // 1. Get campaigns from Amazon API (uses user's profile automatically)
    let amazonCampaigns: any[];
    let marketplace: string;

    if (profileId) {
      // Sync specific profile
      const profiles = await apiService.getProfiles();
      const selectedProfile = profiles.find(p => p.profileId.toString() === profileId.toString());

      if (!selectedProfile) {
        return res.status(400).json({
          success: false,
          error: `Profile ${profileId} not found`
        });
      }

      marketplace = selectedProfile.countryCode;
      console.log(`📍 Marketplace: ${marketplace} (Profile ID: ${profileId})`);

      amazonCampaigns = await apiService.getCampaignsForProfile(profileId);
    } else {
      // Sync user's default profile
      marketplace = req.user!.countryCode || 'US';
      amazonCampaigns = await apiService.getCampaigns();
    }

    console.log(`📥 Found ${amazonCampaigns.length} campaigns on Amazon for marketplace ${marketplace}`);

    // 2. For each Amazon campaign, create or update in database
    for (const amazonCampaign of amazonCampaigns) {
      try {
        // Find existing campaign (by amazonCampaignId, marketplace AND userId)
        let campaign = await campaignRepository.findOne({
          where: {
            amazonCampaignId: amazonCampaign.campaignId.toString(),
            marketplace: marketplace,
            userId: req.userId  // IMPORTANT: Filter by user
          }
        });

        if (campaign) {
          // Update existing campaign
          campaign.name = amazonCampaign.name;
          campaign.state = amazonCampaign.state;
          campaign.dailyBudget = amazonCampaign.budget?.budget || null;
          campaign.campaignType = amazonCampaign.targetingType || null;
          campaign.biddingStrategy = amazonCampaign.biddingStrategy || null;

          await campaignRepository.save(campaign);
          updated++;
          console.log(`✏️  Updated: ${campaign.name} (${marketplace})`);
        } else {
          // Create new campaign
          campaign = campaignRepository.create({
            userId: req.userId,  // IMPORTANT: Associate with user
            amazonCampaignId: amazonCampaign.campaignId.toString(),
            marketplace: marketplace,
            name: amazonCampaign.name,
            state: amazonCampaign.state,
            dailyBudget: amazonCampaign.budget?.budget || null,
            campaignType: amazonCampaign.targetingType || null,
            biddingStrategy: amazonCampaign.biddingStrategy || null,
            notes: `Synced from Amazon (${marketplace}) on ${new Date().toISOString()}`
          });

          await campaignRepository.save(campaign);
          created++;
          console.log(`✅ Created: ${campaign.name} (${marketplace})`);
        }
      } catch (error: any) {
        console.error(`❌ Error syncing campaign ${amazonCampaign.campaignId}:`, error.message);
        errors++;
      }
    }

    console.log(`✅ Sync completed: ${created} created, ${updated} updated, ${errors} errors`);

    res.json({
      success: true,
      message: 'Sincronizzazione completata',
      data: {
        total: created + updated + errors,
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
