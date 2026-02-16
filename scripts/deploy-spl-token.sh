#!/bin/bash
# Deploy SPL Token on Solana Testnet
# Requires: Solana CLI, solana-keygen
#
# Usage: ./deploy-spl-token.sh

set -e

echo "🚀 Deploying SPL Token on Solana Testnet..."

# Check for Solana CLI
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI not found. Install from https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
fi

# Set to testnet
solana config set --url https://api.testnet.solana.com

# Check balance
BALANCE=$(solana balance | grep -oE '[0-9.]+' | head -1)
if [[ -z "$BALANCE" ]] || [[ "$BALANCE" == "0" ]]; then
    # Try one quick airdrop if 0
    echo "💡 Account has 0 SOL. Attempting airdrop..."
    solana airdrop 1 || true
    BALANCE=$(solana balance | grep -oE '[0-9.]+' | head -1)
fi

if [[ -z "$BALANCE" ]] || [[ "$BALANCE" == "0" ]]; then
    echo "⚠️  Low balance ($BALANCE SOL). Request testnet SOL from: https://faucet.solana.com"
    exit 1
fi

# Create token mint
echo "📦 Creating SPL token mint..."
TOKEN_MINT=$(spl-token create-token --decimals 9 2>&1 | grep "Creating token" | awk '{print $3}')

if [ -z "$TOKEN_MINT" ]; then
    echo "❌ Failed to create token"
    exit 1
fi

echo "✅ Token mint created: $TOKEN_MINT"

# Create token account
echo "📦 Creating token account..."
spl-token create-account $TOKEN_MINT

# Mint initial supply (1,000,000 tokens)
echo "💰 Minting 1,000,000 tokens..."
spl-token mint $TOKEN_MINT 1000000

echo ""
echo "════════════════════════════════════════════"
echo "✅ SPL Token Deployed Successfully!"
echo "════════════════════════════════════════════"
echo ""
echo "Token Mint Address: $TOKEN_MINT"
echo "Decimals: 9"
echo "Initial Supply: 1,000,000"
echo ""
echo "Add to CryptoVault with:"
echo "  blockchain: SOL-TESTNET"
echo "  standard: fungible"
echo "  address: $TOKEN_MINT"
echo ""
