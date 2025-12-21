import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthRequest extends Request {
  userId?: string;
  body: any;
  query: any;
  params: any;
  headers: any;
}

export interface JwtPayload {
  userId: string;
  email: string;
}

/**
 * Middleware per autenticazione JWT
 * Verifica il token nel cookie auth_token o nell'header Authorization: Bearer <token>
 * Aggiunge userId alla request se valido
 */
export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Try to get token from cookie first, then from Authorization header
    let token = req.cookies?.auth_token;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7); // Rimuove "Bearer "
      }
    }

    if (!token) {
      res.status(401).json({ error: 'Token di autenticazione mancante' });
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      req.userId = decoded.userId;
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({ error: 'Token scaduto' });
      } else if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({ error: 'Token non valido' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Errore nel middleware di autenticazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
};

/**
 * Genera un token JWT per un utente
 */
export const generateToken = (userId: string, email: string): string => {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: '7d' } // Token valido per 7 giorni
  );
};

/**
 * Verifica un token JWT e restituisce il payload
 */
export const verifyToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    return null;
  }
};
