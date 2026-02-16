'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getChainById } from '@/lib/chains';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, ChevronLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for tailwind classes merge
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function ReceiveContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const walletId = searchParams.get('walletId');
  
  const [wallets, setWallets] = useState<any[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadWallets();
  }, []);

  const loadWallets = async () => {
    try {
      const result = await api.listWallets();
      setWallets(result.wallets || []);
      
      if (walletId) {
        const found = result.wallets.find((w: any) => w.id === walletId);
        if (found) setSelectedWallet(found);
      } else if (result.wallets.length > 0) {
        setSelectedWallet(result.wallets[0]);
      }
    } catch (error) {
      console.error('Failed to load wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!selectedWallet) return;
    navigator.clipboard.writeText(selectedWallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const chain = selectedWallet ? getChainById(selectedWallet.blockchain) : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link 
            href="/"
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold">Receive Assets</h1>
        </div>

        <div className="bg-gray-900 rounded-3xl p-6 md:p-10 border border-gray-800 shadow-2xl overflow-hidden relative">
          {/* Background glow */}
          {chain && (
            <div 
              className="absolute -top-24 -right-24 w-64 h-64 blur-[120px] opacity-20"
              style={{ backgroundColor: chain.color }}
            />
          )}

          {/* Wallet Selector */}
          <div className="mb-8">
            <label className="block text-sm text-gray-400 mb-2">Select Wallet</label>
            <select
              value={selectedWallet?.id || ''}
              onChange={(e) => setSelectedWallet(wallets.find(w => w.id === e.target.value))}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
            >
              {wallets.map(w => (
                <option key={w.id} value={w.id}>
                  {getChainById(w.blockchain)?.name || w.blockchain} ({w.name || 'Personal'})
                </option>
              ))}
            </select>
          </div>

          {!selectedWallet ? (
            <div className="text-center py-10 text-gray-500">
              No wallets available. Go back to create one.
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {/* QR Code Container */}
              <div className="bg-white p-6 rounded-2xl mb-8 shadow-inner scale-110 md:scale-125">
                <QRCodeSVG 
                  value={selectedWallet.address} 
                  size={180}
                  level="H"
                  includeMargin={false}
                />
              </div>

              {/* Chain Badge */}
              <div 
                className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6"
                style={{ backgroundColor: `${chain?.color}20`, color: chain?.color }}
              >
                <span>{chain?.icon}</span>
                <span>{chain?.name} Network</span>
              </div>

              {/* Address Display */}
              <div className="w-full space-y-4">
                <div className="relative group">
                  <div className="absolute inset-x-0 bottom-full mb-2 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-gray-800 text-xs px-2 py-1 rounded shadow-lg border border-gray-700">
                      Copy Address
                    </div>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="w-full flex items-center justify-between gap-4 p-4 bg-gray-800/50 hover:bg-gray-800 rounded-2xl border border-gray-700 transition-all group"
                  >
                    <span className="font-mono text-xs md:text-sm break-all text-left text-gray-300 group-hover:text-white">
                      {selectedWallet.address}
                    </span>
                    <div className="flex-shrink-0 p-2 bg-gray-700 rounded-lg group-hover:bg-blue-600 transition-colors">
                      {copied ? <Check className="w-5 h-5 text-white" /> : <Copy className="w-5 h-5 text-gray-300" />}
                    </div>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <a
                    href={`${chain?.explorerUrl}/address/${selectedWallet.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Explorer
                  </a>
                  <button
                    onClick={() => router.push(`/send?walletId=${selectedWallet.id}`)}
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium transition-colors"
                  >
                    Go to Send
                  </button>
                </div>

                <p className="text-center text-xs text-orange-400 mt-6 bg-orange-400/10 p-3 rounded-lg border border-orange-400/20">
                  ⚠️ Send only <strong>{chain?.symbol}</strong> or compatible tokens to this address. 
                  Sending other assets may result in permanent loss.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReceivePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <ReceiveContent />
    </Suspense>
  );
}
