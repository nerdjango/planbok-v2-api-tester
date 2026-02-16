import express from 'express';
import crypto from 'crypto';
import { config } from '../config';

const router = express.Router();

/**
 * Verify Webhook Signature
 */
function verifySignature(req: express.Request, res: express.Response, next: express.NextFunction) {
  const signature = req.headers['x-webhook-signature'] as string;
  const timestamp = req.headers['x-webhook-timestamp'] as string;
  const secret = config.webhookSecret;

  if (!secret) {
    console.warn('⚠️ Webhook secret not configured, skipping verification');
    return next();
  }

  if (!signature || !timestamp) {
    return res.status(401).json({ error: 'Missing signature or timestamp' });
  }

  const payload = `${timestamp}.${JSON.stringify(req.body)}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  if (`sha256=${expectedSignature}` !== signature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

/**
 * Handle MPC System Webhooks
 * POST /api/webhooks/mpc
 */
router.post('/mpc', verifySignature, (req, res) => {
  const { event, timestamp, data } = req.body;

  console.log(`📩 Received Webhook: ${event} at ${timestamp}`);
  console.log('Payload:', JSON.stringify(data, null, 2));

  // Handle specific events
  switch (event) {
    case 'transaction.confirmed':
      console.log(`✅ Transaction ${data.transactionId} confirmed on ${data.blockchain}`);
      // TODO: Update local database state if applicable
      break;
    
    case 'customer.setup_completed':
      console.log(`👤 Customer ${data.customerId} setup completed`);
      break;
    
    case 'challenge.completed':
      console.log(`🎫 Challenge ${data.challengeId} completed`);
      break;

    default:
      console.log(`ℹ️ Unhandled event type: ${event}`);
  }

  res.status(200).json({ received: true });
});

export default router;
