import { Router, Response } from 'express';
import { planbokClient } from '../services/planbok-client';
import { sessionMiddleware, AuthenticatedRequest } from '../middleware/session';

const router = Router();

router.use(sessionMiddleware);

/**
 * GET /tokens
 * List organization tokens
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { blockchain } = req.query;
    const rawTokens = await planbokClient.listTokens(blockchain as string);
    
    // Normalize tokens: map _id to id if necessary
    const tokens = rawTokens.map((t: any) => ({
      id: t.id || t._id,
      blockchain: t.blockchain,
      address: t.address,
      name: t.name,
      symbol: t.symbol,
      decimals: t.decimals,
      standard: t.standard
    }));

    res.json({ tokens });
  } catch (error: any) {
    console.error('List tokens error:', error);
    res.status(500).json({ error: error.message || 'Failed to list tokens' });
  }
});

/**
 * POST /tokens
 * Add a custom token
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { blockchain, standard, address, name, symbol, decimals } = req.body;

    if (!blockchain || !standard || !name || !symbol) {
      return res.status(400).json({ 
        error: 'blockchain, standard, name, and symbol are required' 
      });
    }

    const token = await planbokClient.addToken({
      blockchain,
      standard,
      address,
      name,
      symbol,
      decimals,
    });

    res.status(201).json(token);
  } catch (error: any) {
    console.error('Add token error:', error);
    res.status(500).json({ error: error.message || 'Failed to add token' });
  }
});

/**
 * GET /tokens/metadata
 * Get token metadata from blockchain
 */
router.get('/metadata', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { blockchain, standard, address } = req.query;

    if (!blockchain || !standard || !address) {
      return res.status(400).json({ 
        error: 'blockchain, standard, and address query params are required' 
      });
    }

    const metadata = await planbokClient.getTokenMetadata(
      blockchain as string,
      standard as string,
      address as string
    );

    res.json(metadata);
  } catch (error: any) {
    console.error('Get token metadata error:', error);
    res.status(500).json({ error: error.message || 'Failed to get token metadata' });
  }
});

/**
 * DELETE /tokens/:id
 * Remove a custom token
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await planbokClient.removeToken(req.params.id);
    res.json({ message: 'Token removed successfully' });
  } catch (error: any) {
    console.error('Remove token error:', error);
    res.status(500).json({ error: error.message || 'Failed to remove token' });
  }
});

/**
 * GET /tokens/standards
 * Get supported token standards per chain
 */
router.get('/standards', async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    'ETH-SEPOLIA': ['native', 'erc20', 'erc721', 'erc1155'],
    'ETH': ['native', 'erc20', 'erc721', 'erc1155'],
    'POL': ['native', 'erc20', 'erc721', 'erc1155'],
    'BSC': ['native', 'erc20', 'erc721', 'erc1155'],
    'BASE': ['native', 'erc20', 'erc721', 'erc1155'],
    'SOL-TESTNET': ['native', 'fungible', 'fungible_asset', 'non_fungible'],
    'SOL': ['native', 'fungible', 'fungible_asset', 'non_fungible'],
    'ATOM-TESTNET': ['native', 'cw20', 'cw721'],
    'ATOM': ['native', 'cw20', 'cw721'],
    'NEAR-TESTNET': ['native', 'nep141', 'nep171'],
    'NEAR': ['native', 'nep141', 'nep171'],
    'DOT-PASEO': ['native', 'psp22', 'psp34'],
    'DOT': ['native', 'psp22', 'psp34'],
    'BTC-TESTNET': ['native'],
    'BTC': ['native'],
  });
});

export default router;
