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
export const SIMPLE_VOUCHER_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}` | undefined;
