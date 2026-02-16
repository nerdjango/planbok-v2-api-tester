#!/bin/bash
# Deploy PSP22 Token on Polkadot Paseo (ink! smart contract)
# Requires: cargo-contract, rustup with wasm target
#
# Usage: ./deploy-psp22.sh

set -e

echo "🚀 Deploying PSP22 Token on Paseo..."

# Check for cargo-contract
if ! command -v cargo-contract &> /dev/null; then
    echo "❌ cargo-contract not found."
    echo ""
    echo "Install with:"
    echo "  cargo install cargo-contract --force"
    echo ""
    echo "Also ensure you have:"
    echo "  rustup target add wasm32-unknown-unknown"
    echo ""
    exit 1
fi

# Configuration
WS_URL="wss://paseo-rpc.dwellir.com"
SURI="${SURI:-//Alice}"  # Use //Alice for testing or set SURI env var

# Create PSP22 contract from template
CONTRACT_DIR="./psp22-token"
if [ ! -d "$CONTRACT_DIR" ]; then
    echo "📦 Creating PSP22 contract from template..."
    cargo contract new psp22-token
    
    # Add OpenBrush for PSP22 implementation
    cd $CONTRACT_DIR
    cat >> Cargo.toml << 'EOF'

[dependencies]
openbrush = { version = "4.0.0", default-features = false, features = ["psp22"] }

[features]
default = ["std"]
std = ["openbrush/std"]
EOF
    
    # Create minimal PSP22 implementation
    cat > lib.rs << 'EOF'
#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[openbrush::implementation(PSP22)]
#[openbrush::contract]
pub mod psp22_token {
    use openbrush::traits::Storage;

    #[ink(storage)]
    #[derive(Default, Storage)]
    pub struct Psp22Token {
        #[storage_field]
        psp22: psp22::Data,
    }

    impl Psp22Token {
        #[ink(constructor)]
        pub fn new(total_supply: Balance) -> Self {
            let mut instance = Self::default();
            psp22::Internal::_mint_to(&mut instance, Self::env().caller(), total_supply).expect("Should mint");
            instance
        }
    }
}
EOF
    cd ..
fi

# Build contract
echo "🔨 Building contract..."
cd $CONTRACT_DIR
cargo contract build --release
cd ..

# Find built contract
WASM_FILE=$(find $CONTRACT_DIR/target/ink -name "*.wasm" | head -1)
METADATA_FILE=$(find $CONTRACT_DIR/target/ink -name "*.json" | head -1)

if [ -z "$WASM_FILE" ]; then
    echo "❌ Build failed - no .wasm file found"
    exit 1
fi

echo "✅ Contract built: $WASM_FILE"

# Deploy contract
echo "📤 Deploying to Paseo..."
INSTANTIATE_OUTPUT=$(cargo contract instantiate \
    --suri "$SURI" \
    --url "$WS_URL" \
    --constructor new \
    --args 1000000000000 \
    $WASM_FILE 2>&1)

CONTRACT_ADDR=$(echo "$INSTANTIATE_OUTPUT" | grep "Contract" | awk '{print $2}')

echo ""
echo "════════════════════════════════════════════"
echo "✅ PSP22 Token Deployed Successfully!"
echo "════════════════════════════════════════════"
echo ""
echo "Contract Address: $CONTRACT_ADDR"
echo "Name: PSP22 Token"
echo "Decimals: 10 (default)"
echo "Initial Supply: 1,000,000"
echo ""
echo "Add to CryptoVault with:"
echo "  blockchain: DOT-PASEO"
echo "  standard: psp22"
echo "  address: $CONTRACT_ADDR"
echo ""
