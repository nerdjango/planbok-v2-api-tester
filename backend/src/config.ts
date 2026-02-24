import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  // Server
  port: parseInt(process.env.PORT || '4000', 10),
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',

  // Planbok API
  planbokApiUrl: process.env.PLANBOK_API_URL || 'https://api.planbok.io/v2',
  planbokApiKey: process.env.PLANBOK_API_KEY || '',

  // Organization credentials (use existing secret instead of generating new ones)
  organizationSecret: process.env.ORGANIZATION_SECRET || '',
  organizationPublicKey: process.env.ORGANIZATION_PK || '',
  
  // Shared wallet set for all users (optional - will be created on first use if not set)
  walletSetId: process.env.WALLET_SET_ID || '',

  // Webhooks
  webhookSecret: process.env.WEBHOOK_SECRET || '',

  // Data storage
  dataDir: path.join(__dirname, '../data'),
};

// Validate required config
export function validateConfig(): void {
  if (!config.planbokApiKey) {
    console.warn('⚠️  WARNING: PLANBOK_API_KEY is not set. API calls will fail.');
    console.warn('   Copy .env.example to .env and add your API key.');
  }
}
