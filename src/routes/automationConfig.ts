import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { AutomationConfigEntity } from '../models/AutomationConfigEntity';
import { Campaign } from '../models/Campaign';
import { Book } from '../models/Book';
import { AutomationConfigModel } from '../models/AutomationConfig';

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
// GET /api/automation-config/:campaignId - Ottieni configurazione per campagna
// ================================================
router.get('/:campaignId', async (req: Request, res: Response) => {
  try {
    const configRepository = AppDataSource.getRepository(AutomationConfigEntity);

    const config = await configRepository.findOne({
      where: { campaignId: req.params.campaignId },
      relations: ['campaign', 'book']
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configurazione non trovata per questa campagna'
      });
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/automation-config/:campaignId:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero della configurazione',
      details: error.message
    });
  }
});

// ================================================
// POST /api/automation-config - Crea nuova configurazione
// ================================================
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { campaignId, bookId, ...configData } = req.body;

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: 'campaignId è obbligatorio'
      });
    }

    const configRepository = AppDataSource.getRepository(AutomationConfigEntity);
    const campaignRepository = AppDataSource.getRepository(Campaign);

    // Verifica che la campagna esista
    const campaign = await campaignRepository.findOne({
      where: { id: campaignId }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campagna non trovata'
      });
    }

    // Verifica se esiste già una configurazione per questa campagna
    const existingConfig = await configRepository.findOne({
      where: { campaignId }
    });

    if (existingConfig) {
      return res.status(409).json({
        success: false,
        error: 'Configurazione già esistente per questa campagna. Usa PUT per aggiornare.'
      });
    }

    // Valida i dati
    const validation = AutomationConfigModel.validate({ campaignId, bookId, ...configData });
    if (validation.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Errori di validazione',
        details: validation
      });
    }

    // Crea la configurazione con i defaults
    const defaults = AutomationConfigModel.getDefaults();
    const config = configRepository.create({
      campaignId,
      bookId: bookId || null,
      ...defaults,
      ...configData
    });

    await configRepository.save(config);

    console.log(`✅ Configurazione creata per campagna ${campaignId}`);

    res.status(201).json({
      success: true,
      data: config
    });
  } catch (error: any) {
    console.error('❌ Errore POST /api/automation-config:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione della configurazione',
      details: error.message
    });
  }
});

// ================================================
// PUT /api/automation-config/:campaignId - Aggiorna configurazione esistente
// ================================================
router.put('/:campaignId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const updateData = req.body;

    const configRepository = AppDataSource.getRepository(AutomationConfigEntity);

    let config = await configRepository.findOne({
      where: { campaignId }
    });

    let configToSave: AutomationConfigEntity;

    if (!config) {
      // Se non esiste, crea una nuova configurazione
      const defaults = AutomationConfigModel.getDefaults();
      const newConfig = configRepository.create({
        campaignId,
        ...defaults,
        ...updateData
      }) as unknown as AutomationConfigEntity;
      configToSave = newConfig;
    } else {
      // Aggiorna i campi forniti
      Object.keys(updateData).forEach(key => {
        if (key !== 'id' && key !== 'campaignId' && key !== 'createdAt' && key !== 'updatedAt') {
          (config as any)[key] = updateData[key];
        }
      });
      configToSave = config;
    }

    // Valida prima di salvare
    const validation = AutomationConfigModel.validate(configToSave as any);
    if (validation.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Errori di validazione',
        details: validation
      });
    }

    await configRepository.save(configToSave);

    console.log(`✅ Configurazione aggiornata per campagna ${campaignId}`);

    res.json({
      success: true,
      data: configToSave
    });
  } catch (error: any) {
    console.error('❌ Errore PUT /api/automation-config/:campaignId:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento della configurazione',
      details: error.message
    });
  }
});

// ================================================
// DELETE /api/automation-config/:campaignId - Elimina configurazione
// ================================================
router.delete('/:campaignId', requireAuth, async (req: Request, res: Response) => {
  try {
    const configRepository = AppDataSource.getRepository(AutomationConfigEntity);

    const config = await configRepository.findOne({
      where: { campaignId: req.params.campaignId }
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configurazione non trovata'
      });
    }

    await configRepository.remove(config);

    console.log(`✅ Configurazione eliminata per campagna ${req.params.campaignId}`);

    res.json({
      success: true,
      message: 'Configurazione eliminata con successo'
    });
  } catch (error: any) {
    console.error('❌ Errore DELETE /api/automation-config/:campaignId:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'eliminazione della configurazione',
      details: error.message
    });
  }
});

// ================================================
// PATCH /api/automation-config/:campaignId/toggle/:functionNumber
// Attiva/Disattiva una singola funzione
// ================================================
router.patch('/:campaignId/toggle/:functionNumber', requireAuth, async (req: Request, res: Response) => {
  try {
    const { campaignId, functionNumber } = req.params;
    const { enabled } = req.body;

    if (enabled === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Il campo "enabled" è obbligatorio'
      });
    }

    const funcNum = parseInt(functionNumber);
    if (funcNum < 1 || funcNum > 5) {
      return res.status(400).json({
        success: false,
        error: 'functionNumber deve essere tra 1 e 5'
      });
    }

    const configRepository = AppDataSource.getRepository(AutomationConfigEntity);

    let config = await configRepository.findOne({
      where: { campaignId }
    });

    if (!config) {
      // Crea configurazione con defaults se non esiste
      const defaults = AutomationConfigModel.getDefaults();
      config = configRepository.create({
        campaignId,
        ...defaults
      });
    }

    // Aggiorna il campo specifico
    const fieldName = `func${funcNum}Enabled` as keyof AutomationConfigEntity;
    (config as any)[fieldName] = enabled;

    await configRepository.save(config);

    console.log(`✅ Funzione ${funcNum} ${enabled ? 'abilitata' : 'disabilitata'} per campagna ${campaignId}`);

    res.json({
      success: true,
      message: `Funzione ${funcNum} ${enabled ? 'abilitata' : 'disabilitata'}`,
      data: config
    });
  } catch (error: any) {
    console.error('❌ Errore PATCH /api/automation-config/:campaignId/toggle/:functionNumber:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel toggle della funzione',
      details: error.message
    });
  }
});

// ================================================
// GET /api/automation-config - Lista tutte le configurazioni
// ================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const configRepository = AppDataSource.getRepository(AutomationConfigEntity);

    const configs = await configRepository.find({
      relations: ['campaign', 'book'],
      order: { createdAt: 'DESC' }
    });

    res.json({
      success: true,
      count: configs.length,
      data: configs
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/automation-config:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero delle configurazioni',
      details: error.message
    });
  }
});

export default router;
