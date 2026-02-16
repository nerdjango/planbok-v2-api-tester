import { Router, Response } from 'express';
import { planbokClient } from '../services/planbok-client';
import { encryptionService } from '../services/encryption';
import { sessionMiddleware, AuthenticatedRequest } from '../middleware/session';

const router = Router();

router.use(sessionMiddleware);

/**
 * POST /sign/message
 * Sign a message (organization mode, all chains)
 */
router.post('/message', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { walletId, message, encodedByHex } = req.body;
    console.log('Sign message request:', { walletId, message, encodedByHex });

    if (!walletId || !message) {
      return res.status(400).json({ error: 'walletId and message are required' });
    }

    const finalMessage = message;
    // Manual hex encoding removed because MPC backend now handles it natively via encodedByHex flag

    const { encryptedSecret } = await encryptionService.generateEncryptedSecret('sign');
    const result = await planbokClient.signMessage({
      walletId,
      message: finalMessage,
      encodedByHex: !!encodedByHex,
      encryptedOrganizationSecret: encryptedSecret,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Sign message error:', error.response?.data || error);
    res.status(500).json({ error: error.response?.data?.message || error.message || 'Failed to sign message' });
  }
});

/**
 * POST /sign/typed-data
 * Sign EIP-712 typed data (EVM only)
 */
router.post('/typed-data', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { walletId, typedData } = req.body;
    console.log('Sign typed data request:', { walletId, typedData: typeof typedData === 'object' ? 'object' : typedData });

    if (!walletId || !typedData) {
      return res.status(400).json({ error: 'walletId and typedData are required' });
    }

    const { encryptedSecret } = await encryptionService.generateEncryptedSecret('sign');
    const result = await planbokClient.signTypedData({
      walletId,
      typedData: typeof typedData === 'string' ? typedData : JSON.stringify(typedData),
      encryptedOrganizationSecret: encryptedSecret,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Sign typed data error:', error.response?.data || error);
    res.status(500).json({ error: error.response?.data?.message || error.message || 'Failed to sign typed data' });
  }
});

router.post('/transaction', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { walletId, transaction, inputMode } = req.body;
    console.log('Sign transaction request:', { walletId, inputMode });

    if (!walletId || !transaction) {
      return res.status(400).json({ error: 'walletId and transaction are required' });
    }

    const { encryptedSecret } = await encryptionService.generateEncryptedSecret('sign');
    
    const signParams: any = {
      walletId,
      encryptedOrganizationSecret: encryptedSecret,
    };

    if (inputMode === 'json') {
      // For JSON objects, stringify them for the MPC controller
      signParams.transaction = typeof transaction === 'string' ? transaction : JSON.stringify(transaction);
    } else {
      // For encoded strings (hex/base64), send as rawTransaction
      signParams.rawTransaction = transaction;
    }

    const result = await planbokClient.signTransaction(signParams);
    res.json(result);
  } catch (error: any) {
    console.error('Sign transaction error:', error);
    res.status(500).json({ error: error.message || 'Failed to sign transaction' });
  }
});

/**
 * POST /sign/delegate-action
 * Sign a NEAR delegate action (NEAR only)
 */
router.post('/delegate-action', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { walletId, delegateAction } = req.body;

    if (!walletId || !delegateAction) {
      return res.status(400).json({ error: 'walletId and delegateAction are required' });
    }

    const { encryptedSecret } = await encryptionService.generateEncryptedSecret('sign');
    const result = await planbokClient.signDelegateAction({
      walletId,
      unsignedDelegateAction: delegateAction,
      encryptedOrganizationSecret: encryptedSecret,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Sign delegate action error:', error);
    res.status(500).json({ error: error.message || 'Failed to sign delegate action' });
  }
});

/**
 * GET /sign/supported-types
 * Get supported signing types per chain
 */
router.get('/supported-types', async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    message: ['ETH-SEPOLIA', 'ETH', 'POL', 'BSC', 'BASE', 'SOL-TESTNET', 'SOL', 'BTC-TESTNET', 'BTC', 'NEAR-TESTNET', 'NEAR', 'ATOM-TESTNET', 'ATOM', 'DOT-PASEO', 'DOT'],
    typedData: ['ETH-SEPOLIA', 'ETH', 'POL', 'BSC', 'BASE', 'CELO', 'SCR', 'CRO-EVM'],
    transaction: ['ETH-SEPOLIA', 'ETH', 'POL', 'BSC', 'BASE', 'SOL-TESTNET', 'SOL', 'BTC-TESTNET', 'BTC', 'NEAR-TESTNET', 'NEAR', 'ATOM-TESTNET', 'ATOM', 'DOT-PASEO', 'DOT'],
    delegateAction: ['NEAR-TESTNET', 'NEAR'],
  });
});

export default router;
