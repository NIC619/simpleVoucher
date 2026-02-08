export const SIMPLE_VOUCHER_ABI = [
  {
    type: "function",
    name: "getVoucherStatus",
    inputs: [
      { name: "issuer", type: "address" },
      { name: "topic", type: "string" },
      { name: "voucherHash", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "issueBasicVouchers",
    inputs: [
      { name: "topic", type: "string" },
      { name: "voucherHashes", type: "bytes32[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "redeemBindingVoucher",
    inputs: [
      { name: "issuer", type: "address" },
      { name: "topic", type: "string" },
      { name: "digest", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "redeemVoucher",
    inputs: [
      { name: "issuer", type: "address" },
      { name: "topic", type: "string" },
      { name: "voucher", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "VoucherIssued",
    inputs: [
      { name: "issuer", type: "address", indexed: true },
      { name: "topicHash", type: "bytes32", indexed: true },
      { name: "voucherHash", type: "bytes32", indexed: true },
    ],
  },
  {
    type: "event",
    name: "VoucherRedeemed",
    inputs: [
      { name: "issuer", type: "address", indexed: true },
      { name: "redeemer", type: "address", indexed: true },
      { name: "topicHash", type: "bytes32", indexed: true },
      { name: "voucherHash", type: "bytes32" },
    ],
  },
  {
    type: "event",
    name: "VouchersIssued",
    inputs: [
      { name: "issuer", type: "address", indexed: true },
      { name: "topic", type: "string" },
      { name: "topicHash", type: "bytes32", indexed: true },
    ],
  },
  {
    type: "error",
    name: "EmptyVoucherHashes",
    inputs: [],
  },
  {
    type: "error",
    name: "VoucherAlreadyExists",
    inputs: [{ name: "voucherHash", type: "bytes32" }],
  },
  {
    type: "error",
    name: "VoucherAlreadyRedeemed",
    inputs: [{ name: "voucherHash", type: "bytes32" }],
  },
  {
    type: "error",
    name: "VoucherDoesNotExist",
    inputs: [{ name: "voucherHash", type: "bytes32" }],
  },
] as const;

// Update this with your deployed contract address
export const SIMPLE_VOUCHER_ADDRESS = process.env.NEXT_PUBLIC_SIMPLE_VOUCHER_ADDRESS as `0x${string}` | undefined;

// VoucherBoard ABI (for posting messages)
export const VOUCHER_BOARD_ABI = [
  {
    type: "function",
    name: "postMessage",
    inputs: [
      { name: "issuer", type: "address" },
      { name: "topic", type: "string" },
      { name: "voucher", type: "bytes32" },
      { name: "message", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "simpleVoucher",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "entryPoint",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "pure",
  },
  {
    type: "event",
    name: "MessagePosted",
    inputs: [
      { name: "issuer", type: "address", indexed: true },
      { name: "topic", type: "string", indexed: false },
      { name: "voucherHash", type: "bytes32", indexed: true },
      { name: "message", type: "string", indexed: false },
    ],
  },
] as const;

// VoucherBoard contract address
export const VOUCHER_BOARD_ADDRESS = process.env.NEXT_PUBLIC_VOUCHER_BOARD_ADDRESS as `0x${string}` | undefined;

// TokenClaim ABI (for claiming tokens with binding vouchers)
export const TOKEN_CLAIM_ABI = [
  {
    type: "function",
    name: "claimToken",
    inputs: [
      { name: "issuer", type: "address" },
      { name: "topic", type: "string" },
      { name: "recipient", type: "address" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimAmount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "TokenClaimed",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "topicHash", type: "bytes32", indexed: true },
      { name: "voucherHash", type: "bytes32", indexed: true },
    ],
  },
] as const;

// TokenClaim contract address
export const TOKEN_CLAIM_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_CLAIM_ADDRESS as `0x${string}` | undefined;
