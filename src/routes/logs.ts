import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { AutomationLog } from '../models/AutomationLog';
import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

const router = Router();

// ================================================
// GET /api/logs - Lista tutti i log con filtri avanzati
// ================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      action,
      ruleName,
      status,
      targetId,
      dateFrom,
      dateTo,
      limit = '100',
      offset = '0',
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const logRepository = AppDataSource.getRepository(AutomationLog);

    // Costruisci filtri dinamicamente
    const where: any = {};

    if (action) where.action = action;
    if (ruleName) where.ruleName = ruleName;
    if (status) where.status = status;
    if (targetId) where.targetId = targetId;

    // Filtro date
    if (dateFrom && dateTo) {
      where.createdAt = Between(new Date(dateFrom as string), new Date(dateTo as string));
    } else if (dateFrom) {
      where.createdAt = MoreThanOrEqual(new Date(dateFrom as string));
    } else if (dateTo) {
      where.createdAt = LessThanOrEqual(new Date(dateTo as string));
    }

    // Query con paginazione
    const [logs, totalCount] = await logRepository.findAndCount({
      where,
      order: { [sortBy as string]: sortOrder === 'ASC' ? 'ASC' : 'DESC' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    res.json({
      success: true,
      count: logs.length,
      total: totalCount,
      page: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
      totalPages: Math.ceil(totalCount / parseInt(limit as string)),
      data: logs
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/logs:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero dei log',
      details: error.message
    });
  }
});

// ================================================
// GET /api/logs/recent - Ultimi 50 log (DEVE ESSERE PRIMA DI /:id)
// ================================================
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const logRepository = AppDataSource.getRepository(AutomationLog);
    const logs = await logRepository.find({
      order: { createdAt: 'DESC' },
      take: limit
    });

    res.json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/logs/recent:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero dei log recenti',
      details: error.message
    });
  }
});

// ================================================
// GET /api/logs/errors - Solo log con errori (DEVE ESSERE PRIMA DI /:id)
// ================================================
router.get('/errors', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;

    const logRepository = AppDataSource.getRepository(AutomationLog);
    const logs = await logRepository.find({
      where: { status: 'failed' },
      order: { createdAt: 'DESC' },
      take: limit
    });

    res.json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/logs/errors:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero dei log di errore',
      details: error.message
    });
  }
});

// ================================================
// GET /api/logs/stats/summary - Statistiche aggregate (DEVE ESSERE PRIMA DI /:id)
// ================================================
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const logRepository = AppDataSource.getRepository(AutomationLog);

    // Filtro date
    const where: any = {};
    if (dateFrom && dateTo) {
      where.createdAt = Between(new Date(dateFrom as string), new Date(dateTo as string));
    } else if (dateFrom) {
      where.createdAt = MoreThanOrEqual(new Date(dateFrom as string));
    } else if (dateTo) {
      where.createdAt = LessThanOrEqual(new Date(dateTo as string));
    }

    const [logs, totalCount] = await logRepository.findAndCount({ where });

    // Conteggi per stato
    const successCount = logs.filter(l => l.status === 'success').length;
    const failedCount = logs.filter(l => l.status === 'failed').length;

    // Conteggi per action
    const actionCounts: Record<string, number> = {};
    logs.forEach(log => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    });

    // Conteggi per ruleName
    const ruleCounts: Record<string, number> = {};
    logs.forEach(log => {
      ruleCounts[log.ruleName] = (ruleCounts[log.ruleName] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        total: totalCount,
        byStatus: {
          success: successCount,
          failed: failedCount,
          successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0
        },
        byAction: actionCounts,
        byRule: ruleCounts,
        period: {
          from: dateFrom || 'N/A',
          to: dateTo || 'N/A'
        }
      }
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/logs/stats/summary:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel calcolo delle statistiche',
      details: error.message
    });
  }
});

// ================================================
// GET /api/logs/actions/distinct - Lista tutte le action uniche (DEVE ESSERE PRIMA DI /:id)
// ================================================
router.get('/actions/distinct', async (req: Request, res: Response) => {
  try {
    const logRepository = AppDataSource.getRepository(AutomationLog);

    const actions = await logRepository
      .createQueryBuilder('log')
      .select('DISTINCT log.action', 'action')
      .getRawMany();

    res.json({
      success: true,
      data: actions.map(a => a.action)
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/logs/actions/distinct:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero delle action',
      details: error.message
    });
  }
});

// ================================================
// GET /api/logs/rules/distinct - Lista tutti i ruleName unici (DEVE ESSERE PRIMA DI /:id)
// ================================================
router.get('/rules/distinct', async (req: Request, res: Response) => {
  try {
    const logRepository = AppDataSource.getRepository(AutomationLog);

    const rules = await logRepository
      .createQueryBuilder('log')
      .select('DISTINCT log.ruleName', 'ruleName')
      .getRawMany();

    res.json({
      success: true,
      data: rules.map(r => r.ruleName)
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/logs/rules/distinct:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero dei rule names',
      details: error.message
    });
  }
});

// ================================================
// GET /api/logs/:id - Dettagli log singolo (DEVE ESSERE ALLA FINE)
// ================================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const logRepository = AppDataSource.getRepository(AutomationLog);
    const log = await logRepository.findOne({
      where: { id: req.params.id }
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Log non trovato'
      });
    }

    res.json({
      success: true,
      data: log
    });
  } catch (error: any) {
    console.error('❌ Errore GET /api/logs/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel recupero del log',
      details: error.message
    });
  }
});

export default router;
