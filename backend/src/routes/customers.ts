import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { planbokClient } from '../services/planbok-client';
import { storageService } from '../services/storage';
import { sessionMiddleware, AuthenticatedRequest } from '../middleware/session';

const router = Router();

router.use(sessionMiddleware);

/**
 * POST /customers
 * Create a new customer for self-custody mode
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name } = req.body;

    const customer = await planbokClient.createCustomer(name || req.user.email, req.userId);
    
    // Update user with customer ID
    storageService.updateUser(req.userId!, { customerId: customer.id });

    res.status(201).json(customer);
  } catch (error: any) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: error.message || 'Failed to create customer' });
  }
});

/**
 * GET /customers
 * List customers
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page, limit } = req.query;
    const customers = await planbokClient.listCustomers(
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined
    );
    res.json(customers);
  } catch (error: any) {
    console.error('List customers error:', error);
    res.status(500).json({ error: error.message || 'Failed to list customers' });
  }
});

/**
 * GET /customers/:id
 * Get customer details
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customer = await planbokClient.getCustomer(req.params.id);
    res.json(customer);
  } catch (error: any) {
    console.error('Get customer error:', error);
    res.status(500).json({ error: error.message || 'Failed to get customer' });
  }
});

/**
 * POST /customers/:id/initialize
 * Initialize customer PIN setup
 */
router.post('/:id/initialize', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { redirectUrl } = req.body;

    if (!redirectUrl) {
      return res.status(400).json({ error: 'redirectUrl is required' });
    }

    const result = await planbokClient.initializeCustomer(
      req.params.id,
      redirectUrl
    );

    // Store challenge for tracking
    storageService.createChallenge({
      id: uuidv4(),
      userId: req.userId!,
      customerId: req.params.id,
      challengeId: result.challengeId,
      type: 'initialize',
      status: 'pending',
      redirectUrl: result.redirectUrl,
      createdAt: new Date().toISOString(),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Initialize customer error:', error);
    res.status(500).json({ error: error.message || 'Failed to initialize customer' });
  }
});

/**
 * POST /customers/:id/recovery
 * Setup customer recovery
 */
router.post('/:id/recovery', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { redirectUrl } = req.body;

    if (!redirectUrl) {
      return res.status(400).json({ error: 'redirectUrl is required' });
    }

    const result = await planbokClient.setupRecoveryChallenge(
      req.params.id,
      redirectUrl
    );

    // Store challenge
    storageService.createChallenge({
      id: uuidv4(),
      userId: req.userId!,
      customerId: req.params.id,
      challengeId: result.challengeId,
      type: 'recovery',
      status: 'pending',
      redirectUrl: result.redirectUrl,
      createdAt: new Date().toISOString(),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Setup recovery error:', error);
    res.status(500).json({ error: error.message || 'Failed to setup recovery' });
  }
});

/**
 * POST /customers/:id/pin/update
 * Update customer PIN
 */
router.post('/:id/pin/update', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { redirectUrl } = req.body;

    if (!redirectUrl) {
      return res.status(400).json({ error: 'redirectUrl is required' });
    }

    const result = await planbokClient.updatePinChallenge(
      req.params.id,
      redirectUrl
    );

    // Store challenge
    storageService.createChallenge({
      id: uuidv4(),
      userId: req.userId!,
      customerId: req.params.id,
      challengeId: result.challengeId,
      type: 'update-pin',
      status: 'pending',
      redirectUrl: result.redirectUrl,
      createdAt: new Date().toISOString(),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Update PIN error:', error);
    res.status(500).json({ error: error.message || 'Failed to update PIN' });
  }
});

/**
 * POST /customers/:id/pin/reset
 * Reset customer PIN
 */
router.post('/:id/pin/reset', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { redirectUrl } = req.body;

    if (!redirectUrl) {
      return res.status(400).json({ error: 'redirectUrl is required' });
    }

    const result = await planbokClient.resetPinChallenge(
      req.params.id,
      redirectUrl
    );

    // Store challenge
    storageService.createChallenge({
      id: uuidv4(),
      userId: req.userId!,
      customerId: req.params.id,
      challengeId: result.challengeId,
      type: 'reset-pin',
      status: 'pending',
      redirectUrl: result.redirectUrl,
      createdAt: new Date().toISOString(),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Reset PIN error:', error);
    res.status(500).json({ error: error.message || 'Failed to reset PIN' });
  }
});

/**
 * POST /customers/:id/wallet/create
 * Create customer wallets
 */
router.post('/:id/wallet/create', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { blockchains, redirectUrl } = req.body;

    if (!blockchains || !Array.isArray(blockchains) || blockchains.length === 0) {
      return res.status(400).json({ error: 'blockchains array is required' });
    }

    if (!redirectUrl) {
      return res.status(400).json({ error: 'redirectUrl is required' });
    }

    const result = await planbokClient.createCustomerWalletChallenge(
      req.params.id,
      blockchains,
      redirectUrl
    );

    // Store challenge
    storageService.createChallenge({
      id: uuidv4(),
      userId: req.userId!,
      customerId: req.params.id,
      challengeId: result.challengeId,
      type: 'create-wallet',
      status: 'pending',
      redirectUrl: result.redirectUrl,
      createdAt: new Date().toISOString(),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Create wallet error:', error);
    res.status(500).json({ error: error.message || 'Failed to create wallet' });
  }
});

/**
 * POST /customers/:id/transactions/transfer
 * Create transfer challenge for customer
 */
router.post('/:id/transactions/transfer', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { walletId, destinationAddress, amount, tokenId, feeLevel, redirectUrl } = req.body;

    if (!walletId || !destinationAddress || !amount || !redirectUrl) {
      return res.status(400).json({ 
        error: 'walletId, destinationAddress, amount, and redirectUrl are required' 
      });
    }

    const result = await planbokClient.createCustomerTransferChallenge(req.params.id, {
      walletId,
      destinationAddress,
      amounts: [amount],
      tokenId,
      feeLevel,
      redirectUrl,
    });

    // Store challenge
    storageService.createChallenge({
      id: uuidv4(),
      userId: req.userId!,
      customerId: req.params.id,
      challengeId: result.challengeId,
      type: 'transfer',
      status: 'pending',
      redirectUrl: result.redirectUrl,
      createdAt: new Date().toISOString(),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Customer transfer challenge error:', error);
    res.status(500).json({ error: error.message || 'Failed to create transfer challenge' });
  }
});

/**
 * POST /customers/:id/transactions/contract-execution
 * Create contract execution challenge for customer
 */
router.post('/:id/transactions/contract-execution', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { walletId, contractAddress, abiFunctionSignature, abiParameters, amount, feeLevel, redirectUrl } = req.body;

    if (!walletId || !contractAddress || !redirectUrl) {
      return res.status(400).json({ 
        error: 'walletId, contractAddress, and redirectUrl are required' 
      });
    }

    const result = await planbokClient.createCustomerContractChallenge(req.params.id, {
      walletId,
      contractAddress,
      abiFunctionSignature,
      abiParameters,
      amount,
      feeLevel,
      redirectUrl,
    });

    // Store challenge
    storageService.createChallenge({
      id: uuidv4(),
      userId: req.userId!,
      customerId: req.params.id,
      challengeId: result.challengeId,
      type: 'contract-execution',
      status: 'pending',
      redirectUrl: result.redirectUrl,
      createdAt: new Date().toISOString(),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Customer contract challenge error:', error);
    res.status(500).json({ error: error.message || 'Failed to create contract challenge' });
  }
});

/**
 * POST /customers/:id/sign/message
 * Create message signing challenge for customer
 */
router.post('/:id/sign/message', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { walletId, message, redirectUrl, encodedByHex } = req.body;

    if (!walletId || !message || !redirectUrl) {
      return res.status(400).json({ 
        error: 'walletId, message, and redirectUrl are required' 
      });
    }

    const result = await planbokClient.createCustomerSignMessageChallenge(req.params.id, {
      walletId,
      message,
      encodedByHex,
      redirectUrl,
    });

    // Store challenge
    storageService.createChallenge({
      id: uuidv4(),
      userId: req.userId!,
      customerId: req.params.id,
      challengeId: result.challengeId,
      type: 'sign-message',
      status: 'pending',
      redirectUrl: result.redirectUrl,
      createdAt: new Date().toISOString(),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Customer sign message challenge error:', error);
    res.status(500).json({ error: error.message || 'Failed to create sign message challenge' });
  }
});

/**
 * GET /customers/:id/challenges/:challengeId
 * Get challenge status
 */
router.get('/:id/challenges/:challengeId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await planbokClient.getChallenge(req.params.id, req.params.challengeId);
    
    // Update local challenge status if completed
    const challenges = storageService.findChallengesByUser(req.userId!);
    const localChallenge = challenges.find(c => c.challengeId === req.params.challengeId);
    if (localChallenge && result.status !== localChallenge.status) {
      storageService.updateChallenge(localChallenge.id, { 
        status: result.status,
        result: result.result,
      });
    }

    res.json(result);
  } catch (error: any) {
    console.error('Get challenge error:', error);
    res.status(500).json({ error: error.message || 'Failed to get challenge' });
  }
});

/**
 * GET /customers/:id/challenges
 * List challenges for customer
 */
router.get('/:id/challenges', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const challenges = storageService.findChallengesByUser(req.userId!)
      .filter(c => c.customerId === req.params.id);
    res.json({ challenges });
  } catch (error: any) {
    console.error('List challenges error:', error);
    res.status(500).json({ error: error.message || 'Failed to list challenges' });
  }
});

/**
 * POST /customers/:id/sign/typed-data
 * Create typed data signing challenge for customer
 */
router.post('/:id/sign/typed-data', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { walletId, typedData, redirectUrl } = req.body;

    if (!walletId || !typedData || !redirectUrl) {
      return res.status(400).json({ 
        error: 'walletId, typedData, and redirectUrl are required' 
      });
    }

    const result = await planbokClient.createCustomerSignTypedDataChallenge(req.params.id, {
      walletId,
      typedData: typeof typedData === 'string' ? typedData : JSON.stringify(typedData),
      redirectUrl,
    });

    // Store challenge
    storageService.createChallenge({
      id: uuidv4(),
      userId: req.userId!,
      customerId: req.params.id,
      challengeId: result.challengeId,
      type: 'sign-typed-data',
      status: 'pending',
      redirectUrl: result.redirectUrl,
      createdAt: new Date().toISOString(),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Customer sign typed data challenge error:', error);
    res.status(500).json({ error: error.message || 'Failed to create sign typed data challenge' });
  }
});

/**
 * POST /customers/:id/sign/transaction
 * Create transaction signing challenge for customer
 */
router.post('/:id/sign/transaction', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { walletId, rawTransaction, transaction, redirectUrl } = req.body;

    if (!walletId || (!rawTransaction && !transaction) || !redirectUrl) {
      return res.status(400).json({ 
        error: 'walletId, transaction (or rawTransaction), and redirectUrl are required' 
      });
    }

    const result = await planbokClient.createCustomerSignTransactionChallenge(req.params.id, {
      walletId,
      rawTransaction,
      transaction: typeof transaction === 'string' ? transaction : JSON.stringify(transaction),
      redirectUrl,
    });

    // Store challenge
    storageService.createChallenge({
      id: uuidv4(),
      userId: req.userId!,
      customerId: req.params.id,
      challengeId: result.challengeId,
      type: 'sign-transaction',
      status: 'pending',
      redirectUrl: result.redirectUrl,
      createdAt: new Date().toISOString(),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Customer sign transaction challenge error:', error);
    res.status(500).json({ error: error.message || 'Failed to create sign transaction challenge' });
  }
});

/**
 * POST /customers/:id/sign/delegate-action
 * Create delegate action signing challenge for customer
 */
router.post('/:id/sign/delegate-action', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { walletId, unsignedDelegateAction, redirectUrl } = req.body;

    if (!walletId || !unsignedDelegateAction || !redirectUrl) {
      return res.status(400).json({ 
        error: 'walletId, unsignedDelegateAction, and redirectUrl are required' 
      });
    }

    const result = await planbokClient.createCustomerSignDelegateActionChallenge(req.params.id, {
      walletId,
      unsignedDelegateAction,
      redirectUrl,
    });

    // Store challenge
    storageService.createChallenge({
      id: uuidv4(),
      userId: req.userId!,
      customerId: req.params.id,
      challengeId: result.challengeId,
      type: 'sign-delegate-action',
      status: 'pending',
      redirectUrl: result.redirectUrl,
      createdAt: new Date().toISOString(),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Customer sign delegate action challenge error:', error);
    res.status(500).json({ error: error.message || 'Failed to create sign delegate action challenge' });
  }
});

/**
 * POST /customers/:id/export-private-keys
 * Create private key export challenge for customer
 */
router.post('/:id/export-private-keys', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { redirectUrl } = req.body;

    if (!redirectUrl) {
      return res.status(400).json({ error: 'redirectUrl is required' });
    }

    const result = await planbokClient.exportPrivateKeysChallenge(
      req.params.id,
      redirectUrl
    );

    // Store challenge
    storageService.createChallenge({
      id: uuidv4(),
      userId: req.userId!,
      customerId: req.params.id,
      challengeId: result.challengeId,
      type: 'export-private-keys',
      status: 'pending',
      redirectUrl: result.redirectUrl,
      createdAt: new Date().toISOString(),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Customer export challenge error:', error);
    res.status(500).json({ error: error.message || 'Failed to create export challenge' });
  }
});

/**
 * GET /customers/:id/challenges/:challengeId
 * Get challenge status
 */
export default router;
