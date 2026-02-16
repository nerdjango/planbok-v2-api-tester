'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, User, Wallet, Balance } from '@/lib/api';
import { getChainById } from '@/lib/chains';
import Link from 'next/link';

function SendContent() {
  const searchParams = useSearchParams();
  const walletId = searchParams.get('walletId');
  
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [selectedToken, setSelectedToken] = useState<Balance | null>(null);
  const [destinationAddress, setDestinationAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [feeLevel, setFeeLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [estimatedFee, setEstimatedFee] = useState<any>(null); // Keep any for fee structure as it varies
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const authResult = await api.getMe();
        setUser(authResult.user);
        
        if (walletId) {
          const walletsResult = await api.listWallets();
          const found = walletsResult.wallets?.find((w: any) => w.id === walletId);
          if (found) {
            setWallet(found);
            try {
              const balancesResult = await api.getWalletBalances(walletId);
              const allBalances = balancesResult.balances || [];
              setBalances(allBalances);
              
              const native = allBalances.find((b: any) => b.isNative);
              if (native) {
                setSelectedToken(native);
              } else if (allBalances.length > 0) {
                setSelectedToken(allBalances[0]);
              }
            } catch (err) {
              console.error('Failed to fetch balances:', err);
            }
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [walletId]);
  
  const handleEstimateFee = async () => {
    if (!destinationAddress || !amount || !walletId || !selectedToken?.tokenId) return;
    try {
      const estimate = await api.estimateFee(walletId, destinationAddress, amount, selectedToken.tokenId);
      setEstimatedFee(estimate);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedToken?.tokenId) {
      setError('Token ID not found');
      return;
    }
    setError('');
    setSending(true);
    try {
      const isSelfCustody = user?.customerId && wallet?.customer === user.customerId;
      
      if (isSelfCustody && user.customerId) {
        // Self-custody mode: Create challenge and redirect
        const redirectUrl = `${window.location.origin}/transactions?walletId=${walletId}`;
        const challengeResult = await api.createCustomerTransferChallenge(user.customerId, {
          walletId: walletId!,
          destinationAddress,
          amount,
          tokenId: selectedToken?.tokenId,
          feeLevel,
          redirectUrl
        });
        
        // Redirect to gateway
        window.location.href = challengeResult.redirectUrl;
      } else {
        // Organization mode: Standard transfer
        const txResult = await api.transfer(walletId!, destinationAddress, amount, selectedToken?.tokenId, feeLevel);
        setResult(txResult);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const chain = wallet ? getChainById(wallet.blockchain) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Wallet not found</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-white mb-2">Transaction Submitted!</h2>
          <p className="text-gray-400 mb-6">
            Your transaction has been submitted to the network.
          </p>
          <div className="bg-gray-800 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-gray-400 mb-1">Transaction ID</p>
            <code className="text-xs text-white break-all">{result.id || result.transactionId}</code>
          </div>
          {chain?.explorerUrl && result.hash && (
            <a
              href={`${chain.explorerUrl}/tx/${result.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block mb-4 text-blue-400 hover:text-blue-300"
            >
              View on Explorer →
            </a>
          )}
          <Link
            href="/"
            className="block w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className="text-xl font-semibold text-white">Send {selectedToken?.symbol || chain?.symbol}</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Wallet Info */}
        <div 
          className="bg-gray-900 rounded-xl p-4 mb-6 border-l-4"
          style={{ borderLeftColor: chain?.color }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
              style={{ backgroundColor: `${chain?.color}20` }}
            >
              {chain?.icon}
            </div>
            <div>
              <p className="font-medium text-white">{chain?.name}</p>
              <p className="text-sm text-gray-400 font-mono">{wallet.address.slice(0, 8)}...{wallet.address.slice(-8)}</p>
            </div>
          </div>
        </div>

        {/* Send Form */}
        <form onSubmit={handleSend} className="space-y-6">
          {/* Token Selector */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Select Token</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {balances.map((b) => (
                <button
                  key={b.tokenId}
                  type="button"
                  onClick={() => {
                    setSelectedToken(b);
                    setEstimatedFee(null);
                  }}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedToken?.tokenId === b.tokenId
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-white">{b.symbol}</span>
                    {b.isNative && (
                      <span className="text-[10px] bg-blue-600 px-1.5 py-0.5 rounded text-white uppercase tracking-wider font-bold">Native</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">{b.formatted} {b.symbol}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Recipient Address</label>
            <input
              type="text"
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              onBlur={handleEstimateFee}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono text-sm"
              placeholder="Enter recipient address"
              required
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="block text-sm text-gray-400">Amount ({selectedToken?.symbol})</label>
              {selectedToken && (
                <button 
                  type="button"
                  onClick={() => {
                    setAmount(selectedToken.formatted);
                    handleEstimateFee();
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Max: {selectedToken.formatted}
                </button>
              )}
            </div>
            <input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={handleEstimateFee}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-lg"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Fee Level</label>
            <div className="grid grid-cols-3 gap-3">
              {(['low', 'medium', 'high'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => {
                    setFeeLevel(level);
                    // No need to re-estimate as the response contains all levels
                  }}
                  className={`py-3 rounded-lg font-medium capitalize transition-colors ${
                    feeLevel === level
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {estimatedFee && (
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Estimated Fee ({feeLevel})</p>
              <p className="text-white font-medium">
                {estimatedFee[feeLevel]?.estimatedFeeFormatted}
              </p>
              {estimatedFee[feeLevel]?.currency && estimatedFee[feeLevel]?.currency !== chain?.symbol && (
                <p className="text-xs text-gray-500 mt-1">
                  Currency: {estimatedFee[feeLevel]?.currency}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={sending || !destinationAddress || !amount}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : `Send ${amount || '0'} ${selectedToken?.symbol || chain?.symbol}`}
          </button>
        </form>
      </main>
    </div>
  );
}

export default function SendPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <SendContent />
    </Suspense>
  );
}
