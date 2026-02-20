'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, User, Wallet } from '@/lib/api';
import { CHAINS } from '@/lib/chains';
import { 
  ChevronLeft, 
  UserPlus, 
  Key, 
  ShieldCheck,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import Link from 'next/link';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for tailwind classes merge
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CustomerConfig {
  hasPin: boolean;
  hasRecovery: boolean;
}

function CustomerSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isVerifyStep = searchParams?.get('step') === 'verify';

  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<CustomerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [settingUpRecovery, setSettingUpRecovery] = useState(false);
  const [creatingWallets, setCreatingWallets] = useState(false);
  const [selectedChains, setSelectedChains] = useState<string[]>(CHAINS.map(c => c.id));
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [verificationResult, setVerificationResult] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const result = await api.getMe();
      setUser(result.user);
      if (result.user.customerId) {
        const [customer, walletList] = await Promise.all([
          api.getCustomer(result.user.customerId),
          api.listWallets(undefined, result.user.customerId)
        ]);
        setConfig(customer);
        setWallets(walletList.wallets);
        
        // Filter out chains that already have wallets
        const existingBlockchains = walletList.wallets.map((w: Wallet) => w.blockchain);
        setSelectedChains(prev => prev.filter(id => !existingBlockchains.includes(id)));
      }
    } catch (error: unknown) {
      console.error('Failed to load user:', error);
    } finally {
      setLoading(false);
    }
  };

  // Poll for config updates
  useEffect(() => {
    let interval: any;
    if (user && user.customerId && !isVerifyStep) {
      interval = setInterval(async () => {
        try {
          const customer = await api.getCustomer(user.customerId!);
          setConfig(customer);
        } catch (e: unknown) {
          console.error('Customer polling error:', e);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [user, user?.customerId, isVerifyStep]);

  const handleCreateCustomer = async () => {
    setCreating(true);
    try {
      const result = await api.createCustomer();

      if (result.id) {
        await api.updateMe({ customerId: result.id });
      } else {
        throw new Error("Failed to create customer");
      }
      
      setUser({ ...user, customerId: result.id } as User);
      const customer = await api.getCustomer(result.id);
      setConfig(customer);
      setWallets([]); // Clear wallets from previous customer
      setSelectedChains(CHAINS.map(c => c.id)); // Reset selected chains
    } catch (error: unknown) {
      alert((error as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleInitialize = async () => {
    if (!user?.customerId) return;
    setInitializing(true);
    try {
      const redirectUrl = `${window.location.origin}/customer/setup?step=verify`;
      const result = await api.initializeCustomer(
        user.customerId,
        redirectUrl
      );

      const {
        challengeId,
        redirectUrl: hostedPinUrl,
      } = result;
      
      localStorage.setItem('last_challenge_id', challengeId);
      window.location.href = hostedPinUrl;
    } catch (error: unknown) {
      alert((error as Error).message);
    } finally {
      setInitializing(false);
    }
  };

  const handleSetupRecovery = async () => {
    if (!user?.customerId) return;
    setSettingUpRecovery(true);
    try {
      const redirectUrl = `${window.location.origin}/customer/setup?step=verify`;
      const result = await api.setupRecovery(
        user.customerId,
        redirectUrl
      );

      const {
        challengeId,
        redirectUrl: hostedPinUrl,
      } = result;
      
      localStorage.setItem('last_challenge_id', challengeId);
      window.location.href = hostedPinUrl;
    } catch (error: unknown) {
      alert((error as Error).message);
    } finally {
      setSettingUpRecovery(false);
    }
  };

  const [updatingPin, setUpdatingPin] = useState(false);
  const [resettingPin, setResettingPin] = useState(false);

  const handleUpdatePin = async () => {
    if (!user?.customerId) return;
    setUpdatingPin(true);
    try {
      const redirectUrl = `${window.location.origin}/customer/setup?step=verify`;
      const result = await api.updatePin(
        user.customerId,
        redirectUrl
      );

      const {
        challengeId,
        redirectUrl: hostedPinUrl,
      } = result;
      
      localStorage.setItem('last_challenge_id', challengeId);
      window.location.href = hostedPinUrl;
    } catch (error: unknown) {
      alert((error as Error).message);
    } finally {
      setUpdatingPin(false);
    }
  };

  const handleResetPin = async () => {
    if (!user?.customerId) return;
    setResettingPin(true);
    try {
      const redirectUrl = `${window.location.origin}/customer/setup?step=verify`;
      const result = await api.resetPin(
        user.customerId,
        redirectUrl
      );

      const {
        challengeId,
        redirectUrl: hostedPinUrl,
      } = result;
      
      localStorage.setItem('last_challenge_id', challengeId);
      window.location.href = hostedPinUrl;
    } catch (error: unknown) {
      alert((error as Error).message);
    } finally {
      setResettingPin(false);
    }
  };

  const handleCreateWallets = async () => {
    if (!user?.customerId) return;
    setCreatingWallets(true);
    try {
      const redirectUrl = `${window.location.origin}/customer/setup?step=verify`;
      const result = await api.createCustomerWalletChallenge(
        user.customerId,
        selectedChains,
        redirectUrl
      );

      const {
        challengeId,
        redirectUrl: hostedPinUrl,
      } = result;
      
      localStorage.setItem('last_challenge_id', challengeId);
      window.location.href = hostedPinUrl;
    } catch (error: unknown) {
      alert((error as Error).message);
    } finally {
      setCreatingWallets(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isVerifyStep && !verificationResult && user?.customerId) {
      const challengeId = localStorage.getItem('last_challenge_id');
      if (challengeId) {
        interval = setInterval(async () => {
          try {
            const status = await api.getChallenge(user.customerId!, challengeId);
            if (status.status === "verified") {
              setVerificationResult(status);
              clearInterval(interval);
            } else if (status.status === 'failed') {
              setError('Security setup failed. Please try again.');
              clearInterval(interval);
            }
          } catch (e: unknown) {
            console.error('Polling error:', e);
          }
        }, 2000);
      }
    }
    return () => clearInterval(interval);
  }, [isVerifyStep, user?.customerId, verificationResult]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (isVerifyStep) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-3xl p-8 text-center space-y-6">
          {!verificationResult ? (
            <>
              <div className="animate-spin w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
              <h1 className="text-2xl font-bold">Verifying Setup...</h1>
              <p className="text-gray-400">Please wait while we confirm your security initialization.</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold">Step Complete!</h1>
              <p className="text-gray-400">The operation has been verified successfully.</p>
              <button
                onClick={() => router.push('/customer/setup')}
                className="w-full py-4 bg-green-600 hover:bg-green-500 rounded-2xl font-bold transition-all"
              >
                Continue Setup
              </button>
            </>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
              <p className="text-red-400 text-sm">{error}</p>
              <button 
                onClick={() => window.location.href = '/customer/setup'}
                className="mt-2 text-sm text-red-500 underline"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link 
            href="/"
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold">Self-Custody Setup</h1>
        </div>

        <div className="space-y-6">
          {/* Step 1: Create Customer Identity */}
          <div className={cn(
            "bg-gray-900 rounded-3xl p-8 border transition-all duration-300",
            user?.customerId ? "border-green-500/30 bg-green-500/5" : "border-gray-800"
          )}>
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center",
                  user?.customerId ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"
                )}>
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">1. Customer Identity</h2>
                  <p className="text-gray-400 text-sm mt-1">
                    {user?.customerId 
                      ? "Identified created successfully." 
                      : "Create your unique identity in the MPC system."}
                  </p>
                  {user?.customerId && (
                    <div className="mt-4 bg-gray-950 p-3 rounded-lg border border-gray-800">
                      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Customer ID</p>
                      <code className="text-xs text-green-400">{user.customerId}</code>
                    </div>
                  )}
                </div>
              </div>
              
              {!user?.customerId && (
                <button
                  onClick={handleCreateCustomer}
                  disabled={creating}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              )}
              {user?.customerId && (
                <ShieldCheck className="w-8 h-8 text-green-500" />
              )}
            </div>
          </div>

          {/* Step 2: Security Initialization (PIN & Recovery) */}
          <div className={cn(
            "bg-gray-900 rounded-3xl p-8 border transition-all duration-300",
            !user?.customerId ? "opacity-50 grayscale pointer-events-none border-gray-800" : "border-gray-800"
          )}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Key className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold">2. Security Setup</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Configure your security credentials. PIN and Recovery must be set before creating wallets.
                </p>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* PIN Section */}
                  <div className={cn(
                    "p-4 rounded-2xl border transition-all",
                    config?.hasPin ? "bg-green-500/5 border-green-500/30" : "bg-gray-950 border-gray-800"
                  )}>
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-sm font-bold">PIN Security</span>
                       {config?.hasPin ? (
                         <ShieldCheck className="w-5 h-5 text-green-500" />
                       ) : (
                         <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                       )}
                    </div>
                    <p className="text-xs text-gray-500 mb-4">Set your 6-digit transaction PIN.</p>
                    {!config?.hasPin && (
                      <button
                        onClick={handleInitialize}
                        disabled={initializing}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-bold transition-all"
                      >
                        {initializing ? "Loading..." : "Set PIN"}
                      </button>
                    )}
                    {config?.hasPin && (
                      <div className="text-xs text-green-500 font-medium">PIN is configured</div>
                    )}
                  </div>

                  {/* Recovery Section */}
                  <div className={cn(
                    "p-4 rounded-2xl border transition-all",
                    config?.hasRecovery ? "bg-green-500/5 border-green-500/30" : "bg-gray-950 border-gray-800",
                    !config?.hasPin && "opacity-50 pointer-events-none"
                  )}>
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-sm font-bold">Account Recovery</span>
                       {config?.hasRecovery ? (
                         <ShieldCheck className="w-5 h-5 text-green-500" />
                       ) : (
                         <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                       )}
                    </div>
                    <p className="text-xs text-gray-500 mb-4">Setup recovery methods (Social/Email).</p>
                    {!config?.hasRecovery && config?.hasPin && (
                      <button
                        onClick={handleSetupRecovery}
                        disabled={settingUpRecovery}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold transition-all"
                      >
                        {settingUpRecovery ? "Loading..." : "Setup Recovery"}
                      </button>
                    )}
                    {config?.hasRecovery && (
                      <div className="text-xs text-green-500 font-medium">Recovery is set</div>
                    )}
                  </div>

                  {/* Update/Reset PIN Section */}
                  {config?.hasPin && config?.hasRecovery && (
                    <div className="col-span-1 md:col-span-2 p-4 rounded-2xl border bg-gray-950 border-gray-800 mt-2">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-bold">Manage PIN</span>
                        <div className="flex gap-2">
                           <button
                             onClick={handleUpdatePin}
                             disabled={updatingPin}
                             className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-bold transition-all border border-gray-700 hover:border-gray-600"
                           >
                             {updatingPin ? "Loading..." : "Update PIN"}
                           </button>
                           <button
                             onClick={handleResetPin}
                             disabled={resettingPin}
                             className="px-4 py-2 bg-red-900/20 hover:bg-red-900/30 text-red-400 hover:text-red-300 rounded-lg text-xs font-bold transition-all border border-red-900/30 hover:border-red-900/50"
                           >
                             {resettingPin ? "Loading..." : "Reset PIN"}
                           </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        Securely update your PIN or reset it using your recovery method.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Wallet Creation */}
          <div className={cn(
            "bg-gray-900 rounded-3xl p-8 border transition-all duration-300",
            (!config?.hasPin || !config?.hasRecovery) ? "opacity-50 grayscale pointer-events-none border-gray-800" : "border-gray-800"
          )}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold">3. Wallet Creation</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Create your master wallets for your chosen blockchains.
                </p>

                <div className="mt-8 space-y-6">
                  <div>
                    <label className="block text-sm text-gray-400 mb-4">Select Blockchains</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {CHAINS.map(chain => {
                        const isSelected = selectedChains.includes(chain.id);
                        const hasWallet = wallets.some(w => w.blockchain === chain.id);
                        return (
                          <button
                            key={chain.id}
                            disabled={hasWallet}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedChains(selectedChains.filter(id => id !== chain.id));
                              } else {
                                setSelectedChains([...selectedChains, chain.id]);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all",
                              isSelected 
                                ? "bg-orange-500/10 border-orange-500 text-orange-400" 
                                : "bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600",
                              hasWallet && "opacity-50 cursor-not-allowed border-green-500/30 bg-green-500/5 text-green-500/50"
                            )}
                          >
                            <span>{chain.icon}</span>
                            <span>{chain.symbol}</span>
                            {hasWallet && <ShieldCheck className="w-3 h-3 ml-auto text-green-500" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={handleCreateWallets}
                    disabled={creatingWallets || selectedChains.length === 0}
                    className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 group"
                  >
                    {creatingWallets ? "Processing..." : "Create Wallets"}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Powered by Planbok Multi-Party Computation (MPC)</p>
          <div className="flex justify-center gap-4 mt-2">
            <a href="#" className="hover:text-gray-300 transition-colors">How it works</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Security Audit</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerSetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <CustomerSetupContent />
    </Suspense>
  );
}
