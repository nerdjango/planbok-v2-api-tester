import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config';

// Routes
import authRoutes from './routes/auth';
import walletRoutes from './routes/wallets';
import transactionRoutes from './routes/transactions';
import signingRoutes from './routes/signing';
import tokenRoutes from './routes/tokens';
import customerRoutes from './routes/customers';
import webhookRoutes from './routes/webhooks';

// Validate config on startup
validateConfig();

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3333', 'http://127.0.0.1:3000', 'http://127.0.0.1:3333'],
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/sign', signingRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/webhooks', webhookRoutes);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: err.message || 'Internal server error',
    code: err.code,
  });
});

// Start server
app.listen(config.port, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   🔐 CryptoVault - Planbok MPC Demo Backend               ║
  ║                                                           ║
  ║   Server running on http://localhost:${config.port}                 ║
  ║                                                           ║
  ║   API Endpoints:                                          ║
  ║   • POST /api/auth/signup     - Create account            ║
  ║   • POST /api/auth/login      - Login                     ║
  ║   • GET  /api/wallets         - List wallets              ║
  ║   • POST /api/wallets         - Create wallets            ║
  ║   • POST /api/transactions/*  - Transfers & contracts     ║
  ║   • POST /api/sign/*          - Signing operations        ║
  ║   • GET  /api/tokens          - List tokens               ║
  ║   • POST /api/customers       - Customer-controlled mode  ║
  ║   • POST /api/webhooks/mpc    - Webhook receiver          ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
