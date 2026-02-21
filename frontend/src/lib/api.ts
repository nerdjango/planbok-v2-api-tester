const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface FetchOptions extends RequestInit {
  token?: string;
}

export interface User {
  id: string;
  email: string;
  customerId?: string;
  custodyMode?: 'organization' | 'customer';
}

export interface Customer {
  id: string;
  name: string;
  refId: string;
  custodyType: string;
  status: string;
  hasPin: boolean;
  hasRecovery: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Wallet {
  id: string;
  blockchain: string;
  address: string;
  publicKey?: string;
  name?: string;
  customer?: string;
}

export interface Balance {
  blockchain: string;
  symbol: string;
  amount: string;
  formatted: string;
  isNative: boolean;
  tokenId?: string;
}

export interface Transaction {
  id: string;
  transactionId?: string;
  blockchain: string;
  walletId: string;
  type: string;
  status: 'pending' | 'completed' | 'failed';
  amount: string;
  symbol: string;
  hash?: string;
  destinationAddress?: string;
  createdAt: string;
}

export interface Token {
  id: string;
  blockchain: string;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  standard: string;
}

export interface Challenge {
  challengeId: string;
  redirectUrl: string;
  status: 'pending' | 'verified' | 'failed';
  task?: string;
  expiresAt: string;
  result?: unknown;
  metadata?: Record<string, unknown>;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  private async fetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const token = options.token || this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || 'Request failed');
    }

    return response.json();
  }

  // Auth
  async signup(email: string, password: string, custodyMode?: string) {
    const result = await this.fetch<{ user: User; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, custodyMode }),
    });
    this.setToken(result.token);
    return result;
  }

  async login(email: string, password: string) {
    const result = await this.fetch<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(result.token);
    return result;
  }

  async logout() {
    await this.fetch('/auth/logout', { method: 'POST' });
    this.setToken(null);
  }

  async getMe() {
    return this.fetch<{ user: User }>('/auth/me');
  }

  async updateMe(updates: Partial<User>) {
    return this.fetch<{ user: User }>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // Wallets
  async listWallets(blockchain?: string, customerId?: string) {
    const params = new URLSearchParams();
    if (blockchain) params.append('blockchain', blockchain);
    if (customerId) params.append('customerId', customerId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.fetch<{ wallets: Wallet[] }>(`/wallets${queryString}`);
  }

  async createWallets(blockchains: string[], count = 1, metadata?: Record<string, unknown>) {
    return this.fetch<{ wallets: Wallet[] }>('/wallets', {
      method: 'POST',
      body: JSON.stringify({ blockchains, count, metadata }),
    });
  }

  async getWalletBalances(walletId: string) {
    return this.fetch<{ balances: Balance[] }>(`/wallets/${walletId}/balances`);
  }

  async validateAddress(address: string, blockchain: string) {
    return this.fetch<{ valid: boolean }>('/wallets/validate-address', {
      method: 'POST',
      body: JSON.stringify({ address, blockchain }),
    });
  }

  // Transactions
  async estimateFee(walletId: string, destinationAddress: string, amount: string, tokenId: string) {
    return this.fetch<{ fee: string }>('/transactions/estimate-fee', {
      method: 'POST',
      body: JSON.stringify({ walletId, destinationAddress, amount, tokenId }),
    });
  }

  async transfer(walletId: string, destinationAddress: string, amount: string, tokenId: string, feeLevel?: string) {
    return this.fetch<Transaction>('/transactions/transfer', {
      method: 'POST',
      body: JSON.stringify({ walletId, destinationAddress, amount, tokenId, feeLevel }),
    });
  }

  async estimateContractExecutionFee(params: {
    walletId: string;
    contractAddress: string;
    abiFunctionSignature: string;
    abiParameters: string[];
    amount?: string;
  }) {
    return this.fetch<{ estimatedFee: string }>('/transactions/contract-execution/estimate-fee', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async contractExecution(params: {
    walletId: string;
    contractAddress: string;
    abiFunctionSignature: string;
    abiParameters: string[];
    amount?: string;
    feeLevel?: string;
  }) {
    return this.fetch<Transaction>('/transactions/contract-execution', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async listTransactions(walletId?: string) {
    const params = walletId ? `?walletId=${walletId}` : '';
    return this.fetch<{ transactions: Transaction[] }>(`/transactions${params}`);
  }

  async cancelTransaction(transactionId: string) {
    return this.fetch<Transaction>(`/transactions/${transactionId}/cancel`, { method: 'POST' });
  }

  async accelerateTransaction(transactionId: string) {
    return this.fetch<Transaction>(`/transactions/${transactionId}/accelerate`, { method: 'POST' });
  }

  // Signing
  async signMessage(walletId: string, message: string, encodedByHex?: boolean) {
    return this.fetch<{ signature: string }>('/sign/message', {
      method: 'POST',
      body: JSON.stringify({ walletId, message, encodedByHex }),
    });
  }

  async signTypedData(walletId: string, typedData: unknown) {
    return this.fetch<{ signature: string }>('/sign/typed-data', {
      method: 'POST',
      body: JSON.stringify({ walletId, typedData }),
    });
  }

  async signTransaction(walletId: string, transaction: unknown, inputMode: 'json' | 'encoded') {
    return this.fetch<{ signedTransaction: string; signature: { signature: string }; transactionHash?: string }>('/sign/transaction', {
      method: 'POST',
      body: JSON.stringify({ walletId, transaction, inputMode }),
    });
  }

  async signDelegateAction(walletId: string, delegateAction: string) {
    return this.fetch<{ signedDelegateAction: string; signature: { signature: string } }>('/sign/delegate-action', {
      method: 'POST',
      body: JSON.stringify({ walletId, delegateAction }),
    });
  }

  // Tokens
  async listTokens(blockchain?: string) {
    const params = blockchain ? `?blockchain=${blockchain}` : '';
    return this.fetch<{ tokens: Token[] }>(`/tokens${params}`);
  }

  async addToken(params: { blockchain: string; standard: string; address?: string; name: string; symbol: string; decimals?: number }) {
    return this.fetch<Token>('/tokens', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Customers
  async createCustomer(name?: string) {
    return this.fetch<{ id: string; name: string }>('/customers', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async initializeCustomer(customerId: string, redirectUrl: string) {
    return this.fetch<Challenge>(`/customers/${customerId}/initialize`, {
      method: 'POST',
      body: JSON.stringify({ redirectUrl }),
    });
  }

  async setupRecovery(customerId: string, redirectUrl: string) {
    return this.fetch<Challenge>(`/customers/${customerId}/recovery`, {
      method: 'POST',
      body: JSON.stringify({ redirectUrl }),
    });
  }

  async updatePin(customerId: string, redirectUrl: string) {
    return this.fetch<Challenge>(`/customers/${customerId}/pin/update`, {
      method: 'POST',
      body: JSON.stringify({ redirectUrl }),
    });
  }

  async resetPin(customerId: string, redirectUrl: string) {
    return this.fetch<Challenge>(`/customers/${customerId}/pin/reset`, {
      method: 'POST',
      body: JSON.stringify({ redirectUrl }),
    });
  }

  async createCustomerWalletChallenge(customerId: string, blockchains: string[], redirectUrl: string) {
    return this.fetch<Challenge>(`/customers/${customerId}/wallet/create`, {
      method: 'POST',
      body: JSON.stringify({ blockchains, redirectUrl }),
    });
  }

  async getChallenge(customerId: string, challengeId: string) {
    return this.fetch<Challenge>(`/customers/${customerId}/challenges/${challengeId}`);
  }

  async exportPrivateKeys(customerId: string, redirectUrl: string) {
    return this.fetch<Challenge>(`/customers/${customerId}/export-private-keys`, {
      method: 'POST',
      body: JSON.stringify({ redirectUrl }),
    });
  }

  async getCustomer(customerId: string) {
    return this.fetch<Customer>(`/customers/${customerId}`);
  }

  async createCustomerTransferChallenge(customerId: string, params: {
    walletId: string;
    destinationAddress: string;
    amount: string;
    tokenId?: string;
    feeLevel?: string;
    redirectUrl: string;
  }) {
    return this.fetch<Challenge>(`/customers/${customerId}/transactions/transfer`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async createCustomerContractChallenge(customerId: string, params: {
    walletId: string;
    contractAddress: string;
    abiFunctionSignature: string;
    abiParameters: string[];
    amount?: string;
    feeLevel?: string;
    redirectUrl: string;
  }) {
    return this.fetch<Challenge>(`/customers/${customerId}/transactions/contract-execution`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async createCustomerSignMessageChallenge(customerId: string, params: {
    walletId: string;
    message: string;
    encodedByHex?: boolean;
    redirectUrl: string;
  }) {
    return this.fetch<Challenge>(`/customers/${customerId}/sign/message`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async createCustomerSignTypedDataChallenge(customerId: string, params: {
    walletId: string;
    typedData: unknown;
    redirectUrl: string;
  }) {
    return this.fetch<Challenge>(`/customers/${customerId}/sign/typed-data`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async createCustomerSignTransactionChallenge(customerId: string, params: {
    walletId: string;
    transaction?: unknown;
    rawTransaction?: string;
    redirectUrl: string;
  }) {
    return this.fetch<Challenge>(`/customers/${customerId}/sign/transaction`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async createCustomerSignDelegateActionChallenge(customerId: string, params: {
    walletId: string;
    unsignedDelegateAction: string;
    redirectUrl: string;
  }) {
    return this.fetch<Challenge>(`/customers/${customerId}/sign/delegate-action`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }
}

export const api = new ApiClient();
