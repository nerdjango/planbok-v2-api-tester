#!/bin/bash
# Deploy CW20 Token on Cosmos Testnet (theta-testnet-001)
# Requires: wasmd CLI or cosmwasm-check
#
# Usage: ./deploy-cw20.sh

set -e

echo "🚀 Deploying CW20 Token on Cosmos Testnet..."

# Configuration
CHAIN_ID="theta-testnet-001"
RPC_URL="https://cosmos-testnet-rpc.polkachu.com:443"
DENOM="uatom"
GAS_PRICES="0.025uatom"

# Check for gaiad CLI
if ! command -v gaiad &> /dev/null; then
    echo "❌ gaiad CLI not found."
    echo ""
    echo "Install options:"
    echo "  1. Build from source: https://github.com/cosmos/gaia"
    echo "  2. Use Docker: docker pull ghcr.io/cosmos/gaia"
    echo ""
    exit 1
fi

# Check for key
KEY_NAME="${KEY_NAME:-testkey}"
if ! gaiad keys show $KEY_NAME &> /dev/null; then
    echo "⚠️  Key '$KEY_NAME' not found. Create one with:"
    echo "    gaiad keys add $KEY_NAME"
    exit 1
fi

ADDRESS=$(gaiad keys show $KEY_NAME -a)
echo "📍 Using address: $ADDRESS"

# Check balance
echo "💰 Checking balance..."
BALANCE=$(gaiad query bank balances $ADDRESS --node $RPC_URL --output json 2>/dev/null | jq -r '.balances[] | select(.denom=="uatom") | .amount // "0"')
if [ "$BALANCE" -lt "100000" ]; then
    echo "⚠️  Low balance ($BALANCE $DENOM). Request testnet ATOM from Cosmos Discord"
    exit 1
fi

# Download CW20 base contract if not present
CW20_WASM="./cw20_base.wasm"
if [ ! -f "$CW20_WASM" ]; then
    echo "📦 Downloading CW20 base contract..."
    curl -sL https://github.com/CosmWasm/cw-plus/releases/download/v1.1.0/cw20_base.wasm -o $CW20_WASM
fi

# Store contract
echo "📤 Storing contract on chain..."
STORE_TX=$(gaiad tx wasm store $CW20_WASM \
    --from $KEY_NAME \
    --chain-id $CHAIN_ID \
    --node $RPC_URL \
    --gas-prices $GAS_PRICES \
    --gas auto \
    --gas-adjustment 1.3 \
    -y --output json)

CODE_ID=$(echo $STORE_TX | jq -r '.logs[0].events[] | select(.type=="store_code") | .attributes[] | select(.key=="code_id") | .value')
echo "✅ Code ID: $CODE_ID"

# Instantiate token
echo "🔧 Instantiating CW20 token..."
INIT_MSG='{
  "name": "Test Token",
  "symbol": "TEST",
  "decimals": 6,
  "initial_balances": [{"address": "'$ADDRESS'", "amount": "1000000000000"}],
  "mint": {"minter": "'$ADDRESS'"}
}'

INIT_TX=$(gaiad tx wasm instantiate $CODE_ID "$INIT_MSG" \
    --from $KEY_NAME \
    --chain-id $CHAIN_ID \
    --node $RPC_URL \
    --gas-prices $GAS_PRICES \
    --gas auto \
    --gas-adjustment 1.3 \
    --label "CryptoVault Test Token" \
    --admin $ADDRESS \
    -y --output json)

CONTRACT_ADDR=$(echo $INIT_TX | jq -r '.logs[0].events[] | select(.type=="instantiate") | .attributes[] | select(.key=="_contract_address") | .value')

echo ""
echo "════════════════════════════════════════════"
echo "✅ CW20 Token Deployed Successfully!"
echo "════════════════════════════════════════════"
echo ""
echo "Contract Address: $CONTRACT_ADDR"
echo "Name: Test Token"
echo "Symbol: TEST"
echo "Decimals: 6"
echo "Initial Supply: 1,000,000"
echo ""
echo "Add to CryptoVault with:"
echo "  blockchain: ATOM-TESTNET"
echo "  standard: cw20"
echo "  address: $CONTRACT_ADDR"
echo ""
