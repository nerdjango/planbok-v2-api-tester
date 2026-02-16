import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { storageService } from '../services/storage';
import { planbokClient } from '../services/planbok-client';
import { encryptionService } from '../services/encryption';
import { sessionMiddleware, AuthenticatedRequest } from '../middleware/session';

const router = Router();

/**
 * POST /auth/signup
 * Create new user account with wallet set
 */
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, custodyMode = 'organization' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check if user exists
    const existingUser = storageService.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const userId = uuidv4();
    const user = storageService.createUser({
      id: userId,
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
    });

    // Create wallet set for organization mode
    if (custodyMode === 'organization') {
      try {
        const { encryptedSecret } = await encryptionService.generateEncryptedSecret('dkg');
        const walletSet = await planbokClient.createWalletSet(
          `${email}'s Wallet Set`,
          encryptedSecret
        );
        storageService.updateUser(userId, { walletSetId: walletSet.id });
      } catch (error: any) {
        console.error('Failed to create wallet set:', error.message);
        // Continue without wallet set - can be created later
      }
    }

    // Create session
    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
    storageService.createSession({
      token: sessionToken,
      userId,
      expiresAt,
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        walletSetId: user.walletSetId,
        customerId: user.customerId,
      },
      token: sessionToken,
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message || 'Signup failed' });
  }
});

/**
 * POST /auth/login
 * Authenticate user and return session token
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = storageService.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create session
    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    storageService.createSession({
      token: sessionToken,
      userId: user.id,
      expiresAt,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        walletSetId: user.walletSetId,
        customerId: user.customerId,
      },
      token: sessionToken,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Login failed' });
  }
});

/**
 * POST /auth/logout
 * Invalidate current session
 */
router.post('/logout', sessionMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (req.cookies?.session as string);

  if (token) {
    storageService.deleteSession(token);
  }

  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /auth/me
 * Get current user info
 */
router.get('/me', sessionMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      walletSetId: req.user.walletSetId,
      customerId: req.user.customerId,
    },
  });
});

/**
 * PATCH /auth/me
 * Update current user info
 */
router.patch('/me', sessionMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const updates = req.body;
    
    // Only allow specific updates for security
    const allowedUpdates = ['customerId'];
    const filteredUpdates: any = {};
    
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid update fields provided' });
    }

    const updatedUser = storageService.updateUser(req.userId!, filteredUpdates);
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        customerId: updatedUser.customerId,
      },
    });
  } catch (error: any) {
    console.error('Update user error:', error);
    res.status(500).json({ error: error.message || 'Update failed' });
  }
});

export default router;
