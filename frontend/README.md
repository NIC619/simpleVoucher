# SimpleVoucher Frontend

Web interface for issuing vouchers and posting anonymous messages.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env.local
   ```

3. Edit `.env.local` with your values:
   ```
   # Target chain: mainnet, sepolia, base, base-sepolia
   NEXT_PUBLIC_CHAIN=sepolia

   # SimpleVoucher contract address (deployed proxy address)
   NEXT_PUBLIC_SIMPLE_VOUCHER_ADDRESS=0x...

   # VoucherBoard contract address (for anonymous posting)
   NEXT_PUBLIC_VOUCHER_BOARD_ADDRESS=0x...

   # Pimlico API key for ERC-4337 bundler (required for Post Message)
   NEXT_PUBLIC_PIMLICO_API_KEY=
   ```

4. Run development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CHAIN` | Yes | Target network: `mainnet`, `sepolia`, `base`, `base-sepolia` |
| `NEXT_PUBLIC_SIMPLE_VOUCHER_ADDRESS` | Yes | Deployed SimpleVoucher proxy address |
| `NEXT_PUBLIC_VOUCHER_BOARD_ADDRESS` | For posting | Deployed VoucherBoard proxy address |
| `NEXT_PUBLIC_PIMLICO_API_KEY` | For posting | Get free key at [dashboard.pimlico.io](https://dashboard.pimlico.io) |

## URL Routes

| Route | Description |
|-------|-------------|
| `/` | Main app with Issue, Post Message, and Redeem tabs |
| `/redeem/{issuer}/{topic}/{voucher}` | Direct redeem page with voucher pre-filled |
| `/post/{issuer}/{topic}/{voucher}` | Direct post message page with voucher pre-filled |

## Build for Production

```bash
npm run build
npm start
```
