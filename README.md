# SimpleVoucher

A simple on-chain voucher system with anonymous messaging. Issue vouchers under topics, share them with recipients, and let them redeem or post messages anonymously.

## Features

- **Issue Vouchers**: Create vouchers under a topic. Only hashes are stored on-chain.
- **Redeem Vouchers**: Recipients submit the raw voucher to claim it.
- **Anonymous Posting**: Voucher holders can post messages to a bulletin board without revealing their identity (via ERC-4337).

## How It Works

1. **Issue**: Create vouchers under a topic (e.g., "event-2024"). Share redeem or post links with recipients.
2. **Redeem**: Recipients visit the link and redeem their voucher on-chain.
3. **Post Message**: Recipients can use their voucher to post an anonymous message. The message is stored as an on-chain event, and the poster's identity remains hidden.

## Contracts

| Contract | Description |
|----------|-------------|
| `SimpleVoucher` | Core voucher system - issue and redeem vouchers |
| `VoucherBoard` | Anonymous bulletin board - post messages using vouchers via ERC-4337 |

## Deploy Contracts

1. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your PRIVATE_KEY and RPC_URL
   ```

2. Deploy SimpleVoucher:
   ```bash
   forge script script/DeploySimpleVoucher.s.sol --rpc-url $RPC_URL --broadcast
   ```

3. Deploy VoucherBoard (requires SimpleVoucher address):
   ```bash
   # Add SIMPLE_VOUCHER_ADDRESS to .env first
   forge script script/DeployVoucherBoard.s.sol --rpc-url $RPC_URL --broadcast
   ```

## Frontend Setup

See [frontend/README.md](frontend/README.md) for detailed setup instructions.

Quick start:
```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with contract addresses and chain config
npm run dev
```

## Development

```bash
# Install dependencies
forge install

# Build contracts
forge build

# Run tests
forge test
```

## License

MIT
