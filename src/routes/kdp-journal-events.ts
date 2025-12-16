import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { JournalEvent, CreateJournalEventInput, UpdateJournalEventInput, JournalEventFilters, JournalEventModel } from '../models/JournalEvent';
import { Between } from 'typeorm';

const router = Router();

// Middleware per autenticazione Bearer token
const requireAuth = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  next();
};

// ================================================
// GET /api/kdp/journal-events - Lista eventi con filtri
// ================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = 'demo-user'; // TODO: Get from auth
    const filters: JournalEventFilters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      eventType: req.query.eventType as any,
      asin: req.query.asin as string,
      marketplace: req.query.marketplace as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50
    };

    const eventRepository = AppDataSource.getRepository(JournalEvent);
    const skip = (filters.page! - 1) * filters.limit!;

    // Build where conditions
    const whereConditions: any = { userId };

    if (filters.eventType) {
      whereConditions.eventType = filters.eventType;
    }

    if (filters.asin) {
      whereConditions.asin = filters.asin;
    }

    if (filters.marketplace) {
      whereConditions.marketplace = filters.marketplace;
    }

    if (filters.startDate && filters.endDate) {
      whereConditions.date = Between(filters.startDate, filters.endDate);
    }

    const [events, total] = await eventRepository.findAndCount({
      where: whereConditions,
      skip,
      take: filters.limit,
      order: { date: 'DESC', createdAt: 'DESC' }
    });

    res.json({
      success: true,
      data: events,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit!)
      }
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/kdp/journal-events:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero degli eventi',
      details: error.message
    });
  }
});

// ================================================
// GET /api/kdp/journal-events/summary - Riepilogo eventi
// ================================================
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const userId = 'demo-user'; // TODO: Get from auth
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const eventRepository = AppDataSource.getRepository(JournalEvent);

    // Build where conditions
    const whereConditions: any = { userId };
    if (startDate && endDate) {
      whereConditions.date = Between(startDate, endDate);
    }

    // Get summary by event type
    const summaryByType = await eventRepository
      .createQueryBuilder('event')
      .select('event.eventType', 'eventType')
      .addSelect('COUNT(event.id)', 'count')
      .addSelect('SUM(event.amount)', 'totalAmount')
      .where('event.userId = :userId', { userId })
      .andWhere(startDate && endDate ? 'event.date BETWEEN :startDate AND :endDate' : '1=1', {
        startDate,
        endDate
      })
      .groupBy('event.eventType')
      .getRawMany();

    // Get total counts
    const totalEvents = await eventRepository.count({ where: whereConditions });

    const summary = {
      totalEvents,
      byType: summaryByType.map(row => ({
        eventType: row.eventType,
        count: parseInt(row.count),
        totalAmount: parseFloat(row.totalAmount || 0)
      })),
      period: { startDate, endDate }
    };

    res.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/kdp/journal-events/summary:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero del riepilogo eventi',
      details: error.message
    });
  }
});

// ================================================
// GET /api/kdp/journal-events/:id - Dettaglio evento singolo
// ================================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = 'demo-user'; // TODO: Get from auth
    const eventRepository = AppDataSource.getRepository(JournalEvent);

    const event = await eventRepository.findOne({
      where: {
        id: req.params.id,
        userId
      }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Evento non trovato'
      });
    }

    res.json({
      success: true,
      data: event
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/kdp/journal-events/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero dell\'evento',
      details: error.message
    });
  }
});

// ================================================
// POST /api/kdp/journal-events - Crea nuovo evento
// ================================================
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const eventData: CreateJournalEventInput = {
      ...req.body,
      userId: 'demo-user' // TODO: Get from auth
    };

    // Validazione
    const errors = JournalEventModel.validate(eventData);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Errore validazione',
        details: errors
      });
    }

    const eventRepository = AppDataSource.getRepository(JournalEvent);
    const event = eventRepository.create(eventData);
    await eventRepository.save(event);

    console.log(`✅ Journal event creato: ${event.eventType} - ${event.amount} (${event.date})`);

    res.status(201).json({
      success: true,
      data: event
    });
  } catch (error: any) {
    console.error('❌ Errore POST /api/kdp/journal-events:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella creazione dell\'evento',
      details: error.message
    });
  }
});

// ================================================
// PUT /api/kdp/journal-events/:id - Aggiorna evento
// ================================================
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const eventData: UpdateJournalEventInput = req.body;

    // Validazione
    const errors = JournalEventModel.validate(eventData);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Errore validazione',
        details: errors
      });
    }

    const eventRepository = AppDataSource.getRepository(JournalEvent);
    const event = await eventRepository.findOne({
      where: {
        id: req.params.id,
        userId: 'demo-user' // TODO: Get from auth
      }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Evento non trovato'
      });
    }

    Object.assign(event, eventData);
    await eventRepository.save(event);

    console.log(`✅ Journal event aggiornato: ${event.eventType} - ${event.amount}`);

    res.json({
      success: true,
      data: event
    });
  } catch (error: any) {
    console.error('❌ Errore PUT /api/kdp/journal-events/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'aggiornamento dell\'evento',
      details: error.message
    });
  }
});

// ================================================
// DELETE /api/kdp/journal-events/:id - Elimina evento
// ================================================
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const eventRepository = AppDataSource.getRepository(JournalEvent);
    const event = await eventRepository.findOne({
      where: {
        id: req.params.id,
        userId: 'demo-user' // TODO: Get from auth
      }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Evento non trovato'
      });
    }

    await eventRepository.remove(event);

    console.log(`✅ Journal event eliminato: ${event.eventType} - ${event.amount}`);

    res.json({
      success: true,
      message: 'Evento eliminato con successo'
    });
  } catch (error: any) {
    console.error('❌ Errore DELETE /api/kdp/journal-events/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'eliminazione dell\'evento',
      details: error.message
    });
  }
});

// ================================================
// POST /api/kdp/journal-events/bulk - Importazione bulk
// ================================================
router.post('/bulk', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = 'demo-user'; // TODO: Get from auth
    const events: CreateJournalEventInput[] = req.body.events || [];

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nessun evento da importare'
      });
    }

    const eventRepository = AppDataSource.getRepository(JournalEvent);
    const createdEvents = [];
    const errors = [];

    for (const eventData of events) {
      try {
        const validationErrors = JournalEventModel.validate(eventData);
        if (validationErrors.length > 0) {
          errors.push({ event: eventData, errors: validationErrors });
          continue;
        }

        const event = eventRepository.create({
          ...eventData,
          userId
        });
        await eventRepository.save(event);
        createdEvents.push(event);
      } catch (err: any) {
        errors.push({ event: eventData, error: err.message });
      }
    }

    console.log(`✅ Bulk import completato: ${createdEvents.length} creati, ${errors.length} errori`);

    res.json({
      success: true,
      data: {
        created: createdEvents.length,
        failed: errors.length,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error: any) {
    console.error('❌ Errore POST /api/kdp/journal-events/bulk:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'importazione bulk',
      details: error.message
    });
  }
});

export default router;
