import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * POST /api/auth/register
 * Registra un nuovo utente
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validazione input
    if (!email || !password) {
      res.status(400).json({ error: 'Email e password sono obbligatori' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'La password deve contenere almeno 8 caratteri' });
      return;
    }

    const userRepo = AppDataSource.getRepository(User);

    // Verifica se l'utente esiste già
    const existingUser = await userRepo.findOne({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'Email già registrata' });
      return;
    }

    // Hash della password
    const passwordHash = await bcrypt.hash(password, 10);

    // Crea il nuovo utente
    const user = userRepo.create({
      email,
      passwordHash
    });

    await userRepo.save(user);

    // Genera il token JWT
    const token = generateToken(user.id, user.email);

    res.status(201).json({
      message: 'Utente registrato con successo',
      token,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Errore durante la registrazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * POST /api/auth/login
 * Effettua il login
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validazione input
    if (!email || !password) {
      res.status(400).json({ error: 'Email e password sono obbligatori' });
      return;
    }

    const userRepo = AppDataSource.getRepository(User);

    // Cerca l'utente
    const user = await userRepo.findOne({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Credenziali non valide' });
      return;
    }

    // Verifica la password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Credenziali non valide' });
      return;
    }

    // Genera il token JWT
    const token = generateToken(user.id, user.email);

    res.json({
      message: 'Login effettuato con successo',
      token,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Errore durante il login:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * GET /api/auth/me
 * Restituisce le informazioni dell'utente autenticato
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userRepo = AppDataSource.getRepository(User);

    const user = await userRepo.findOne({
      where: { id: req.userId },
      select: ['id', 'email', 'createdAt', 'updatedAt']
    });

    if (!user) {
      res.status(404).json({ error: 'Utente non trovato' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Errore nel recupero dati utente:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;
