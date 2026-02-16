'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, User, Wallet, Transaction } from '@/lib/api';
import { getChainById } from '@/lib/chains';
import { 
  ChevronLeft, 
  Code2, 
  Send, 
  Zap, 
  AlertTriangle,
  Info,
  Layers,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

function ContractsContent() {
  const searchParams = useSearchParams();
  const walletId = searchParams.get('walletId');

  const [user, setUser] = useState<User | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | undefined>();
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [contractAddress, setContractAddress] = useState('');
  const [functionSignature, setFunctionSignature] = useState('');
  const [parameters, setParameters] = useState<string[]>(['']);
  const [amount, setAmount] = useState('0');
  const [feeLevel, setFeeLevel] = useState('medium');
  
  // Interaction state
  const [estimating, setEstimating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [feeEstimate, setFeeEstimate] = useState<any>(null);
  const [result, setResult] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const authResult = await api.getMe();
        setUser(authResult.user);
        
        const walletsResult = await api.listWallets();
        const contractChains = walletsResult.wallets.filter((w: Wallet) => 
          getChainById(w.blockchain)?.supportsContracts
        );
        setWallets(contractChains);
        
        if (walletId) {
          const wallet = wallets.find(w => w.id === walletId);
          setSelectedWallet(wallet);
        } else if (contractChains.length > 0) {
          setSelectedWallet(contractChains[0]);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [walletId]);

  const addParameter = () => setParameters([...parameters, '']);
  const removeParameter = (index: number) => {
    const newParams = [...parameters];
    newParams.splice(index, 1);
    setParameters(newParams);
  };
  const updateParameter = (index: number, value: string) => {
    const newParams = [...parameters];
    newParams[index] = value;
    setParameters(newParams);
  };

  const handleEstimate = async () => {
    if (!selectedWallet || !contractAddress) return;
    setEstimating(true);
    setError(null);
    setFeeEstimate(null);
    try {
      const estimate = await api.estimateContractExecutionFee({
        walletId: selectedWallet.id,
        contractAddress,
        abiFunctionSignature: functionSignature,
        abiParameters: parameters.filter(p => p !== ''),
        amount: amount || '0',
      });
      setFeeEstimate(estimate);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setEstimating(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedWallet || !contractAddress) return;
    setExecuting(true);
    setError(null);
    setResult(null);
    try {
      const isSelfCustody = user?.customerId && selectedWallet.customer === user.customerId;

      const params = {
        walletId: selectedWallet.id,
        contractAddress,
        abiFunctionSignature: functionSignature,
        abiParameters: parameters.filter(p => p !== ''),
        amount: amount || '0',
        feeLevel,
      };

      if (isSelfCustody && user?.customerId) {
        // Self-custody mode: Create challenge and redirect
        const redirectUrl = `${window.location.origin}/transactions?walletId=${selectedWallet?.id}`;
        const challengeResult = await api.createCustomerContractChallenge(user.customerId, {
          ...params,
          redirectUrl,
        });
        
        // Redirect to gateway
        window.location.href = challengeResult.redirectUrl;
      } else {
        // Organization mode: Standard execution
        const resp = await api.contractExecution(params);
        setResult(resp);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setExecuting(false);
    }
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link 
            href="/"
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Contract Interaction</h1>
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded uppercase tracking-wider">
              {chain?.type || 'MPC'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side: Form */}
          <div className="bg-gray-900 rounded-3xl p-6 md:p-8 border border-gray-800 shadow-2xl space-y-6">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <Code2 className="w-5 h-5" />
              <h2 className="font-semibold">Execution Details</h2>
            </div>

            {/* Wallet Selector */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Source Wallet</label>
              <select
                value={selectedWallet?.id}
                onChange={(e) => setSelectedWallet(wallets.find(w => w.id === e.target.value))}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:border-blue-500 outline-none cursor-pointer"
              >
                {wallets.length === 0 && <option value="">No contract wallets available</option>}
                {wallets.map(w => (
                  <option key={w.id} value={w.id}>
                    {getChainById(w.blockchain)?.name} ({truncateAddress(w.address)})
                  </option>
                ))}
              </select>
            </div>

            {/* Contract Address */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Contract Address</label>
              <input
                type="text"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="0x... or Solana Program ID"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:border-blue-500 outline-none"
              />
            </div>

            {/* Function Signature */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Function Signature <span className="text-[10px] text-gray-500">(e.g. transfer(address,uint256))</span>
              </label>
              <input
                type="text"
                value={functionSignature}
                onChange={(e) => setFunctionSignature(e.target.value)}
                placeholder="mint()"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:border-blue-500 outline-none"
              />
            </div>

            {/* Parameters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm text-gray-400">Parameters</label>
                <button 
                  onClick={addParameter}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  + Add Argument
                </button>
              </div>
              <div className="space-y-2">
                {parameters.map((param, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={param}
                      onChange={(e) => updateParameter(index, e.target.value)}
                      placeholder={`Arg ${index + 1}`}
                      className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:border-blue-500 outline-none"
                    />
                    <button 
                      onClick={() => removeParameter(index)}
                      className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Layers className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Value to Send ({chain?.symbol})</label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:border-blue-500 outline-none"
              />
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <button
                onClick={handleEstimate}
                disabled={estimating || !contractAddress}
                className="flex items-center justify-center gap-2 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                <Zap className={`w-4 h-4 ${estimating ? 'animate-pulse' : ''}`} />
                Estimate Fee
              </button>
              <button
                onClick={handleExecute}
                disabled={executing || !contractAddress}
                className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                <Send className={`w-4 h-4 ${executing ? 'animate-pulse' : ''}`} />
                Execute
              </button>
            </div>
          </div>

          {/* Right Side: Feedback */}
          <div className="space-y-6">
            {/* Fee Estimate Card */}
            {feeEstimate && (
              <div className="bg-blue-600/10 rounded-2xl p-6 border border-blue-600/30">
                <div className="flex items-center gap-2 text-blue-400 mb-4">
                  <Zap className="w-5 h-5" />
                  <h3 className="font-semibold">Fee Estimate</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-blue-900/20 p-3 rounded-lg">
                    <span className="text-sm text-blue-300">Estimated Gas ({feeLevel})</span>
                    <span className="text-white font-mono">{feeEstimate[feeLevel]?.estimatedFeeFormatted}</span>
                  </div>
                  <div className="flex gap-2">
                    {['low', 'medium', 'high'].map(level => (
                      <button
                        key={level}
                        onClick={() => setFeeLevel(level)}
                        className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                          feeLevel === level 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50'
                        }`}
                      >
                        {level.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Result Card */}
            {result && (
              <div className="bg-green-600/10 rounded-2xl p-6 border border-green-600/30">
                <div className="flex items-center gap-2 text-green-400 mb-4">
                  <CheckCircle2 className="w-5 h-5" />
                  <h3 className="font-semibold">Execution Result</h3>
                </div>
                <div className="space-y-4">
                  <div className="bg-gray-950/50 p-4 rounded-xl border border-gray-800">
                    <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
                    <p className="text-sm text-green-300 font-mono break-all">{result.hash || result.id}</p>
                  </div>
                  {result.hash && chain?.explorerUrl && (
                    <a
                      href={`${chain.explorerUrl}/tx/${result.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      View on Explorer
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Error Card */}
            {error && (
              <div className="bg-red-600/10 rounded-2xl p-6 border border-red-600/30">
                <div className="flex items-center gap-2 text-red-400 mb-2">
                  <AlertTriangle className="w-5 h-5" />
                  <h3 className="font-semibold">Execution Error</h3>
                </div>
                <p className="text-sm text-red-300/80">{error}</p>
              </div>
            )}

            {/* Tips Card */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <div className="flex items-center gap-2 text-gray-400 mb-4">
                <Info className="w-5 h-5" />
                <h3 className="font-semibold">Chain Notes</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex gap-3 text-sm text-gray-500">
                  <span className="text-blue-400">EVM:</span>
                  <span>Use standard solidity signatures like <code>mint(uint256)</code>. Parameters are passed as an array of strings.</span>
                </li>
                <li className="flex gap-3 text-sm text-gray-500">
                  <span className="text-green-400">Solana:</span>
                  <span>Contract address is the Program ID. Signature represents the instruction name or index.</span>
                </li>
                <li className="flex gap-3 text-sm text-gray-500">
                  <span className="text-gray-400">General:</span>
                  <span>This is a testnet demo. Do not use mainnet contract addresses or expect production performance.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckCircle2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function truncateAddress(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function ContractsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <ContractsContent />
    </Suspense>
  );
}
