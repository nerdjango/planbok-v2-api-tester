# CryptoVault - Multi-Chain Wallet Demo

A full-stack demo application showcasing the **Planbok MPC System V2 API** for multi-chain wallet management across 6 blockchain types.

## Features

- 🔐 **Multi-Chain Wallet Creation** - Create wallets for EVM, BTC, SOL, Cosmos, NEAR, and Polkadot
- 💸 **Asset Transfers** - Send native tokens with fee estimation
- ✍️ **Message Signing** - Sign messages and EIP-712 typed data
- 🏦 **Organization & Customer Modes** - Both custody types supported
- 🎨 **Modern Dark UI** - Built with Next.js 14 and Tailwind CSS

## Supported Testnets

| Chain    | Network                  | Symbol    |
| -------- | ------------------------ | --------- |
| EVM      | Sepolia                  | ETH       |
| Bitcoin  | Testnet                  | BTC       |
| Solana   | Testnet                  | SOL       |
| Cosmos   | Mainnet (Disabled)       | ATOM      |
| NEAR     | Testnet                  | NEAR      |
| Polkadot | Paseo Testnet (Disabled) | DOT-PASEO |

## Quick Start

### 1. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your Planbok API key
```

### 2. Install Dependencies

```bash
npm run install:all
```

### 3. Start Development Servers

```bash
npm run dev
```

This starts:

- Backend on http://localhost:4000
- Frontend on http://localhost:3000

## Project Structure

```
planbok-v2-api-tester/
├── backend/                 # Express.js API server
│   └── src/
│       ├── routes/          # API routes (auth, wallets, transactions, etc.)
│       ├── services/        # Business logic (Planbok client, encryption)
│       └── middleware/      # Auth middleware
├── frontend/                # Next.js 14 application
│   └── src/
│       ├── app/             # App router pages
│       ├── components/      # React components
│       └── lib/             # API client, chain config
└── scripts/                 # Helper scripts
```

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Create account with wallet set
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Wallets

- `GET /api/wallets` - List wallets
- `POST /api/wallets` - Create wallets for selected blockchains
- `GET /api/wallets/:id/balances` - Get wallet balances

### Transactions

- `POST /api/transactions/estimate-fee` - Estimate transfer fee
- `POST /api/transactions/transfer` - Execute transfer
- `POST /api/transactions/:id/cancel` - Cancel pending transaction
- `POST /api/transactions/:id/accelerate` - Accelerate pending transaction

### Signing

- `POST /api/sign/message` - Sign a message
- `POST /api/sign/typed-data` - Sign EIP-712 typed data

### Customers (Self-Custody)

- `POST /api/customers` - Create customer
- `POST /api/customers/:id/initialize` - Initialize PIN setup
- `POST /api/customers/:id/transactions/transfer` - Create transfer challenge

## Environment Variables

| Variable          | Description                               |
| ----------------- | ----------------------------------------- |
| `PLANBOK_API_URL` | Planbok API URL (default: api.planbok.io) |
| `PLANBOK_API_KEY` | Your Planbok API key                      |
| `PORT`            | Backend port (default: 4000)              |
| `SESSION_SECRET`  | Session encryption secret                 |

## License

MIT
