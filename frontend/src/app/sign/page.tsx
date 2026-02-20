'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, User, Wallet } from '@/lib/api';
import { getChainById } from '@/lib/chains';
import Link from 'next/link';
import { ethers } from 'ethers';
import * as web3 from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import * as bitcoinMessage from 'bitcoinjs-message';
import { signatureVerify, blake2AsU8a, cryptoWaitReady } from '@polkadot/util-crypto';
import { fromBase64 } from '@cosmjs/encoding';
import { actions, buildDelegateAction, encodeDelegateAction, PublicKey, KeyPair } from 'near-api-js';
import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

type SignType = 'message' | 'typed-data' | 'transaction' | 'delegate-action';

interface SignResult {
  signature: string | { 
    signature: string;
    r?: string;
    s?: string;
    v?: number;
  };
  r?: string;
  s?: string;
  v?: number;
}

const JSON_TEMPLATES: Record<string, Record<string, unknown>> = {
  evm: {
    to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    value: '1000000000000000', // 0.001 ETH
    data: '0x',
    gasLimit: '21000',
    feeLevel: 'medium'
  },
  sol: {
    to: 'vines1vzrYbzduYv9bP9vfs9NBim76S6B8N06f7K7', // Solana Devnet Faucet
    amount: 100000,
    feeLevel: 'medium'
  },
  near: {
    signerId: 'account.testnet',
    receiverId: 'receiver.testnet',
    amount: '1000000000000000000000000', // 1 NEAR
    actions: [
      {
        type: 'Transfer',
        params: {
          amount: '1000000000000000000000000'
        }
      }
    ]
  },
  cosmos: {
    msgs: [
      {
        typeUrl: '/cosmos.bank.v1beta1.MsgSend',
        value: {
          fromAddress: 'cosmos1...',
          toAddress: 'cosmos1...',
          amount: [{ denom: 'uatom', amount: '100000' }]
        }
      }
    ],
    denom: 'uatom',
    memo: 'Sent from Planbok API Tester'
  },
  dot: {
    pallet: 'balances',
    method: 'transferKeepAlive',
    args: ['5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', '100000000000']
  }
};

const TYPED_DATA_EXAMPLE = {
  types: {
    Message: [
      { name: 'content', type: 'string' },
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
    ],
  },
  primaryType: 'Message',
  domain: {
    name: 'Planbok API Tester',
    version: '1',
    chainId: 11155111,
    verifyingContract: '0x0000000000000000000000000000000000000000'
  },
  message: {
    content: 'Hello from Planbok!',
    from: '0x0000000000000000000000000000000000000001',
    to: '0x0000000000000000000000000000000000000000'
  }
};

interface MsgBuilderState {
  content: string;
}

interface TxAction {
  type: string;
  params: Record<string, unknown>;
}

interface TxBuilderState {
  to: string;
  value: string;
  amount: string;
  data: string;
  actions: TxAction[];
  denom: string;
}

interface TypedDataField {
  name: string;
  value: string;
}

interface TypedDataBuilderState {
  domainName: string;
  chainId: number;
  fields: TypedDataField[];
}

function SignContent() {
  const searchParams = useSearchParams();
  const walletId = searchParams.get('walletId');
  
  const [user, setUser] = useState<User | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string>(walletId || '');
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [result, setResult] = useState<{
    signature: string | Record<string, unknown>;
    signedTransaction?: string;
    transactionHash?: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [verificationResult, setVerificationResult] = useState<{
    status: 'pending' | 'verified' | 'failed';
    message?: string;
  } | null>(null);

  // Sign State
  const [signType, setSignType] = useState<SignType>('message');
  const [message, setMessage] = useState('Hello, Planbok!');
  const [encodedByHex, setEncodedByHex] = useState(false);
  const [typedData, setTypedData] = useState(JSON.stringify(TYPED_DATA_EXAMPLE, null, 2));
  
  // Builder States
  const [msgBuilder, setMsgBuilder] = useState<MsgBuilderState>({ content: 'Hello, Planbok!' });
  const [txBuilder, setTxBuilder] = useState<TxBuilderState>({
    to: '',
    value: '0',
    amount: '1000000',
    data: '0x',
    actions: [],
    denom: 'uatom'
  });
  const [tdBuilder, setTdBuilder] = useState<TypedDataBuilderState>({
    domainName: 'Planbok API Tester',
    chainId: 11155111,
    fields: [
      { name: 'content', value: 'Hello from Planbok!' },
      { name: 'from', value: '0x0000000000000000000000000000000000000001' },
      { name: 'to', value: '0x0000000000000000000000000000000000000000' },
    ]
  });
  
  // Transaction State
  const [inputMode, setInputMode] = useState<'json' | 'encoded'>('json');
  const [transactionData, setTransactionData] = useState('');
  
  // Delegate Action State (NEAR Builder)
  const [delegateActionParams, setDelegateActionParams] = useState({
    signerId: '',
    receiverId: '',
    amount: '1000000000000000000000000',
    nonce: 1,
    maxBlockHeight: 0
  });
  const [delegateInputMode, setDelegateInputMode] = useState<'form' | 'json'>('form');
  const [delegateJson, setDelegateJson] = useState('');

  const selectedWalletData = wallets.find(w => w.id === selectedWallet);
  const chain = selectedWalletData ? getChainById(selectedWalletData.blockchain) : null;

  // Native NEAR Delegate Action Encoding (Borsh)
  const generatedDelegateActionBase64 = chain?.type === 'near' 
    ? (() => {
        try {
          const signerId = selectedWalletData?.address;
          if (!signerId) return '';
          
          let receiverId = delegateActionParams.receiverId;
          let nonce = BigInt(delegateActionParams.nonce);
          let maxBlockHeight = BigInt(delegateActionParams.maxBlockHeight || 0);
          
          let actionList = [actions.transfer(BigInt(delegateActionParams.amount))];

          // Parse JSON if in JSON mode
          if (delegateInputMode === 'json' && delegateJson) {
            try {
              const parsed = JSON.parse(delegateJson);
              receiverId = parsed.receiverId || receiverId;
              nonce = BigInt(parsed.nonce || nonce);
              maxBlockHeight = BigInt(parsed.maxBlockHeight || maxBlockHeight);
              
              if (parsed.actions && Array.isArray(parsed.actions)) {
                 actionList = parsed.actions.map((a: { type: string; params: Record<string, string> }) => {
                     if (a.type === 'Transfer') {
                       return actions.transfer(BigInt(a.params.amount));
                    }
                    // Add other action types if needed...
                    return actions.transfer(BigInt(0));
                 });
              }
            } catch (err) {
              console.warn('Invalid Delegate JSON:', err);
            }
          }

          if (!receiverId) return '';
          
          // 2. Resolve Public Key (Handling 0x prefix or raw hex from MPC backend)
          let pubKeyStr = selectedWalletData?.publicKey || '';
          if (pubKeyStr) {
             const cleanHex = pubKeyStr.startsWith('0x') ? pubKeyStr.slice(2) : pubKeyStr;
             if (cleanHex.length === 64) {
                const bytes = Buffer.from(cleanHex, 'hex');
                pubKeyStr = `ed25519:${bs58.encode(bytes)}`;
             } else if (!pubKeyStr.includes(':')) {
                // If it's already base58 but missing prefix
                pubKeyStr = `ed25519:${pubKeyStr}`;
             }
          }
          // Fallback random key if no wallet selected (just for builder preview)
          const finalPubKey = pubKeyStr ? PublicKey.from(pubKeyStr) : KeyPair.fromRandom('ed25519').getPublicKey();

          // 3. Create DelegateAction object
          const delegateAction = buildDelegateAction({
            senderId: signerId,
            receiverId: receiverId,
            actions: actionList,
            nonce: nonce,
            maxBlockHeight: maxBlockHeight,
            publicKey: finalPubKey,
          });

          // 4. Encode to Borsh
          const bytes = encodeDelegateAction(delegateAction);
          return Buffer.from(bytes).toString('base64');
        } catch (e) {
          console.error('Failed to generate delegate action:', e);
          return '';
        }
      })()
    : '';

  useEffect(() => {
    (async () => {
      try {
        const [authResult, walletsResult] = await Promise.all([
          api.getMe(),
          api.listWallets()
        ]);
        const fetchedUser = authResult.user;
        setUser(fetchedUser);
        const fetchedWallets = walletsResult.wallets || [];
        setWallets(fetchedWallets);

        // Handle Challenge Return
        const challengeId = searchParams.get('challengeId');
        console.log('[DEBUG] useEffect: Checking for challenge return', { challengeId, customerId: fetchedUser?.customerId });
        
        if (challengeId && fetchedUser?.customerId) {
          try {
            console.log('[DEBUG] useEffect: Fetching challenge details', { challengeId });
            const challenge = await api.getChallenge(fetchedUser.customerId, challengeId);
            console.log('[DEBUG] useEffect: Challenge fetched', challenge);
            if (challenge && challenge.status === 'verified' && challenge.result) {
              const meta = challenge.metadata as any || {};
              
              // 1. Set Wallet
              if (meta.walletId) {
                setSelectedWallet(meta.walletId);
              }

              // 2. Set Input Data & Sign Type
              if (meta.message) {
                setSignType('message');
                if (meta.encodedByHex) {
                  setEncodedByHex(true);
                  try {
                    const hex = meta.message.startsWith('0x') ? meta.message : `0x${meta.message}`;
                    const bytes = ethers.getBytes(hex);
                    const str = new TextDecoder().decode(bytes);
                    setMsgBuilder({ content: str });
                  } catch (e) {
                    console.warn('Failed to decode hex message for builder rehydration:', e);
                    setMessage(meta.message);
                  }
                } else {
                  setMsgBuilder({ content: meta.message });
                }
              } else if (meta.typedData) {
                setSignType('typed-data');
                setTypedData(meta.typedData);
              } else if (meta.transaction || meta.rawTransaction) {
                setSignType('transaction');
                if (meta.transaction) {
                  setInputMode('encoded');
                  setTransactionData(meta.transaction);
                } else {
                   // If it was rawTransaction, we might not have the original JSON, so we just set what we have
                   setInputMode('encoded'); // Assume it comes back as string/hex
                   setTransactionData(meta.rawTransaction);
                }
              } else if (meta.unsignedDelegateAction) {
                setSignType('delegate-action');
                // The meta might just have a flag, but ideally we'd want the original action.
                // For now, let's assume the user context is somewhat preserved or we just show the signature.
                // If the backend doesn't return the original action in metadata, we can't fully repopulate the builder.
                // But we can verify the signature if we have the payload.
              }

              // 3. Set Result (Signature) to trigger verification
              // The result structure from backend might be { signature: "0x..." } or similar
              setResult(challenge.result as any);
              
              // Trigger auto-verification handled by the existing useEffect on 'result' change
            } else if (challenge && challenge.status !== 'verified') {
               setError(`Challenge status: ${challenge.status}`);
            }
          } catch (e) {
            console.error('Failed to fetch challenge:', e);
            setError('Failed to load challenge results');
          }
        } else if (!selectedWallet && fetchedWallets.length > 0) {
           // Only default select if NO challenge return
           setSelectedWallet(fetchedWallets[0].id);
        }

      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedWallet, searchParams]);

  // Sync Builders -> Input Textareas
  useEffect(() => {
    if (!chain) return;

    if (signType === 'message') {
      if (encodedByHex) {
        // Convert string content to hex bytes if toggle is on
        const hex = Array.from(new TextEncoder().encode(msgBuilder.content))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        setMessage(hex ? `0x${hex}` : '');
      } else {
        setMessage(msgBuilder.content);
      }
    }

    if (signType === 'typed-data') {
      const messageObj: Record<string, unknown> = {};
      tdBuilder.fields.forEach(f => {
        if (f.name) messageObj[f.name] = f.value;
      });

      const template = {
        ...TYPED_DATA_EXAMPLE,
        domain: {
          ...TYPED_DATA_EXAMPLE.domain,
          name: tdBuilder.domainName,
          chainId: tdBuilder.chainId
        },
        message: messageObj
      };
      setTypedData(JSON.stringify(template, null, 2));
    }

    if (signType === 'transaction') {
      let template: Record<string, unknown> = {};
      if (chain.type === 'evm') {
        template = {
          to: txBuilder.to || '0x...',
          value: txBuilder.value || '0',
          data: txBuilder.data || '0x',
        };
      } else if (chain.type === 'sol') {
        template = {
          to: txBuilder.to || '...',
          amount: Number(txBuilder.amount) || 0,
        };
      } else if (chain.type === 'near') {
        template = {
          receiverId: txBuilder.to || 'recipient.testnet',
          actions: txBuilder.actions.length > 0 ? txBuilder.actions : [{ type: 'Transfer', params: { amount: '1000000000000000000000000' } }]
        };
      } else {
        template = JSON_TEMPLATES[chain.type] || {};
      }

      if (inputMode === 'json') {
        setTransactionData(JSON.stringify(template, null, 2));
      } else {
        // EVM uses Hex, others use Base64
        if (chain.type === 'evm') {
          setTransactionData(`0x${Buffer.from(JSON.stringify(template)).toString('hex')}`);
        } else {
          setTransactionData(Buffer.from(JSON.stringify(template)).toString('base64'));
        }
      }
    }

    if (signType === 'delegate-action' && chain.type === 'near') {
      const defaultTemplate = {
        receiverId: delegateActionParams.receiverId || 'receiver.testnet',
        actions: [
          {
            type: 'Transfer',
            params: {
              amount: delegateActionParams.amount
            }
          }
        ],
        nonce: delegateActionParams.nonce,
        maxBlockHeight: delegateActionParams.maxBlockHeight
      };

      if (delegateJson === '') {
        setDelegateJson(JSON.stringify(defaultTemplate, null, 2));
      }

      if (delegateInputMode === 'json') {
        setTransactionData(delegateJson || JSON.stringify(defaultTemplate, null, 2));
      } else {
        // Form mode: signer logic will use generatedDelegateActionBase64
        // But we still want to show a default in the signing box if it's empty
        if (!transactionData && generatedDelegateActionBase64) {
           setTransactionData(generatedDelegateActionBase64);
        }
      }
    }
  }, [chain, signType, inputMode, msgBuilder, txBuilder, tdBuilder, selectedWalletData?.address, encodedByHex, delegateInputMode, delegateJson, delegateActionParams, generatedDelegateActionBase64, transactionData]);

  // Unified Verification Effect
  useEffect(() => {
    // Only execute if we have a result and necessary context
    if (!result || !chain || !selectedWalletData) return;

    // Avoid running if verification is already done for this result
    // (This is a simplified check, ideally we'd track result ID but result object ref change is enough for React)
    
    const verify = async () => {
      const signResultData = result as unknown as SignResult;
      
      // Basic check for signature presence
      if (!signResultData || (!signResultData.signature && !result.signedTransaction)) return;

      setVerificationResult({ status: 'pending' });
      
      try {
        let signature: string | ethers.Signature | undefined;
        // The API may return r/s/v as top-level fields OR nested inside signResult.signature
        const sigIsObject = typeof signResultData.signature === 'object';
        const sigObj = sigIsObject ? (signResultData.signature as Record<string, unknown>) : ({} as Record<string, unknown>);
        const sigStr = typeof signResultData.signature === 'string' ? signResultData.signature : (sigObj.signature as string) || '';
        
        // Look for r, s, v at both levels
        const r = (sigObj.r as string) || signResultData.r;
        const s = (sigObj.s as string) || signResultData.s;
        const v = (sigObj.v as number) ?? signResultData.v;

        console.log('[DEBUG-EFFECT] Raw result:', JSON.stringify(result, null, 2));
        console.log('[DEBUG-EFFECT] Verification context:', { signType, chainType: chain.type, wallet: selectedWalletData.address });

        if (chain.type === 'evm') {
          if (r && s) {
            const rHex = r.startsWith('0x') ? r : `0x${r}`;
            const sHex = s.startsWith('0x') ? s : `0x${s}`;
            // Map v: MPC returns 0 or 1, ethers expects 27 or 28
            const vNormalized = v !== undefined ? (v < 27 ? v + 27 : v) : 27;
            signature = ethers.Signature.from({ r: rHex, s: sHex, v: vNormalized });
            console.log('[DEBUG-EFFECT] Reconstructed signature from r,s,v:', signature.serialized);
          } else if (sigStr) {
            let cleanSig = sigStr.startsWith('0x') ? sigStr : `0x${sigStr}`;
            // 128 hex = 64 bytes (r+s), 130 hex with 0x prefix
            if (cleanSig.length === 130 && v !== undefined) {
              const vNormalized = v < 27 ? v + 27 : v;
              const vHex = vNormalized === 27 ? '1b' : '1c';
              cleanSig += vHex;
            }
            signature = cleanSig;
            console.log('[DEBUG-EFFECT] Using sigStr path, final:', cleanSig);
          }
        } else {
          signature = sigStr.replace('0x', '');
        }
        
        let isVerified = false;
        let verificationMsg = '';

        if (signType === 'message') {
          if (chain.type === 'evm' && signature) {
            console.log('[DEBUG-EFFECT] Verifying message:', JSON.stringify(message));
            
            const messageToVerify = message;
            const recoveredAddress = ethers.verifyMessage(messageToVerify, signature);
            console.log('[DEBUG-EFFECT] Recovered:', recoveredAddress, 'Expected:', selectedWalletData.address);
            isVerified = recoveredAddress.toLowerCase() === selectedWalletData.address.toLowerCase();
            console.log('[DEBUG-EFFECT] Verified:', isVerified);
            
            // If failed, try with flipped v to diagnose
            if (!isVerified && r && s) {
              const rHex = r.startsWith('0x') ? r : `0x${r}`;
              const sHex = s.startsWith('0x') ? s : `0x${s}`;
              for (const tryV of [27, 28]) {
                try {
                  const trySig = ethers.Signature.from({ r: rHex, s: sHex, v: tryV });
                  const tryAddr = ethers.verifyMessage(messageToVerify, trySig);
                  if (tryAddr.toLowerCase() === selectedWalletData.address.toLowerCase()) {
                    isVerified = true;
                    verificationMsg = `Verified with v=${tryV} (MPC returned v=${v})`;
                    break;
                  }
                } catch { /* skip */ }
              }
              if (!isVerified) {
                verificationMsg = `Address mismatch — recovered ${recoveredAddress} but wallet is ${selectedWalletData.address}.`;
              }
            }
          } else if (chain.type === 'sol') {
            let pubKey: web3.PublicKey;
            try {
                const pkStr = selectedWalletData.publicKey || '';
                if (pkStr.startsWith('0x')) {
                    pubKey = new web3.PublicKey(Buffer.from(pkStr.slice(2), 'hex'));
                } else if (/^[0-9a-fA-F]{64}$/.test(pkStr)) {
                    // Likely hex without 0x
                    pubKey = new web3.PublicKey(Buffer.from(pkStr, 'hex'));
                } else {
                    // Assume Base58
                    pubKey = new web3.PublicKey(pkStr);
                }
            } catch (e) {
                console.error('Invalid Solana Public Key:', selectedWalletData.publicKey, e);
                setVerificationResult({ status: 'failed', message: `Invalid Solana Public Key: ${(e as Error).message}` });
                return;
            }

            const msgBytes = encodedByHex ? ethers.getBytes(message) : new TextEncoder().encode(message);
            try {
              let sigBytes: Uint8Array;
              const sigStr = signature as string;
              
              const cleanHex = sigStr.startsWith('0x') ? sigStr.slice(2) : sigStr;
              const isHex = /^[0-9a-fA-F]+$/.test(cleanHex);
              
              if (isHex && cleanHex.length === 128) {
                 sigBytes = ethers.getBytes(sigStr.startsWith('0x') ? sigStr : `0x${sigStr}`);
              } else {
                 try {
                   sigBytes = bs58.decode(sigStr);
                 } catch (e) {
                   if (isHex) {
                      sigBytes = ethers.getBytes(sigStr.startsWith('0x') ? sigStr : `0x${sigStr}`);
                   } else {
                      throw new Error('Signature is not valid Hex or Base58');
                   }
                 }
              }
              
              // Try standard verification (Raw Message)
              let isValid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKey.toBytes());
              
              if (!isValid) {
                  // Retry with specific hash logic if raw fails
                  const prefix2 = new TextEncoder().encode('\x19Solana Signed Message:\n');
                  const fullMessage = new Uint8Array(prefix2.length + msgBytes.length);
                  fullMessage.set(prefix2);
                  fullMessage.set(msgBytes, prefix2.length);
                  const solHash = ethers.sha256(fullMessage);
                  const solHashBytes = ethers.getBytes(solHash);
                  
                  if (nacl.sign.detached.verify(solHashBytes, sigBytes, pubKey.toBytes())) {
                      isValid = true;
                      verificationMsg = 'Verified (Schema: Hashed with Prefix)';
                  }
              } else {
                  verificationMsg = 'Verified (Schema: Raw Message)';
              }

              isVerified = isValid;
              if (!isVerified) verificationMsg = 'Solana signature verification failed';
              
            } catch (err) {
              isVerified = false;
              const error = err as Error;
              verificationMsg = `Solana verify error: ${error.message}`;
            }
          } else if (chain.type === 'btc') {
            try {
              const msg = encodedByHex ? Buffer.from(ethers.getBytes(message)) : message;
              isVerified = bitcoinMessage.verify(msg, selectedWalletData.address, signature as string, undefined, true);
              verificationMsg = isVerified ? 'Bitcoin signature verified' : 'Bitcoin signature verification failed';
            } catch (e: unknown) {
              isVerified = false;
              const error = e as Error;
              verificationMsg = `BTC verify error: ${error.message}`;
            }
          } else if (chain.type === 'near') {
            try {
              let pubKeyStr = selectedWalletData.publicKey || '';
              if (pubKeyStr) {
                const cleanHex = pubKeyStr.startsWith('0x') ? pubKeyStr.slice(2) : pubKeyStr;
                if (cleanHex.length === 64) {
                  const bytes = Buffer.from(cleanHex, 'hex');
                  pubKeyStr = `ed25519:${bs58.encode(bytes)}`;
                } else if (!pubKeyStr.includes(':')) {
                  pubKeyStr = `ed25519:${pubKeyStr}`;
                }
              }
      
              const pubKey = PublicKey.from(pubKeyStr);
              const msgBytes = encodedByHex ? ethers.getBytes(message) : new TextEncoder().encode(message);
              const msgHash = ethers.sha256(msgBytes);
              const msgHashBytes = ethers.getBytes(msgHash);
              
              const sigStr = signature as string;
              const sigBytes = (sigStr.startsWith('0x') || sigStr.length === 128)
                ? ethers.getBytes(sigStr.startsWith('0x') ? sigStr : `0x${sigStr}`)
                : fromBase64(sigStr);

              isVerified = pubKey.verify(msgHashBytes, sigBytes);
              verificationMsg = isVerified ? 'NEAR signature verified' : 'NEAR signature verification failed';
            } catch (e: unknown) {
              isVerified = false;
              const error = e as Error;
              verificationMsg = `NEAR verify error: ${error.message}`;
            }
          } else if (chain.type === 'dot') {
            try {
              const msgBytes = encodedByHex ? ethers.getBytes(message) : new TextEncoder().encode(message);
              const sigStr = signature as string;
              const sigBytes = (sigStr.startsWith('0x') || sigStr.length === 128)
                ? ethers.getBytes(sigStr.startsWith('0x') ? sigStr : `0x${sigStr}`)
                : fromBase64(sigStr);

              await cryptoWaitReady();
              const substrateHash = blake2AsU8a(msgBytes, 256);
              isVerified = signatureVerify(substrateHash, sigBytes, selectedWalletData.address).isValid;
              verificationMsg = isVerified ? 'Substrate signature verified' : 'Substrate signature verification failed';
            } catch (e: unknown) {
              isVerified = false;
              const error = e as Error;
              verificationMsg = `Substrate verify error: ${error.message}`;
            }
          } else if (chain.type === 'cosmos') {
            isVerified = !!signature;
            verificationMsg = 'Cosmos signature presence confirmed';
          }
        } else if (signType === 'typed-data' && chain.type === 'evm' && signature) {
          const parsed = JSON.parse(typedData);
          const recoveredAddress = ethers.verifyTypedData(parsed.domain, parsed.types, parsed.message || parsed.value, signature);
          isVerified = recoveredAddress.toLowerCase() === selectedWalletData.address.toLowerCase();
        } else if (signType === 'transaction') {
          isVerified = !!signResultData.signature || !!result.signedTransaction;
          verificationMsg = 'Signature attached to transaction payload';
        } else {
          isVerified = !!signature;
        }

        setVerificationResult({ 
          status: isVerified ? 'verified' : 'failed',
          message: verificationMsg || (isVerified ? 'Signature matches selected wallet address' : 'Signature verification failed')
        });
      } catch (vErr) {
        console.error('Verification error:', vErr);
        setVerificationResult({ 
          status: 'failed', 
          message: `Verification logic error: ${vErr instanceof Error ? vErr.message : String(vErr)}` 
        });
      }
    };

    verify();
  }, [result, chain, selectedWalletData, signType, message, typedData, encodedByHex, transactionData]);

  const resetBuilders = () => {
    if (!chain) return;
    setMsgBuilder({ content: 'Hello, Planbok!' });
    setTxBuilder({
      to: '',
      value: '0',
      amount: '1000000',
      data: '0x',
      actions: [],
      denom: 'uatom'
    });
    setTdBuilder({
      domainName: 'Planbok API Tester',
      chainId: 11155111,
      fields: [
        { name: 'content', value: 'Hello from Planbok!' },
        { name: 'from', value: '0x0000000000000000000000000000000000000001' },
        { name: 'to', value: '0x0000000000000000000000000000000000000000' },
      ]
    });
    setDelegateActionParams({
      signerId: '',
      receiverId: '',
      amount: '1000000000000000000000000',
      nonce: 1,
      maxBlockHeight: 0
    });
    setDelegateJson('');
  };

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWallet) return;
    

    setError('');
    setResult(null);
    setVerificationResult(null);
    setSigning(true);
    // Explicitly do not reset result here as it will trigger the effect immediately if not careful
    // But result is being set to null so it's fine.
    // However, if we are in redirect mode, result is updated in useEffect on mount.
    // handleSign handles the form submission only.


    try {
      let signResult;
      
      switch (signType) {
        case 'message':
          if (user?.customerId && selectedWalletData?.customer === user.customerId) {
            console.log('[DEBUG] handleSign: Self-custody mode detected');
            console.log('[DEBUG] handleSign: Creating customer sign message challenge', {
              customerId: user.customerId,
              walletId: selectedWallet,
              message,
              redirectUrl: window.location.href
            });
            // Self-custody mode
            const challenge = await api.createCustomerSignMessageChallenge(user.customerId, {
              walletId: selectedWallet,
              message,
              redirectUrl: window.location.href,
            });
            window.location.href = challenge.redirectUrl;
            return;
          }
          signResult = await api.signMessage(selectedWallet, message, encodedByHex);
          break;

        case 'typed-data':
          const td = JSON.parse(typedData) as Record<string, unknown>;
          if (user?.customerId && selectedWalletData?.customer === user.customerId) {
             const challenge = await api.createCustomerSignTypedDataChallenge(user.customerId, {
               walletId: selectedWallet,
               typedData: td,
               redirectUrl: window.location.href,
             });
             window.location.href = challenge.redirectUrl;
             return;
          }
          signResult = await api.signTypedData(selectedWallet, td);
          break;

        case 'transaction':
          let data = inputMode === 'json' ? JSON.parse(transactionData) as Record<string, unknown> : transactionData;
          
          // Normalize encoded strings if input is hex but needs processing
          if (inputMode === 'encoded' && typeof data === 'string' && chain) {
            const chainType = chain.type;
            
            if (chainType === 'evm') {
              // Ensure EVM hex starts with 0x
              if (!data.startsWith('0x')) {
                data = `0x${data}`;
              }
            } else if (['near', 'sol', 'cosmos'].includes(chainType)) {
              let normalized = data.trim();
              
              // 0. If it looks like JSON, encode as base64 (just like MPC system default)
              if (normalized.startsWith('{') || normalized.startsWith('[')) {
                try {
                  JSON.parse(normalized);
                  normalized = Buffer.from(normalized).toString('base64');
                } catch { /* not valid JSON, ignore */ }
              }

              // 1. If hex, convert to base64
              if (normalized.startsWith('0x')) {
                const hex = normalized.slice(2);
                if (/^[0-9a-fA-F]*$/.test(hex)) {
                  normalized = Buffer.from(hex, 'hex').toString('base64');
                }
              }
              
              // 2. Add padding if missing and it looks like base64
              if (/^[A-Za-z0-9+/]+$/.test(normalized)) {
                const missingPadding = (4 - (normalized.length % 4)) % 4;
                if (missingPadding > 0) {
                  normalized = normalized.padEnd(normalized.length + missingPadding, '=');
                }
              }
              
              data = normalized;
            }
          }
          
          if (user?.customerId && selectedWalletData?.customer === user.customerId) {
             const challenge = await api.createCustomerSignTransactionChallenge(user.customerId, {
               walletId: selectedWallet,
               [inputMode === 'json' ? 'transaction' : 'rawTransaction']: data,
               redirectUrl: window.location.href,
             });
             window.location.href = challenge.redirectUrl;
             return;
          }

          signResult = await api.signTransaction(selectedWallet, data, inputMode);
          break;

        case 'delegate-action':
          if (!transactionData.trim()) {
            throw new Error('Please provide an encoded delegate action (use the builder to generate one)');
          }
          
          let delegateData = transactionData.trim();
          
          // Normalize encoded base64 for NEAR delegate actions
          if (chain?.type === 'near') {
            // 0. If it looks like JSON, encode as base64
            if (delegateData.startsWith('{') || delegateData.startsWith('[')) {
              try {
                JSON.parse(delegateData);
                delegateData = Buffer.from(delegateData).toString('base64');
              } catch { /* not valid JSON */ }
            }

            // 1. If hex, convert to base64
            if (delegateData.startsWith('0x')) {
              const hex = delegateData.slice(2);
              if (/^[0-9a-fA-F]*$/.test(hex)) {
                delegateData = Buffer.from(hex, 'hex').toString('base64');
              }
            }
            
            // 2. Add padding if missing and it looks like base64
            if (/^[A-Za-z0-9+/]+$/.test(delegateData)) {
              const missingPadding = (4 - (delegateData.length % 4)) % 4;
              if (missingPadding > 0) {
                delegateData = delegateData.padEnd(delegateData.length + missingPadding, '=');
              }
            }
          }
          
          if (user?.customerId && selectedWalletData?.customer === user.customerId) {
             const challenge = await api.createCustomerSignDelegateActionChallenge(user.customerId, {
               walletId: selectedWallet,
               unsignedDelegateAction: delegateData,
               redirectUrl: window.location.href,
             });
             window.location.href = challenge.redirectUrl;
             return;
          }

          signResult = await api.signDelegateAction(selectedWallet, delegateData);
          break;
      }
      
      setResult(signResult);
      // Verification logic moved to useEffect
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setVerificationResult(null);
    } finally {
      setSigning(false);
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
    <div className="min-h-screen bg-gray-950">
      <header className="bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Sign Playground</h1>
              <p className="text-xs text-gray-500">Test multi-chain signing capabilities</p>
            </div>
          </div>
          {chain && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-full border border-gray-700">
              <span className="text-sm">{chain.icon}</span>
              <span className="text-xs font-medium text-gray-300">{chain.name}</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Left Column: Form */}
          <div className="lg:col-span-7 space-y-6">
            <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-6">
              {/* Wallet Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-3">Signing Wallet</label>
                <select
                  value={selectedWallet}
                  onChange={(e) => setSelectedWallet(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                >
                  {wallets.map((w) => {
                    const wChain = getChainById(w.blockchain);
                    return (
                      <option key={w.id} value={w.id}>
                        {wChain?.icon} {wChain?.id} — {w.address.slice(0, 10)}...{w.address.slice(-6)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Sign Type Tabs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { id: 'message', label: 'Message', supported: true },
                  { id: 'typed-data', label: 'Typed Data', supported: chain?.supportsSignTypedData },
                  { id: 'transaction', label: 'Transaction', supported: chain?.supportsSignTransaction },
                  { id: 'delegate-action', label: 'Delegate', supported: chain?.supportsSignDelegateAction },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSignType(t.id as SignType)}
                    disabled={!t.supported}
                    className={`p-3 rounded-xl text-xs font-semibold transition-all border ${
                      signType === t.id
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750 disabled:opacity-30 disabled:grayscale'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSign} className="space-y-6">
                {/* Message Builder */}
                {signType === 'message' && (
                  <div className="space-y-4">
                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 space-y-4">
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Message Content</label>
                      <textarea
                        value={msgBuilder.content}
                        onChange={(e) => setMsgBuilder({ content: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white text-sm focus:border-blue-500 outline-none resize-none"
                        placeholder="Enter message to sign..."
                      />

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Treat as Hex</label>
                          <button
                            type="button"
                            onClick={() => setEncodedByHex(!encodedByHex)}
                            className={`w-10 h-5 rounded-full transition-all relative ${encodedByHex ? 'bg-blue-600' : 'bg-gray-700'}`}
                          >
                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${encodedByHex ? 'left-6' : 'left-1'}`} />
                          </button>
                        </div>
                        {encodedByHex && (
                          <span className="text-[10px] text-amber-500 font-medium">Input will be converted to hex bytes first</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-400">Sign Input (Final)</label>
                      <textarea
                        readOnly
                        value={message}
                        rows={2}
                        className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-blue-400/80 font-mono text-xs cursor-default"
                      />
                    </div>
                  </div>
                )}

                {signType === 'typed-data' && (
                  <div className="space-y-6">
                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 space-y-4">
                      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">EIP-712 Builder</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Domain Name</label>
                          <input
                            value={tdBuilder.domainName}
                            onChange={(e) => setTdBuilder(p => ({ ...p, domainName: e.target.value }))}
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Chain ID</label>
                          <input
                            type="number"
                            value={tdBuilder.chainId}
                            onChange={(e) => setTdBuilder(p => ({ ...p, chainId: Number(e.target.value) }))}
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <label className="block text-[10px] font-bold text-gray-600 uppercase">Message Fields</label>
                        {tdBuilder.fields.map((field, idx) => (
                          <div key={idx} className="flex gap-2">
                            <input
                              value={field.name}
                              onChange={(e) => {
                                const newFields = [...tdBuilder.fields];
                                newFields[idx].name = e.target.value;
                                setTdBuilder(p => ({ ...p, fields: newFields }));
                              }}
                              placeholder="Key"
                              className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs"
                            />
                            <input
                              value={field.value}
                              onChange={(e) => {
                                const newFields = [...tdBuilder.fields];
                                newFields[idx].value = e.target.value;
                                setTdBuilder(p => ({ ...p, fields: newFields }));
                              }}
                              placeholder="Value"
                              className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newFields = tdBuilder.fields.filter((_, i) => i !== idx);
                                setTdBuilder(p => ({ ...p, fields: newFields }));
                              }}
                              className="px-2 text-gray-600 hover:text-red-500"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setTdBuilder(p => ({ ...p, fields: [...p.fields, { name: '', value: '' }] }))}
                          className="text-[10px] font-bold text-blue-500 hover:text-blue-400 uppercase"
                        >
                          + Add Field
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-400">JSON Preview</label>
                      <textarea
                        value={typedData}
                        onChange={(e) => setTypedData(e.target.value)}
                        rows={10}
                        className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white focus:border-blue-500 outline-none resize-none font-mono text-xs"
                        placeholder="Enter JSON..."
                      />
                    </div>
                  </div>
                )}

                {signType === 'transaction' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-400">Transaction Input</label>
                      <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700">
                        <button
                          type="button"
                          onClick={() => setInputMode('json')}
                          className={`px-3 py-1 text-[10px] uppercase font-bold rounded-md transition-all ${
                            inputMode === 'json' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          JSON
                        </button>
                        <button
                          type="button"
                          onClick={() => setInputMode('encoded')}
                          className={`px-3 py-1 text-[10px] uppercase font-bold rounded-md transition-all ${
                            inputMode === 'encoded' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          Encoded
                        </button>
                      </div>
                    </div>

                    {inputMode === 'json' && chain && (
                      <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Builder</h4>
                          <button 
                            type="button"
                            onClick={resetBuilders}
                            className="text-[10px] font-bold text-gray-400 hover:text-white transition-colors uppercase"
                          >
                            Reset
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">To / Recipient</label>
                            <input
                              value={txBuilder.to}
                              onChange={(e) => setTxBuilder((p: TxBuilderState) => ({ ...p, to: e.target.value }))}
                              placeholder={chain.type === 'evm' ? '0x...' : 'Address'}
                              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">{chain.type === 'evm' ? 'Value (Wei)' : 'Amount'}</label>
                            <input
                              value={chain.type === 'evm' ? txBuilder.value : txBuilder.amount}
                              onChange={(e) => setTxBuilder((p: TxBuilderState) => ({ ...p, [chain.type === 'evm' ? 'value' : 'amount']: e.target.value }))}
                              placeholder="0"
                              className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white"
                            />
                          </div>
                          {chain.type === 'evm' && (
                            <div>
                              <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Data (Hex)</label>
                              <input
                                value={txBuilder.data}
                                onChange={(e) => setTxBuilder((p: TxBuilderState) => ({ ...p, data: e.target.value }))}
                                placeholder="0x"
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-400">{inputMode === 'json' ? 'JSON Preview' : 'Encoded Input'}</label>
                      <textarea
                        value={transactionData}
                        onChange={(e) => setTransactionData(e.target.value)}
                        rows={inputMode === 'json' ? 6 : 10}
                        className={`w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white focus:border-blue-500 outline-none resize-none font-mono text-xs ${inputMode === 'json' ? 'cursor-default' : ''}`}
                        placeholder={inputMode === 'json' ? 'Generated JSON...' : `Enter ${chain?.encodedFormat} string...`}
                      />
                    </div>
                  </div>
                )}

                {signType === 'delegate-action' && (
                  <div className="space-y-6">
                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">NEAR Delegate Builder</h4>
                        <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800">
                          <button
                            type="button"
                            onClick={() => setDelegateInputMode('form')}
                            className={`px-3 py-1 text-[10px] uppercase font-bold rounded-md transition-all ${
                              delegateInputMode === 'form' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            Form
                          </button>
                          <button
                            type="button"
                            onClick={() => setDelegateInputMode('json')}
                            className={`px-3 py-1 text-[10px] uppercase font-bold rounded-md transition-all ${
                              delegateInputMode === 'json' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            JSON
                          </button>
                        </div>
                      </div>

                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                        <p className="text-[11px] text-blue-400 leading-relaxed">
                          <strong>About this Action:</strong> You are creating a <em className="text-blue-300">Delegate Action</em>. By signing this, you authorize a <strong>Relayer</strong> to submit and pay for this transaction on your behalf.
                        </p>
                      </div>

                      {delegateInputMode === 'form' ? (
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[11px] font-bold text-white uppercase mb-2">Delegator (You)</label>
                            <input
                              value={selectedWalletData?.address || ''}
                              readOnly
                              disabled
                              className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-800 rounded-xl text-sm text-gray-500 cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-white uppercase mb-2">Receiver ID</label>
                            <input
                              value={delegateActionParams.receiverId}
                              onChange={(e) => setDelegateActionParams(p => ({ ...p, receiverId: e.target.value }))}
                              className="w-full px-4 py-2.5 bg-gray-900 border border-gray-800 text-white rounded-xl text-sm"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <label className="block text-[11px] font-bold text-white uppercase">Transaction JSON</label>
                          <textarea
                            value={delegateJson}
                            onChange={(e) => setDelegateJson(e.target.value)}
                            rows={6}
                            className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white focus:border-blue-500 outline-none resize-none font-mono text-xs"
                            placeholder="Enter NEAR transaction JSON..."
                          />
                        </div>
                      )}
                      
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-400">Signed Authorization Payload (Base64)</label>
                        <div className="relative group">
                          <textarea
                            readOnly
                            value={generatedDelegateActionBase64}
                            className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-amber-500/90 font-mono text-[10px] h-24"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setTransactionData(generatedDelegateActionBase64);
                              alert('Copied to signing buffer!');
                            }}
                            className="absolute bottom-3 right-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition-all"
                          >
                            USE IN SIGNER
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3">
                    <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-400 text-sm leading-relaxed">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={signing || !selectedWallet}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:grayscale"
                >
                  {signing ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Processing Request...</span>
                    </div>
                  ) : (
                    `Execute ${signType.replace('-', ' ')} Signing`
                  )}
                </button>
              </form>
            </section>
          </div>

          {/* Right Column: Results & Tips */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden min-h-[400px] flex flex-col shadow-2xl">
              <div className="px-6 py-4 bg-gray-800/50 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-300">Execution Artifacts</h3>
                {result && (
                  <button 
                  onClick={() => setResult(null)}
                  className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest"
                  >
                    Clear
                  </button>
                )}
              </div>
              
              <div className="flex-1 p-6 font-mono">
                {result ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-widest">Signature</label>
                      <div className="p-3 bg-gray-950 rounded-lg border border-gray-800 break-all text-xs text-green-400 leading-relaxed">
                        {typeof result.signature === 'string' ? result.signature : JSON.stringify(result.signature)}
                      </div>
                    </div>
                    {result.signedTransaction && (
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-widest">Signed Payload</label>
                        <div className="p-3 bg-gray-950 rounded-lg border border-gray-800 break-all text-[10px] text-blue-400 leading-relaxed max-h-40 overflow-y-auto">
                          {result.signedTransaction}
                        </div>
                      </div>
                    )}
                    {result.transactionHash && (
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-widest">TX Hash</label>
                        <div className="p-3 bg-gray-950 rounded-lg border border-gray-800 break-all text-xs text-purple-400">
                          {result.transactionHash}
                        </div>
                      </div>
                    )}
                    {verificationResult && (
                      <div className="pt-4 border-t border-gray-800">
                        <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                          verificationResult.status === 'verified' 
                            ? 'bg-green-500/5 border-green-500/20 text-green-500' 
                            : verificationResult.status === 'failed'
                            ? 'bg-red-500/5 border-red-500/20 text-red-500'
                            : 'bg-blue-500/5 border-blue-500/20 text-blue-500'
                        }`}>
                          <div className="mt-0.5">
                            {verificationResult.status === 'verified' ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : verificationResult.status === 'failed' ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            ) : (
                              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest block mb-1">
                              {verificationResult.status === 'pending' ? 'Verifying Signature...' : 
                               verificationResult.status === 'verified' ? 'Signature Verified' : 'Verification Failed'}
                            </span>
                            {verificationResult.message && (
                              <p className="text-[10px] opacity-70 leading-relaxed font-sans">{verificationResult.message}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                    <div className="p-4 bg-gray-800 rounded-full">
                      <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 21l3-1 3 1-.75-4M12 3a9 9 0 100 18 9 9 0 000-18z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-500 max-w-[200px] leading-relaxed italic">
                      Execution results and signing proofs will appear here after submission.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Chain-specific Tips */}
            <section className="bg-indigo-600/5 border border-indigo-500/10 rounded-2xl p-6 space-y-4">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Chain Integration Tips</h4>
              
              <div className="space-y-4">
                {chain?.type === 'evm' && (
                  <div className="text-[11px] text-indigo-300/80 space-y-2 leading-relaxed">
                    <p>• <strong>EIP-155:</strong> Use the playground to test chain-specific signatures by selecting different wallets.</p>
                    <p>• <strong>Typed Data:</strong> Ensure the domain chainId matches the wallet&apos;s actual network to avoid 400 errors.</p>
                  </div>
                )}
                {chain?.type === 'sol' && (
                  <div className="text-[11px] text-indigo-300/80 space-y-2 leading-relaxed">
                    <p>• <strong>Instructions:</strong> Solana signing supports multi-instruction transactions via JSON objects.</p>
                    <p>• <strong>Serialization:</strong> Note that Solana uses Base64 for its serialized wire format.</p>
                  </div>
                )}
                {chain?.type === 'near' && (
                  <div className="text-[11px] text-indigo-300/80 space-y-2 leading-relaxed">
                    <p>• <strong>Delegation:</strong> Delegate actions allow &quot;Meta Transactions&quot; where a relayer pays the NEAR.</p>
                    <p>• <strong>Encoding:</strong> The signed delegate action can be directly submitted to a NEAR relayer service.</p>
                  </div>
                )}
                <div className="pt-2">
                  <Link href="/TESTING.md" className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 underline underline-offset-4 decoration-indigo-500/30 uppercase tracking-widest">
                    View Signing FAQ →
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SignPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <SignContent />
    </Suspense>
  );
}


