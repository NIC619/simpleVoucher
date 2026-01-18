# SimpleVoucher

A simple on-chain voucher system. Issue vouchers under topics, share them with recipients, and let them redeem on-chain.

## How It Works

1. **Issue**: Create vouchers under a topic (e.g., "event-2024"). Only hashes are stored on-chain.
2. **Share**: Send raw voucher values to recipients via redeem links.
3. **Redeem**: Recipients submit the raw voucher to claim it. The contract verifies by hashing.

## Redeem URLs

- `/{issuer}/{topic}` - Recipient enters voucher manually
- `/{issuer}/{topic}/{voucher}` - One-click redeem with voucher pre-filled

## Development

### Contract

```bash
forge install
forge build
forge test

# Deploy
cp .env.example .env  # Configure PRIVATE_KEY, RPC_URL
forge script script/DeploySimpleVoucher.s.sol --rpc-url $RPC_URL --broadcast
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local  # Configure NEXT_PUBLIC_CONTRACT_ADDRESS
npm run dev
```

## License

MIT
