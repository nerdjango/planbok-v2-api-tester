import { Request, Response, NextFunction } from 'express';
import { storageService } from '../services/storage';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

/**
 * Session middleware - validates session token from cookie or header
 */
export function sessionMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // Get token from Authorization header or cookie
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (req.cookies?.session as string);

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const session = storageService.findSession(token);
  if (!session) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  const user = storageService.findUserById(session.userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  req.userId = user.id;
  req.user = user;
  next();
}

/**
 * Optional session middleware - attaches user if logged in but doesn't require it
 */
export function optionalSessionMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (req.cookies?.session as string);

  if (token) {
    const session = storageService.findSession(token);
    if (session) {
      const user = storageService.findUserById(session.userId);
      if (user) {
        req.userId = user.id;
        req.user = user;
      }
    }
  }
  next();
}
