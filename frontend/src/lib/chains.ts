export interface ChainInfo {
  id: string;
  name: string;
  symbol: string;
  type: 'evm' | 'btc' | 'sol' | 'cosmos' | 'near' | 'dot';
  testnet: boolean;
  explorerUrl: string;
  faucetUrl?: string;
  color: string;
  icon: string;
  supportsContracts: boolean;
  supportsCancel: boolean;
  supportsAccelerate: boolean;
  supportsSignTransaction: boolean;
  supportsSignTransactionJson: boolean;
  supportsSignDelegateAction: boolean;
  supportsSignTypedData: boolean;
  encodedFormat: 'hex' | 'base64' | null;
}

export const CHAINS: ChainInfo[] = [
  {
    id: 'ETH-SEPOLIA',
    name: 'Ethereum Sepolia',
    symbol: 'ETH',
    type: 'evm',
    testnet: true,
    explorerUrl: 'https://sepolia.etherscan.io',
    faucetUrl: 'https://sepoliafaucet.com',
    color: '#627EEA',
    icon: '⟠',
    supportsContracts: true,
    supportsCancel: true,
    supportsAccelerate: true,
    supportsSignTransaction: true,
    supportsSignTransactionJson: true,
    supportsSignDelegateAction: false,
    supportsSignTypedData: true,
    encodedFormat: 'hex',
  },
  {
    id: 'BTC-TESTNET',
    name: 'Bitcoin Testnet',
    symbol: 'BTC',
    type: 'btc',
    testnet: true,
    explorerUrl: 'https://blockstream.info/testnet',
    faucetUrl: 'https://coinfaucet.eu/en/btc-testnet',
    color: '#F7931A',
    icon: '₿',
    supportsContracts: false,
    supportsCancel: false,
    supportsAccelerate: false,
    supportsSignTransaction: false,
    supportsSignTransactionJson: false,
    supportsSignDelegateAction: false,
    supportsSignTypedData: false,
    encodedFormat: null,
  },
  {
    id: 'SOL-TESTNET',
    name: 'Solana Testnet',
    symbol: 'SOL',
    type: 'sol',
    testnet: true,
    explorerUrl: 'https://solscan.io?cluster=testnet',
    faucetUrl: 'https://faucet.solana.com',
    color: '#14F195',
    icon: '◎',
    supportsContracts: true,
    supportsCancel: false,
    supportsAccelerate: false,
    supportsSignTransaction: true,
    supportsSignTransactionJson: true,
    supportsSignDelegateAction: false,
    supportsSignTypedData: false,
    encodedFormat: 'base64',
  },
  {
    id: 'ATOM',
    name: 'Cosmos',
    symbol: 'ATOM',
    type: 'cosmos',
    testnet: false,
    explorerUrl: 'https://atomscan.com',
    faucetUrl: 'https://stakely.io/faucet/cosmos-atom',
    color: '#2E3148',
    icon: '⚛',
    supportsContracts: true,
    supportsCancel: true,
    supportsAccelerate: true,
    supportsSignTransaction: true,
    supportsSignTransactionJson: true,
    supportsSignDelegateAction: false,
    supportsSignTypedData: false,
    encodedFormat: 'base64',
  },
  {
    id: 'NEAR-TESTNET',
    name: 'NEAR Testnet',
    symbol: 'NEAR',
    type: 'near',
    testnet: true,
    explorerUrl: 'https://testnet.nearblocks.io',
    faucetUrl: 'https://docs.near.org/faucet',
    color: '#00C08B',
    icon: 'Ⓝ',
    supportsContracts: true,
    supportsCancel: false,
    supportsAccelerate: false,
    supportsSignTransaction: true,
    supportsSignTransactionJson: true,
    supportsSignDelegateAction: true,
    supportsSignTypedData: false,
    encodedFormat: 'base64',
  },
  {
    id: 'DOT-PASEO',
    name: 'Polkadot Paseo',
    symbol: 'PAS',
    type: 'dot',
    testnet: true,
    explorerUrl: 'https://paseo.subscan.io',
    faucetUrl: 'https://faucet.polkadot.io',
    color: '#E6007A',
    icon: '●',
    supportsContracts: true,
    supportsCancel: true,
    supportsAccelerate: true,
    supportsSignTransaction: true,
    supportsSignTransactionJson: true,
    supportsSignDelegateAction: false,
    supportsSignTypedData: false,
    encodedFormat: 'hex',
  },
];

export const getChainById = (id: string): ChainInfo | undefined => {
  return CHAINS.find(chain => chain.id === id);
};

export const getChainColor = (id: string): string => {
  return getChainById(id)?.color || '#6B7280';
};
