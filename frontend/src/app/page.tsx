'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { WalletCard } from '@/components/WalletCard';
import { ChainSelector } from '@/components/ChainSelector';
import { CHAINS } from '@/lib/chains';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateWallets, setShowCreateWallets] = useState(false);
  const [selectedChains, setSelectedChains] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = api.getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const result = await api.getMe();
      setUser(result.user);
      loadWallets();
    } catch (error) {
      api.setToken(null);
      setLoading(false);
    }
  };

  const loadWallets = async () => {
    try {
      const result = await api.listWallets();
      setWallets(result.wallets || []);
    } catch (error) {
      console.error('Failed to load wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'signup') {
        await api.signup(email, password);
      } else {
        await api.login(email, password);
      }
      checkAuth();
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleCreateWallets = async () => {
    if (selectedChains.length === 0) return;
    setCreating(true);
    try {
      await api.createWallets(selectedChains);
      await loadWallets();
      setShowCreateWallets(false);
      setSelectedChains([]);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setWallets([]);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Auth form
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              🔐 CryptoVault
            </h1>
            <p className="text-gray-400 mt-2">Multi-Chain Wallet Demo</p>
          </div>

          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  authMode === 'login' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setAuthMode('signup')}
                className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                  authMode === 'signup' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>

              {authError && (
                <p className="text-red-400 text-sm">{authError}</p>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-500 hover:to-purple-500 transition-all"
              >
                {authMode === 'login' ? 'Login' : 'Create Account'}
              </button>
            </form>
          </div>

          <p className="text-center text-gray-500 text-sm mt-6">
            Powered by Planbok MPC System V2
          </p>
        </div>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              🔐 CryptoVault
            </h1>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/transactions" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Transactions</Link>
              <Link href="/tokens" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Tokens</Link>
              <Link href="/contracts" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Contract UI</Link>
              <Link href="/sign" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Sign</Link>
              <Link href="/customer/setup" className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">Self-Custody</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">{user.email}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-xl p-6 border border-blue-500/30">
            <p className="text-gray-400 text-sm">Total Wallets</p>
            <p className="text-3xl font-bold text-white mt-1">{wallets.length}</p>
          </div>
          <div className="bg-gradient-to-br from-green-600/20 to-teal-600/20 rounded-xl p-6 border border-green-500/30">
            <p className="text-gray-400 text-sm">Chains Connected</p>
            <p className="text-3xl font-bold text-white mt-1">
              {new Set(wallets.map(w => w.blockchain)).size}
            </p>
          </div>
          <div className="bg-gradient-to-br from-orange-600/20 to-red-600/20 rounded-xl p-6 border border-orange-500/30">
            <p className="text-gray-400 text-sm">Custody Mode</p>
            <p className="text-xl font-bold text-white mt-1">
              {user.customerId ? 'Dual-Custody' : 'Organization'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Your Wallets</h2>
          <button
            onClick={() => setShowCreateWallets(true)}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-500 hover:to-purple-500 transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Wallets
          </button>
        </div>

        {/* Create Wallets Modal */}
        {showCreateWallets && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto border border-gray-800">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Create New Wallets</h3>
                <button
                  onClick={() => setShowCreateWallets(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <p className="text-gray-400 mb-4">Select blockchains to create wallets for:</p>
              <ChainSelector
                selectedChains={selectedChains}
                onSelectionChange={setSelectedChains}
              />

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setShowCreateWallets(false)}
                  className="flex-1 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateWallets}
                  disabled={selectedChains.length === 0 || creating}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : `Create ${selectedChains.length} Wallet${selectedChains.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Wallets Grid */}
        {wallets.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔐</div>
            <h3 className="text-xl font-semibold text-white mb-2">No Wallets Yet</h3>
            <p className="text-gray-400 mb-6">Create your first multi-chain wallet to get started</p>
            <button
              onClick={() => {
                setSelectedChains(CHAINS.map(c => c.id));
                setShowCreateWallets(true);
              }}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-500 hover:to-purple-500 transition-all"
            >
              Create All Chain Wallets
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wallets.map((wallet) => (
              <WalletCard
                key={wallet.id}
                wallet={wallet}
                userCustomerId={user?.customerId}
                onSend={() => window.location.href = `/send?walletId=${wallet.id}`}
                onReceive={() => window.location.href = `/receive?walletId=${wallet.id}`}
              />
            ))}
          </div>
        )}

        {/* Faucets Section */}
        <div className="mt-12 bg-gray-900/50 rounded-2xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">🚰 Testnet Faucets</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {CHAINS.filter(c => c.faucetUrl).map((chain) => (
              <a
                key={chain.id}
                href={chain.faucetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <span>{chain.icon}</span>
                <span className="text-sm text-gray-300">{chain.symbol}</span>
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
