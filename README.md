# SimpleVoucher

A simple on-chain voucher system with anonymous messaging and token claims. Issue vouchers under topics, share them with recipients, and let them redeem, post messages anonymously, or claim ERC20 tokens.

## Features

- **Issue Vouchers**: Create basic or binding vouchers under a topic. Only hashes are stored on-chain.
- **Redeem Vouchers**: Recipients submit the raw voucher to claim it.
- **Anonymous Posting**: Voucher holders can post messages to a bulletin board without revealing their identity (via ERC-4337).
- **Claim Tokens**: Binding voucher holders can claim ERC20 tokens to any address. The voucher's private key signs the recipient address to authorize the claim.

## How It Works

1. **Issue**: Create vouchers under a topic (e.g., "event-2024"). Choose a use case (Post Message or Claim Token) and share the generated links with recipients.
2. **Redeem**: Recipients visit the link and redeem their voucher on-chain.
3. **Post Message**: Recipients can use their basic voucher to post an anonymous message. The message is stored as an on-chain event, and the poster's identity remains hidden.
4. **Claim Tokens**: Recipients use a binding voucher's private key to claim ERC20 tokens. The private key signs the recipient address, ensuring only the intended recipient can claim.

## Contracts

| Contract | Description |
|----------|-------------|
| `SimpleVoucher` | Core voucher system - issue and redeem vouchers (basic and binding) |
| `VoucherBoard` | Anonymous bulletin board - post messages using vouchers via ERC-4337 |
| `DemoToken` | Simple ERC20 token with open mint for demo purposes |
| `TokenClaim` | Claim ERC20 tokens using binding vouchers |

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

4. Deploy DemoToken:
   ```bash
   forge script script/DeployDemoToken.s.sol --rpc-url $RPC_URL --broadcast
   ```

5. Deploy TokenClaim (requires SimpleVoucher and DemoToken addresses):
   ```bash
   # Add DEMO_TOKEN_ADDRESS and CLAIM_AMOUNT to .env first
   forge script script/DeployTokenClaim.s.sol --rpc-url $RPC_URL --broadcast
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
