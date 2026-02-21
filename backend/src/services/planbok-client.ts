import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

/**
 * Planbok MPC System V2 API Client
 * Wraps all API endpoints for organization and customer operations
 */
export class PlanbokClient {
  private client: AxiosInstance;
  private organizationPublicKey: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: config.planbokApiUrl,
      headers: {
        'Content-Type': 'application/json',
        'PLANBOK-X-API-KEY': config.planbokApiKey,
      },
      timeout: 30000,
    });

    // Response interceptor to flatten the data wrapper from the MPC backend
    this.client.interceptors.response.use(
      (response) => {
        // Log successful responses for debugging if needed
        // console.log(`Planbok API Success [${response.config.method?.toUpperCase()}] ${response.config.url}`);
        
        // If the backend wraps the result in a 'data' property, return that inner data
        if (response.data && response.data.success && response.data.data !== undefined) {
          return { ...response, data: response.data.data };
        }
        return response;
      },
      (error: AxiosError) => {
        const errorData = error.response?.data as any;
        console.error('Planbok API Error:', {
          status: error.response?.status,
          message: errorData?.message || error.message,
          errors: errorData?.errors,
          code: errorData?.code,
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data
        });
        throw error;
      }
    );
  }

  // ================== Configuration ==================

  async getOrganizationPublicKey(): Promise<string> {
    if (this.organizationPublicKey) {
      return this.organizationPublicKey;
    }
    const response = await this.client.get('/config/organization/public-key');
    this.organizationPublicKey = response.data.publicKey;
    return this.organizationPublicKey!;
  }

  async getChainMetadata(): Promise<any> {
    const response = await this.client.get('/config/chains');
    return response.data;
  }

  // ================== Wallet Sets ==================

  async createWalletSet(
    name: string,
    encryptedOrganizationSecret: string,
    idempotencyKey?: string
  ): Promise<any> {
    const response = await this.client.post(
      '/organization/wallet-sets',
      { 
        name, 
        encryptedOrganizationSecret,
        idempotencyKey: idempotencyKey || uuidv4()
      }
    );
    return response.data;
  }

  async listWalletSets(page = 1, limit = 20): Promise<any> {
    const response = await this.client.get('/wallet-sets', {
      params: { page, limit },
    });
    return response.data;
  }

  async getWalletSet(walletSetId: string): Promise<any> {
    const response = await this.client.get(`/wallet-sets/${walletSetId}`);
    return response.data;
  }

  // ================== Wallets ==================

  async createWallets(
    walletSetId: string,
    blockchains: string[],
    count: number,
    encryptedOrganizationSecret: string,
    metadata?: Record<string, any>[],
    idempotencyKey?: string
  ): Promise<any> {
    const response = await this.client.post(
      '/organization/wallets',
      {
        walletSetId,
        blockchains,
        count,
        encryptedOrganizationSecret,
        metadata: metadata || Array(count).fill({ name: '', refId: '' }),
        idempotencyKey: idempotencyKey || uuidv4()
      }
    );
    return response.data;
  }

  async listWallets(filters?: {
    walletSetId?: string;
    blockchain?: string;
    customerIds?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const response = await this.client.get('/wallets', { params: filters });
    return response.data;
  }

  async getWallet(walletId: string): Promise<any> {
    const response = await this.client.get(`/wallets/${walletId}`);
    return response.data;
  }

  async getWalletBalances(walletId: string): Promise<any> {
    const response = await this.client.get(`/wallets/${walletId}/balances`);
    return response.data;
  }

  async updateWallet(
    walletId: string,
    updates: { name?: string; metadata?: Record<string, any> }
  ): Promise<any> {
    const response = await this.client.patch(`/wallets/${walletId}`, updates);
    return response.data;
  }

  // ================== Address Validation ==================

  async validateAddress(address: string, blockchain: string): Promise<any> {
    const response = await this.client.post('/wallets/validate-address', {
      address,
      blockchain,
    });
    return response.data;
  }

  // ================== Transactions ==================

  async estimateTransferFee(params: {
    walletId: string;
    destinationAddress: string;
    amounts: string[];
    tokenId: string;
    feeLevel?: 'low' | 'medium' | 'high';
  }): Promise<any> {
    const response = await this.client.post(
      '/transactions/transfer/estimate-fee',
      params
    );
    return response.data;
  }

  async transfer(
    params: {
      walletId: string;
      destinationAddress: string;
      amounts: string[];
      tokenId: string;
      feeLevel?: 'low' | 'medium' | 'high';
      encryptedOrganizationSecret: string;
    },
    idempotencyKey?: string
  ): Promise<any> {
    const response = await this.client.post(
      '/organization/transactions/transfer', 
      {
        ...params,
        idempotencyKey: idempotencyKey || uuidv4()
      }
    );
    return response.data;
  }

  async estimateContractExecutionFee(params: {
    walletId: string;
    contractAddress: string;
    abiFunctionSignature: string;
    abiParameters: string[];
    amount?: string;
  }): Promise<any> {
    const response = await this.client.post(
      '/transactions/contract-execution/estimate-fee',
      params
    );
    return response.data;
  }

  async contractExecution(
    params: {
      walletId: string;
      contractAddress: string;
      abiFunctionSignature: string;
      abiParameters: string[];
      amount?: string;
      feeLevel?: 'low' | 'medium' | 'high';
      encryptedOrganizationSecret: string;
    },
    idempotencyKey?: string
  ): Promise<any> {
    const response = await this.client.post(
      '/organization/transactions/contract-execution', 
      {
        ...params,
        idempotencyKey: idempotencyKey || uuidv4()
      }
    );
    return response.data;
  }

  async listTransactions(filters?: {
    walletId?: string;
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
    refId?: string;
  }): Promise<any> {
    const response = await this.client.get('/transactions', { params: filters });
    return response.data;
  }

  async getTransaction(transactionId: string): Promise<any> {
    const response = await this.client.get(`/transactions/${transactionId}`);
    return response.data;
  }

  async cancelTransaction(
    transactionId: string,
    encryptedOrganizationSecret: string,
    idempotencyKey?: string
  ): Promise<any> {
    const response = await this.client.post(
      `/organization/transactions/${transactionId}/cancel`,
      { 
        encryptedOrganizationSecret,
        idempotencyKey: idempotencyKey || uuidv4()
      }
    );
    return response.data;
  }

  async accelerateTransaction(
    transactionId: string,
    encryptedOrganizationSecret: string,
    idempotencyKey?: string
  ): Promise<any> {
    const response = await this.client.post(
      `/organization/transactions/${transactionId}/accelerate`,
      { 
        encryptedOrganizationSecret,
        idempotencyKey: idempotencyKey || uuidv4()
      }
    );
    return response.data;
  }

  // ================== Signing ==================

  async signMessage(
    params: {
      walletId: string;
      message: string;
      encryptedOrganizationSecret: string;
      encodedByHex?: boolean;
    },
    idempotencyKey?: string
  ): Promise<any> {
    const response = await this.client.post(
      '/organization/sign/message', 
      {
        ...params,
        idempotencyKey: idempotencyKey || uuidv4()
      }
    );
    return response.data;
  }

  async signTypedData(
    params: {
      walletId: string;
      typedData: any;
      encryptedOrganizationSecret: string;
    },
    idempotencyKey?: string
  ): Promise<any> {
    const response = await this.client.post(
      '/organization/sign/typed-data', 
      {
        ...params,
        idempotencyKey: idempotencyKey || uuidv4()
      }
    );
    return response.data;
  }

  async signTransaction(
    params: {
      walletId: string;
      rawTransaction?: string;
      transaction?: any;
      encryptedOrganizationSecret: string;
    },
    idempotencyKey?: string
  ): Promise<any> {
    const response = await this.client.post(
      '/organization/sign/transaction', 
      {
        ...params,
        idempotencyKey: idempotencyKey || uuidv4()
      }
    );
    return response.data;
  }

  async signDelegateAction(
    params: {
      walletId: string;
      unsignedDelegateAction: string;
      encryptedOrganizationSecret: string;
    },
    idempotencyKey?: string
  ): Promise<any> {
    const response = await this.client.post(
      '/organization/sign/delegate-action', 
      {
        ...params,
        idempotencyKey: idempotencyKey || uuidv4()
      }
    );
    return response.data;
  }

  // ================== Customers ==================

  async createCustomer(name: string, refId?: string): Promise<any> {
    const response = await this.client.post('/customers', { name, refId });
    return response.data;
  }

  async listCustomers(page = 1, limit = 20): Promise<any> {
    const response = await this.client.get('/customers', {
      params: { page, limit },
    });
    return response.data;
  }

  async getCustomer(customerId: string): Promise<any> {
    const response = await this.client.get(`/customers/${customerId}`);
    return response.data;
  }

  async initializeCustomer(
    customerId: string,
    redirectUrl: string
  ): Promise<any> {
    const response = await this.client.post(`/customers/${customerId}/initialize`, {
      redirectUrl,
    });
    return response.data;
  }

  async setupRecoveryChallenge(
    customerId: string,
    redirectUrl: string
  ): Promise<any> {
    const response = await this.client.post(`/customers/${customerId}/recovery`, {
      redirectUrl,
    });
    return response.data;
  }

  async updatePinChallenge(
    customerId: string,
    redirectUrl: string
  ): Promise<any> {
    const response = await this.client.post(`/customers/${customerId}/update-pin`, {
      redirectUrl,
    });
    return response.data;
  }

  async resetPinChallenge(
    customerId: string,
    redirectUrl: string
  ): Promise<any> {
    const response = await this.client.post(`/customers/${customerId}/reset-pin`, {
      redirectUrl,
    });
    return response.data;
  }

  async createCustomerWalletChallenge(
    customerId: string,
    blockchains: string[],
    redirectUrl: string
  ): Promise<any> {
    const response = await this.client.post(`/customers/${customerId}/wallet/create`, {
      blockchains,
      redirectUrl,
    });
    return response.data;
  }

  async getCustomerPublicKey(customerId: string): Promise<any> {
    const response = await this.client.get(`/customers/${customerId}/public-key`);
    return response.data;
  }

  async exportPrivateKeysChallenge(
    customerId: string,
    redirectUrl: string
  ): Promise<any> {
    const response = await this.client.post(`/customers/${customerId}/export-private-keys`, {
      redirectUrl,
    });
    return response.data;
  }

  // ================== Customer Challenges ==================

  async createCustomerTransferChallenge(
    customerId: string,
    params: {
      walletId: string;
      destinationAddress: string;
      amounts: string[];
      tokenId: string;
      feeLevel?: 'low' | 'medium' | 'high';
      redirectUrl: string;
    }
  ): Promise<any> {
    const response = await this.client.post(
      `/customers/${customerId}/transactions/transfer`,
      {
        ...params,
        idempotencyKey: uuidv4()
      }
    );
    return response.data;
  }

  async createCustomerContractChallenge(
    customerId: string,
    params: {
      walletId: string;
      contractAddress: string;
      abiFunctionSignature: string;
      abiParameters: string[];
      amount?: string;
      feeLevel?: 'low' | 'medium' | 'high';
      redirectUrl: string;
    }
  ): Promise<any> {
    const response = await this.client.post(
      `/customers/${customerId}/transactions/contract-execution`,
      {
        ...params,
        idempotencyKey: uuidv4()
      }
    );
    return response.data;
  }

  async createCustomerSignMessageChallenge(
    customerId: string,
    params: {
      walletId: string;
      message: string;
      encodedByHex?: boolean;
      redirectUrl: string;
    }
  ): Promise<any> {
    const response = await this.client.post(
      `/customers/${customerId}/sign/message`,
      params
    );
    return response.data;
  }

  async createCustomerSignTypedDataChallenge(
    customerId: string,
    params: {
      walletId: string;
      typedData: any;
      redirectUrl: string;
    }
  ): Promise<any> {
    const response = await this.client.post(
      `/customers/${customerId}/sign/typed-data`,
      params
    );
    return response.data;
  }

  async createCustomerSignTransactionChallenge(
    customerId: string,
    params: {
      walletId: string;
      rawTransaction?: string;
      transaction?: any;
      redirectUrl: string;
    }
  ): Promise<any> {
    const response = await this.client.post(
      `/customers/${customerId}/sign/transaction`,
      params
    );
    return response.data;
  }

  async createCustomerSignDelegateActionChallenge(
    customerId: string,
    params: {
      walletId: string;
      unsignedDelegateAction: string;
      redirectUrl: string;
    }
  ): Promise<any> {
    const response = await this.client.post(
      `/customers/${customerId}/sign/delegate-action`,
      params
    );
    return response.data;
  }

  async getChallenge(customerId: string, challengeId: string): Promise<any> {
    const response = await this.client.get(
      `/customers/${customerId}/challenges/${challengeId}`
    );
    return response.data;
  }

  // ================== Tokens ==================

  async listTokens(blockchain?: string): Promise<any> {
    const response = await this.client.get('/tokens', {
      params: blockchain ? { blockchain } : undefined,
    });
    return response.data;
  }

  async addToken(params: {
    blockchain: string;
    standard: string;
    address?: string;
    name: string;
    symbol: string;
    decimals?: number;
  }): Promise<any> {
    const response = await this.client.post('/tokens', params);
    return response.data;
  }

  async removeToken(tokenId: string): Promise<any> {
    const response = await this.client.delete(`/tokens/${tokenId}`);
    return response.data;
  }

  async getTokenMetadata(
    blockchain: string,
    standard: string,
    address: string
  ): Promise<any> {
    const response = await this.client.get('/tokens/metadata', {
      params: { blockchain, standard, address },
    });
    return response.data;
  }
}

// Singleton instance
export const planbokClient = new PlanbokClient();
