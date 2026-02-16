'use client';

import { useState, useEffect, Suspense } from 'react';
import { api, Token } from '@/lib/api';
import { getChainById, CHAINS } from '@/lib/chains';
import { 
  ChevronLeft, 
  Coins, 
  Plus, 
  Trash2
} from 'lucide-react';
import Link from 'next/link';

function TokensContent() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlockchain, setSelectedBlockchain] = useState('all');
  
  // New token form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBlockchain, setNewBlockchain] = useState('ETH-SEPOLIA');
  const [newAddress, setNewAddress] = useState('');
  const [newName, setNewName] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [newDecimals, setNewDecimals] = useState(18);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadTokens();
  }, [selectedBlockchain]);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const result = await api.listTokens(selectedBlockchain === 'all' ? undefined : selectedBlockchain);
      setTokens(result.tokens || []);
    } catch (error) {
      console.error('Failed to load tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const chain = getChainById(newBlockchain);
      let standard = 'erc20';
      if (chain?.type === 'sol') standard = 'fungible';
      if (chain?.type === 'near') standard = 'nep141';
      if (chain?.type === 'cosmos') standard = 'cw20';
      
      await api.addToken({
        blockchain: newBlockchain,
        address: newAddress,
        name: newName,
        symbol: newSymbol,
        decimals: newDecimals,
        standard,
      });
      
      setShowAddForm(false);
      resetForm();
      loadTokens();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setAdding(false);
    }
  };

  const resetForm = () => {
    setNewAddress('');
    setNewName('');
    setNewSymbol('');
    setNewDecimals(18);
  };

  if (loading && !adding) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Coins className="w-6 h-6 text-yellow-500" />
              Token Management
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedBlockchain}
              onChange={(e) => setSelectedBlockchain(e.target.value)}
              className="px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-sm outline-none focus:border-blue-500"
            >
              <option value="all">All Blockchains</option>
              {CHAINS.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Token
            </button>
          </div>
        </div>

        {/* Token Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tokens.map((token) => {
            const chain = getChainById(token.blockchain);
            return (
              <div 
                key={token.id}
                className="bg-gray-900 rounded-2xl p-6 border border-gray-800 hover:border-gray-700 transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-lg">
                      {chain?.icon || '🪙'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{token.name}</h3>
                      <p className="text-xs text-gray-500">{token.symbol}</p>
                    </div>
                  </div>
                  <div className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="text-gray-500 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-800">
                    <span className="text-xs text-gray-500">Blockchain</span>
                    <span className="text-xs font-medium text-gray-300">{chain?.name || token.blockchain}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-800">
                    <span className="text-xs text-gray-500">Decimals</span>
                    <span className="text-xs font-medium text-gray-300">{token.decimals}</span>
                  </div>
                  <div className="flex flex-col gap-1 py-1">
                    <span className="text-xs text-gray-500">Address</span>
                    <p className="text-[10px] font-mono text-gray-400 break-all bg-gray-950 p-2 rounded">
                      {token.address}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {tokens.length === 0 && (
          <div className="text-center py-20 bg-gray-900/50 rounded-3xl border border-gray-800 border-dashed">
            <Coins className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400">No Custom Tokens</h3>
            <p className="text-gray-500 mt-2">Add a custom token to track it across your wallets.</p>
          </div>
        )}

        {/* Add Token Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-3xl p-8 max-w-lg w-full border border-gray-800">
              <h2 className="text-xl font-bold mb-6">Add Custom Token</h2>
              
              <form onSubmit={handleAddToken} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Blockchain</label>
                  <select
                    value={newBlockchain}
                    onChange={(e) => setNewBlockchain(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white outline-none focus:border-blue-500"
                  >
                    {CHAINS.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Contract Address</label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Name</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Wrapped ETH"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Symbol</label>
                    <input
                      type="text"
                      value={newSymbol}
                      onChange={(e) => setNewSymbol(e.target.value)}
                      placeholder="WETH"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Decimals</label>
                  <input
                    type="number"
                    value={newDecimals}
                    onChange={(e) => setNewDecimals(parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 py-3 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adding}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-500 transition-colors disabled:opacity-50"
                  >
                    {adding ? 'Adding...' : 'Add Token'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TokensPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <TokensContent />
    </Suspense>
  );
}
