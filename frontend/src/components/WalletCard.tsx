'use client';

import { useState, useEffect } from 'react';
import { getChainById } from '@/lib/chains';
import { api } from '@/lib/api';

interface WalletCardProps {
  wallet: {
    id: string;
    blockchain: string;
    address: string;
    name?: string;
    customer?: string;
  };
  userCustomerId?: string;
  onSend?: () => void;
  onReceive?: () => void;
}

export function WalletCard({ wallet, userCustomerId, onSend, onReceive }: WalletCardProps) {
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const chain = getChainById(wallet.blockchain);

  useEffect(() => {
    const loadBalance = async () => {
      try {
        setLoading(true);
        const result = await api.getWalletBalances(wallet.id);
        const nativeBalance = result.balances?.find((b) => b.isNative);
        setBalance(nativeBalance?.formatted || '0');
      } catch (error) {
        console.error('Failed to load balance:', error);
        setBalance('--');
      } finally {
        setLoading(false);
      }
    };
    loadBalance();
  }, [wallet.id]);

  const copyAddress = () => {
    navigator.clipboard.writeText(wallet.address);
  };

  const truncateAddress = (addr: string) => {
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const isSelfCustody = userCustomerId && wallet.customer === userCustomerId;

  return (
    <div 
      className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-5 border border-gray-700 hover:border-gray-600 transition-all duration-200 shadow-xl"
      style={{ borderLeftColor: chain?.color, borderLeftWidth: '4px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
            style={{ backgroundColor: `${chain?.color}20` }}
          >
            {chain?.icon || '🔗'}
          </div>
          <div>
            <h3 className="font-semibold text-white">{chain?.name || wallet.blockchain}</h3>
            <p className="text-xs text-gray-400">{wallet.name || 'Wallet'}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isSelfCustody ? (
            <span className="px-2 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded-full font-bold uppercase tracking-wider border border-blue-500/30">
              Self-Custody
            </span>
          ) : (
            <span className="px-2 py-0.5 text-[10px] bg-orange-500/20 text-orange-400 rounded-full font-bold uppercase tracking-wider border border-orange-500/30">
              Org-Custody
            </span>
          )}
          {chain?.supportsContracts && (
            <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">
              Contracts
            </span>
          )}
        </div>
      </div>

      {/* Balance */}
      <div className="mb-4">
        <p className="text-sm text-gray-400 mb-1">Balance</p>
        <div className="flex items-baseline gap-2">
          {loading ? (
            <div className="h-8 w-24 bg-gray-700 rounded animate-pulse"></div>
          ) : (
            <>
              <span className="text-2xl font-bold text-white">{balance}</span>
              <span className="text-gray-400">{chain?.symbol}</span>
            </>
          )}
        </div>
      </div>

      {/* Address */}
      <div className="mb-4">
        <p className="text-sm text-gray-400 mb-1">Address</p>
        <button 
          onClick={copyAddress}
          className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors group"
        >
          <code className="bg-gray-700/50 px-2 py-1 rounded font-mono text-xs">
            {truncateAddress(wallet.address)}
          </code>
          <svg className="w-4 h-4 opacity-50 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {/* Quick Links */}
      <div className="flex gap-2 mb-6">
        <a 
          href={`/transactions?walletId=${wallet.id}`}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-[10px] font-medium text-gray-300 hover:text-white transition-colors border border-gray-700"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          History
        </a>
        {chain?.supportsContracts && (
          <a 
            href={`/contracts?walletId=${wallet.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-[10px] font-medium text-gray-300 hover:text-white transition-colors border border-gray-700"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Contract
          </a>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onSend}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          Send
        </button>
        <button
          onClick={onReceive}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Receive
        </button>
      </div>

      {/* Explorer link */}
      {chain?.explorerUrl && (
        <a
          href={`${chain.explorerUrl}/address/${wallet.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          View on Explorer
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  );
}
