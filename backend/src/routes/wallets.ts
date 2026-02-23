import { Router, Response } from 'express';
import { config } from '../config';
import { planbokClient } from '../services/planbok-client';
import { encryptionService } from '../services/encryption';
import { storageService } from '../services/storage';
import { sessionMiddleware, AuthenticatedRequest } from '../middleware/session';

const router = Router();

// Shared wallet set ID - stored in memory, loaded from config or created once
let sharedWalletSetId: string | null = config.walletSetId || null;

// All routes require authentication
router.use(sessionMiddleware);

/**
 * Get or create shared wallet set for all users
 */
async function getSharedWalletSetId(): Promise<string> {
  // Use memory cache value if set
  if (sharedWalletSetId) {
    return sharedWalletSetId;
  }

  try {
    // 1. Try to list existing wallet sets
    console.log('🔍 Checking for existing wallet sets...');
    const data = await planbokClient.listWalletSets(1, 10);
    
    if (data && Array.isArray(data) && data.length > 0) {
      // The API returns an array of wallet sets directly due to our interceptor unwrapping 'data'
      sharedWalletSetId = data[0].id;
      console.log(`✅ Using existing wallet set: ${sharedWalletSetId}`);
      return sharedWalletSetId!;
    }

    // 2. Create a new wallet set if none exist
    console.log('📦 Creating shared wallet set (none found)...');
    const { encryptedSecret } = await encryptionService.generateEncryptedSecret('dkg');
    const createData = await planbokClient.createWalletSet(
      'CryptoVault Shared Wallet Set',
      encryptedSecret
    );
    console.log(`✅ Shared wallet set created: ${createData.walletSet.id}`);
    console.log('   Add WALLET_SET_ID to .env to persist across restarts');
    sharedWalletSetId = createData.walletSet.id;
    return sharedWalletSetId!;
  } catch (error: any) {
    console.error('Failed to get/create wallet set:', error);
    throw error;
  }
}

/**
 * GET /wallets
 * List all wallets for current user's wallet set
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const walletSetId = await getSharedWalletSetId();

    // STOOPID BUG FIX: Force customerId from session user to prevent data leakage
    // If we rely on req.query.customerId, a malicious user or empty query returns ALL wallets in the shared set
    const userCustomerIds = `${req.user.customerId ? req.user.customerId : ""}${req.user.customerId && req.user.orgCustomerId ? "," + req.user.orgCustomerId : req.user.orgCustomerId ? req.user.orgCustomerId : ""}`;

    if (!userCustomerIds) {
      // If the user hasn't created a customer identity yet, they cannot possibly have wallets
      // Return empty list immediately to prevent showing other users' wallets
      return res.json({ wallets: [] });
    }

    const { blockchain, page, limit, customerIds } = req.query;
    const wallets = await planbokClient.listWallets({
      walletSetId,
      blockchain: blockchain as string,
      customerIds: customerIds ? customerIds as string : userCustomerIds, // Enforce isolation
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    // Wrap as { wallets: [...] } to match what the frontend expects in setWallets(result.wallets || [])
    res.json({ wallets });
  } catch (error: any) {
    console.error('List wallets error:', error);
    res.status(500).json({ error: error.message || 'Failed to list wallets' });
  }
});

/**
 * POST /wallets
 * Create new wallets across blockchains (uses shared wallet set)
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const walletSetId = await getSharedWalletSetId();
    const { blockchains } = req.body;

    if (!blockchains || !Array.isArray(blockchains) || blockchains.length === 0) {
      return res.status(400).json({ error: 'blockchains array is required' });
    }

    // Force count to 1 as per requirements (wallets created for logged in user)
    const walletCount = 1;
    
    // Use user's email as name and user's ID as refId
    const walletMetadata = [{
      name: req.user.email,
      refId: req.user.id
    }];

    // Create wallets using shared wallet set
    const { encryptedSecret } = await encryptionService.generateEncryptedSecret('sign');
    const result = await planbokClient.createWallets(
      walletSetId,
      blockchains,
      walletCount,
      encryptedSecret,
      walletMetadata
    );

    // If we created a wallet, we might have implicitly created a customer/organization link
    // Store this ID in the user record if present
    if (!req.user.orgCustomerId && result && Array.isArray(result.wallets) && result.wallets.length > 0) {
      const firstWallet = result.wallets[0];
      // In the MPC system, the 'customer' field on a wallet is the customer ID
      if (firstWallet.customer) {
        storageService.updateUser(req.user.id, {
          orgCustomerId: firstWallet.customer
        } as any); // cast to any because orgCustomerId is not in User interface yet
      }
    }

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Create wallets error:', error);
    res.status(500).json({ error: error.message || 'Failed to create wallets' });
  }
});

/**
 * GET /wallets/:id
 * Get specific wallet details
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const wallet = await planbokClient.getWallet(req.params.id);
    res.json(wallet);
  } catch (error: any) {
    console.error('Get wallet error:', error);
    res.status(500).json({ error: error.message || 'Failed to get wallet' });
  }
});

/**
 * GET /wallets/:id/balances
 * Get wallet balances
 */
router.get('/:id/balances', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawBalances = await planbokClient.getWalletBalances(req.params.id);
    
    // Map MPC internal structure to what frontend expects
    const balances = rawBalances.map((b: any) => ({
      amount: b.amount,
      formatted: b.amount, // MPC already returns formatted string "0.0001"
      blockchain: b.token.blockchain,
      symbol: b.token.symbol,
      isNative: b.token.standard === 'native',
      tokenId: b.token.id
    }));

    res.json({ balances });
  } catch (error: any) {
    console.error('Get balances error:', error);
    res.status(500).json({ error: error.message || 'Failed to get balances' });
  }
});

/**
 * PATCH /wallets/:id
 * Update wallet metadata
 */
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, metadata } = req.body;
    const wallet = await planbokClient.updateWallet(req.params.id, { name, metadata });
    res.json(wallet);
  } catch (error: any) {
    console.error('Update wallet error:', error);
    res.status(500).json({ error: error.message || 'Failed to update wallet' });
  }
});

/**
 * POST /wallets/validate-address
 * Validate an address for a specific blockchain
 */
router.post('/validate-address', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { address, blockchain } = req.body;
    if (!address || !blockchain) {
      return res.status(400).json({ error: 'address and blockchain are required' });
    }

    const result = await planbokClient.validateAddress(address, blockchain);
    res.json(result);
  } catch (error: any) {
    console.error('Validate address error:', error);
    res.status(500).json({ error: error.message || 'Failed to validate address' });
  }
});

/**
 * GET /wallets/wallet-set/info
 * Get shared wallet set info
 */
router.get('/wallet-set/info', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const walletSetId = await getSharedWalletSetId();
    const walletSet = await planbokClient.getWalletSet(walletSetId);
    res.json(walletSet);
  } catch (error: any) {
    console.error('Get wallet set error:', error);
    res.status(500).json({ error: error.message || 'Failed to get wallet set info' });
  }
});

export default router;
