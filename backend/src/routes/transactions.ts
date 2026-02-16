import { Router, Response } from 'express';
import { planbokClient } from '../services/planbok-client';
import { encryptionService } from '../services/encryption';
import { sessionMiddleware, AuthenticatedRequest } from '../middleware/session';

const router = Router();

router.use(sessionMiddleware);

// Chain types that support cancel/accelerate operations
const CANCELLABLE_CHAINS = ['ETH-SEPOLIA', 'ETH', 'POL', 'BSC', 'BASE', 'ATOM', 'ATOM-TESTNET', 'DOT', 'DOT-PASEO'];
const ACCELERATABLE_CHAINS = CANCELLABLE_CHAINS;

/**
 * POST /transactions/estimate-fee
 * Estimate fee for a transfer
 */
router.post('/estimate-fee', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { walletId, destinationAddress, amount, tokenId, feeLevel } = req.body;

    if (!walletId || !destinationAddress || !amount) {
      return res.status(400).json({ error: 'walletId, destinationAddress, and amount are required' });
    }

    let resolvedTokenId = tokenId;
    if (!resolvedTokenId) {
      // If tokenId is missing, try to find the native token for this wallet
      const balances = await planbokClient.getWalletBalances(walletId);
      const nativeBalance = (balances as any[]).find(b => b.isNative);
      if (nativeBalance) {
        resolvedTokenId = nativeBalance.tokenId;
      }
    }

    if (!resolvedTokenId) {
       return res.status(400).json({ error: 'tokenId is required and could not be resolved' });
    }

    const estimate = await planbokClient.estimateTransferFee({
      walletId,
      destinationAddress,
      amounts: [amount],
      tokenId: resolvedTokenId,
      feeLevel,
    });

    res.json(estimate);
  } catch (error: any) {
    console.error('Estimate fee error:', error);
    res.status(500).json({ error: error.message || 'Failed to estimate fee' });
  }
});

/**
 * POST /transactions/transfer
 * Execute a transfer (organization mode)
 */
router.post('/transfer', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { walletId, destinationAddress, amount, tokenId, feeLevel } = req.body;

    if (!walletId || !destinationAddress || !amount) {
      return res.status(400).json({ error: 'walletId, destinationAddress, and amount are required' });
    }

    const { encryptedSecret } = await encryptionService.generateEncryptedSecret('sign');
    const result = await planbokClient.transfer({
      walletId,
      destinationAddress,
      amounts: [amount],
      tokenId,
      feeLevel,
      encryptedOrganizationSecret: encryptedSecret,
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: error.message || 'Transfer failed' });
  }
});

/**
 * POST /transactions/contract-execution/estimate-fee
 * Estimate fee for contract execution
 */
router.post('/contract-execution/estimate-fee', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { walletId, contractAddress, abiFunctionSignature, abiParameters, amount, feeLevel } = req.body;

    if (!walletId || !contractAddress) {
      return res.status(400).json({ error: 'walletId and contractAddress are required' });
    }

    const estimate = await planbokClient.estimateContractExecutionFee({
      walletId,
      contractAddress,
      abiFunctionSignature,
      abiParameters,
      amount,
    });

    res.json(estimate);
  } catch (error: any) {
    console.error('Estimate contract fee error:', error);
    res.status(500).json({ error: error.message || 'Failed to estimate contract execution fee' });
  }
});

/**
 * POST /transactions/contract-execution
 * Execute a contract call (organization mode)
 */
router.post('/contract-execution', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { walletId, contractAddress, abiFunctionSignature, abiParameters, amount, feeLevel } = req.body;

    if (!walletId || !contractAddress) {
      return res.status(400).json({ error: 'walletId and contractAddress are required' });
    }

    const { encryptedSecret } = await encryptionService.generateEncryptedSecret('sign');
    const result = await planbokClient.contractExecution({
      walletId,
      contractAddress,
      abiFunctionSignature,
      abiParameters,
      amount,
      feeLevel,
      encryptedOrganizationSecret: encryptedSecret,
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Contract execution error:', error);
    res.status(500).json({ error: error.message || 'Contract execution failed' });
  }
});

/**
 * GET /transactions
 * List transactions
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { walletId, status, type, page, limit } = req.query;
    
    const rawTransactions = await planbokClient.listTransactions({
      walletId: walletId as string,
      status: status as string,
      type: type as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    const transactions = rawTransactions.map((tx: any) => {
      // Map status
      let mappedStatus: 'pending' | 'completed' | 'failed' = 'pending';
      if (tx.status === 'confirmed') mappedStatus = 'completed';
      if (tx.status === 'failed' || tx.status === 'cancelled') mappedStatus = 'failed';

      return {
        id: tx.id,
        hash: tx.txHash,
        blockchain: tx.blockchain,
        walletId: tx.wallet, // MPC returns wallet ID here
        type: tx.operation,
        status: mappedStatus,
        amount: tx.metadata?.amount || '0',
        symbol: tx.metadata?.symbol || tx.metadata?.tokenSymbol || '',
        destinationAddress: tx.metadata?.destinationAddress,
        createdAt: tx.createdAt
      };
    });

    res.json({ transactions });
  } catch (error: any) {
    console.error('List transactions error:', error);
    res.status(500).json({ error: error.message || 'Failed to list transactions' });
  }
});

/**
 * GET /transactions/:id
 * Get transaction by ID
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const transaction = await planbokClient.getTransaction(req.params.id);
    res.json(transaction);
  } catch (error: any) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to get transaction' });
  }
});

/**
 * POST /transactions/:id/cancel
 * Cancel a pending transaction (EVM, Cosmos, DOT only)
 */
router.post('/:id/cancel', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { encryptedSecret } = await encryptionService.generateEncryptedSecret('sign');
    const result = await planbokClient.cancelTransaction(
      req.params.id,
      encryptedSecret
    );
    res.json(result);
  } catch (error: any) {
    console.error('Cancel transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel transaction' });
  }
});

/**
 * POST /transactions/:id/accelerate
 * Accelerate a pending transaction (EVM, Cosmos, DOT only)
 */
router.post('/:id/accelerate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { encryptedSecret } = await encryptionService.generateEncryptedSecret('sign');
    const result = await planbokClient.accelerateTransaction(
      req.params.id,
      encryptedSecret
    );
    res.json(result);
  } catch (error: any) {
    console.error('Accelerate transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to accelerate transaction' });
  }
});

/**
 * GET /transactions/supported-features
 * Get supported features per chain (for UI)
 */
router.get('/supported-features', async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    cancel: CANCELLABLE_CHAINS,
    accelerate: ACCELERATABLE_CHAINS,
    contractExecution: [
      'ETH-SEPOLIA', 'ETH', 'POL', 'BSC', 'BASE', 'CELO', 'SCR', 'CRO-EVM',
      'SOL-TESTNET', 'SOL',
      'NEAR-TESTNET', 'NEAR',
      'ATOM-TESTNET', 'ATOM', 'OSMO', 'JUNO',
      'DOT-PASEO', 'DOT',
    ],
  });
});

export default router;
