import crypto from 'crypto';
import { config } from '../config';

/**
 * RSA-OAEP Encryption for MPC secrets
 * Uses existing organization secret and public key from config
 */
export class EncryptionService {
  /**
   * Get organization public key (from config or API)
   */
  getPublicKey(): string {
    if (config.organizationPublicKey) {
      return config.organizationPublicKey;
    }
    throw new Error('ORGANIZATION_PK not configured in environment');
  }

  /**
   * Get the existing organization secret
   */
  getOrganizationSecret(): string {
    if (!config.organizationSecret) {
      throw new Error('ORGANIZATION_SECRET not configured in environment');
    }
    return config.organizationSecret;
  }

  /**
   * Encrypt the organization secret for MPC operations
   * Uses the existing secret from environment instead of generating new ones
   */
  encryptOrganizationSecret(): string {
    const publicKeyPem = this.getPublicKey();
    const secret = this.getOrganizationSecret();

    // Create the payload with context
    const payload = JSON.stringify({
      secret,
      context: 'sign',
      timestamp: Date.now(),
    });

    // Encrypt using RSA-OAEP with SHA-256
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(payload, 'utf-8')
    );

    return encrypted.toString('base64');
  }

  /**
   * Encrypt the organization secret for DKG (key generation) operations
   */
  encryptForDkg(): string {
    const publicKeyPem = this.getPublicKey();
    const secret = this.getOrganizationSecret();

    // Create the payload with DKG context
    const payload = JSON.stringify({
      secret,
      context: 'dkg',
      timestamp: Date.now(),
    });

    // Encrypt using RSA-OAEP with SHA-256
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(payload, 'utf-8')
    );

    return encrypted.toString('base64');
  }

  /**
   * Legacy method for compatibility - returns encrypted organization secret
   * @deprecated Use encryptOrganizationSecret() or encryptForDkg() instead
   */
  async generateEncryptedSecret(context: 'dkg' | 'sign' = 'sign'): Promise<{
    secret: string;
    encryptedSecret: string;
  }> {
    const secret = this.getOrganizationSecret();
    const encryptedSecret = context === 'dkg' 
      ? this.encryptForDkg() 
      : this.encryptOrganizationSecret();
    return { secret, encryptedSecret };
  }
}

// Singleton instance
export const encryptionService = new EncryptionService();
