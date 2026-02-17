'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getChainById } from '@/lib/chains';
import { 
  ChevronLeft, 
  ExternalLink, 
  RefreshCw, 
  XCircle, 
  Zap, 
  Clock, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import Link from 'next/link';

function TransactionsContent() {
  const searchParams = useSearchParams();
  const walletId = searchParams.get('walletId');
  
  const [wallets, setWallets] = useState<any[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>(walletId || 'all');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const walletResult = await api.listWallets();
      setWallets(walletResult.wallets || []);
      
      const txResult = await api.listTransactions(selectedWalletId === 'all' ? undefined : selectedWalletId);
      setTransactions(txResult.transactions || []);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const txResult = await api.listTransactions(selectedWalletId === 'all' ? undefined : selectedWalletId);
      setTransactions(txResult.transactions || []);
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!loading) handleRefresh();
  }, [selectedWalletId]);

  const handleAction = async (txId: string, action: 'cancel' | 'accelerate') => {
    setActionLoading(txId);
    try {
      if (action === 'cancel') {
        await api.cancelTransaction(txId);
        alert('Transaction cancellation initiated');
      } else {
        await api.accelerateTransaction(txId);
        alert('Transaction acceleration initiated');
      }
      handleRefresh();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-orange-500 animate-pulse" />;
      case 'signed': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled': return <AlertCircle className="w-4 h-4 text-gray-500" />;
      default: return <RefreshCw className="w-4 h-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'text-green-400 bg-green-400/10';
      case 'pending': return 'text-orange-400 bg-orange-400/10';
      case 'failed': return 'text-red-400 bg-red-400/10';
      case 'cancelled': return 'text-gray-400 bg-gray-400/10';
      default: return 'text-blue-400 bg-blue-400/10';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-2xl font-bold">Transaction History</h1>
          </div>

          <div className="flex items-center gap-4">
            <select
              value={selectedWalletId}
              onChange={(e) => setSelectedWalletId(e.target.value)}
              className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:border-blue-500 outline-none"
            >
              <option value="all">All Wallets</option>
              {wallets.map(w => (
                <option key={w.id} value={w.id}>
                  {getChainById(w.blockchain)?.name || w.blockchain}
                </option>
              ))}
            </select>
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="px-6 py-4 text-sm font-medium text-gray-400">Type / Chain</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-400">Status</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-400">Amount</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-400">To / From</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-400">Date</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const chain = getChainById(tx.blockchain);
                    const isNative = !tx.token;
                    
                    return (
                      <tr key={tx.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs"
                              style={{ backgroundColor: `${chain?.color}20`, color: chain?.color }}
                            >
                              {chain?.icon || '🔗'}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white capitalize">{tx.type}</p>
                              <p className="text-xs text-gray-500">{chain?.name || tx.blockchain}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(tx.status)}`}>
                            {getStatusIcon(tx.status)}
                            <span className="capitalize">{tx.status}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-white">
                            {tx.amount || '0'} {tx.token?.symbol || chain?.symbol}
                          </div>
                          {!isNative && (
                            <p className="text-xs text-blue-400">Token Transfer</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-mono text-gray-400 truncate max-w-[120px]">
                            {tx.destinationAddress || tx.to || '-'}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400">
                          {new Date(tx.createdAt).toLocaleDateString()}
                          <p className="text-[10px]">{new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Explorer Link */}
                            {tx.hash && chain?.explorerUrl && (
                              <a
                                href={`${chain.explorerUrl}/tx/${tx.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                                title="View on Explorer"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}

                            {/* Cancel / Accelerate */}
                            {tx.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleAction(tx.id, 'accelerate')}
                                  disabled={actionLoading === tx.id}
                                  className="p-2 hover:bg-orange-500/20 rounded-lg text-orange-400 hover:text-orange-300 transition-colors"
                                  title="Accelerate (Speed Up)"
                                >
                                  <Zap className={`w-4 h-4 ${actionLoading === tx.id ? 'animate-pulse' : ''}`} />
                                </button>
                                <button
                                  onClick={() => handleAction(tx.id, 'cancel')}
                                  disabled={actionLoading === tx.id}
                                  className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                                  title="Cancel Transaction"
                                >
                                  <XCircle className={`w-4 h-4 ${actionLoading === tx.id ? 'animate-pulse' : ''}`} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <TransactionsContent />
    </Suspense>
  );
}
