# Dispatch Validator Implementation Updates

## Required Implementation Updates

### 1. OutputPayoutDatum Integration

**Update Required**: All TypeScript scripts must handle the new `OutputPayoutDatum` structure when interacting with contribution UTXOs.

```typescript
// New datum structure for contribution outputs
interface OutputPayoutDatum {
  datum_tag: Option<any>;
  ada_paid: Option<number>;
}
```

**Scripts to Update**:
- `cancel_ada_contribution.ts`
- `cancel_asset_contribution.ts` 
- `collect_vt.ts`
- `extract_lovelace.ts`
- Any script that reads from contribution UTXOs

### 2. New Dispatch Operations

The dispatch validator now supports three operation types that need TypeScript implementation:

#### A. Split Operations
**Purpose**: Divide one dispatch UTXO into multiple outputs

```typescript
const splitTransaction = {
  changeAddress: ADMIN_ADDRESS,
  message: "Split dispatch UTXO",
  scriptInteractions: [
    {
      purpose: "spend",
      hash: DISPATCH_SCRIPT_HASH,
      outputRef: {
        txHash: DISPATCH_UTXO_TX_HASH,
        index: DISPATCH_UTXO_INDEX,
      },
      redeemer: { type: "json", value: "Void" },
    },
    {
      purpose: "withdraw",
      hash: DISPATCH_SCRIPT_HASH,
      redeemer: { type: "json", value: "Void" },
    },
  ],
  outputs: [
    {
      address: DISPATCH_ADDRESS,
      lovelace: 2000000, // 2 ADA
    },
    {
      address: DISPATCH_ADDRESS,
      lovelace: 3000000, // 3 ADA
    },
  ],
  requiredSigners: [ADMIN_KEY_HASH],
  referenceInputs: [{ txHash: VAULT_TX_HASH, index: VAULT_TX_INDEX }],
  validityInterval: { start: true, end: true },
  network: "preprod",
};
```

#### B. Merge Operations  
**Purpose**: Combine multiple dispatch UTXOs into one

```typescript
const mergeTransaction = {
  changeAddress: ADMIN_ADDRESS,
  message: "Merge dispatch UTXOs",
  scriptInteractions: [
    {
      purpose: "spend",
      hash: DISPATCH_SCRIPT_HASH,
      outputRef: { txHash: DISPATCH_UTXO1_TX_HASH, index: DISPATCH_UTXO1_INDEX },
      redeemer: { type: "json", value: "Void" },
    },
    {
      purpose: "spend",
      hash: DISPATCH_SCRIPT_HASH,
      outputRef: { txHash: DISPATCH_UTXO2_TX_HASH, index: DISPATCH_UTXO2_INDEX },
      redeemer: { type: "json", value: "Void" },
    },
    {
      purpose: "withdraw",
      hash: DISPATCH_SCRIPT_HASH,
      redeemer: { type: "json", value: "Void" },
    },
  ],
  outputs: [
    {
      address: DISPATCH_ADDRESS,
      lovelace: 5000000, // Combined 5 ADA
    },
  ],
  requiredSigners: [ADMIN_KEY_HASH],
  referenceInputs: [{ txHash: VAULT_TX_HASH, index: VAULT_TX_INDEX }],
  validityInterval: { start: true, end: true },
  network: "preprod",
};
```

#### C. Pay Operations
**Purpose**: Pay contributors from dispatch funds

```typescript
const payTransaction = {
  changeAddress: ADMIN_ADDRESS,
  message: "Pay ADA to contributor from dispatch script",
  scriptInteractions: [
    {
      purpose: "spend",
      hash: DISPATCH_SCRIPT_HASH,
      outputRef: {
        txHash: DISPATCH_UTXO_TX_HASH,
        index: DISPATCH_UTXO_INDEX,
      },
      redeemer: { type: "json", value: "Void" },
    },
    {
      purpose: "withdraw",
      hash: DISPATCH_SCRIPT_HASH,
      redeemer: { type: "json", value: "Void" },
    },
    {
      purpose: "spend",
      hash: CONTRIBUTION_SCRIPT_HASH,
      outputRef: {
        txHash: contrib_tx_hash,
        index: contrib_index,
      },
      redeemer: {
        type: "json",
        value: {
          __variant: "ExtractAda",
          __data: { vault_token_output_index: 0 },
        },
      },
    },
  ],
  outputs: [
    {
      address: contributorAddress, // Pay to contributor
      lovelace: 2000000, // Amount from OutputPayoutDatum.ada_paid
    },
    {
      address: DISPATCH_ADDRESS,
      lovelace: 3000000, // Remaining ADA in dispatch
    },
  ],
  requiredSigners: [ADMIN_KEY_HASH],
  referenceInputs: [{ txHash: VAULT_TX_HASH, index: VAULT_TX_INDEX }],
  validityInterval: { start: true, end: true },
  network: "preprod",
};
```

## Implementation Requirements

### 1. Create New TypeScript Scripts

**Required Scripts**:
- `dispatch_split.ts` - Split dispatch UTXOs
- `dispatch_merge.ts` - Merge dispatch UTXOs  
- `dispatch_pay.ts` - Pay contributors from dispatch

### 2. Update Existing Scripts

**Critical Updates Needed**:

#### `extract_lovelace.ts`
- Must read `OutputPayoutDatum.ada_paid` from contribution inputs
- Update balance calculations to account for paid amounts
- Handle new datum structure

#### `cancel_ada_contribution.ts` & `cancel_asset_contribution.ts`
- Update to work with `OutputPayoutDatum` structure
- Ensure proper datum handling when canceling contributions

#### `collect_vt.ts`
- Update to read new datum format from contribution UTXOs
- Handle `ada_paid` field for vault token calculations

### 3. Transaction Building Updates

**Key Changes Required**:

```typescript
// OLD: Simple datum handling
const contributionDatum = contributionUTXO.datum;

// NEW: OutputPayoutDatum structure
const contributionDatum: OutputPayoutDatum = {
  datum_tag: null,
  ada_paid: contributionAmount
};
```

### 4. Withdrawal Pattern Implementation

**All dispatch operations must include withdrawal**:

```typescript
const transaction = {
  // ... inputs and outputs
  withdrawals: [
    {
      rewardAccount: dispatchScriptCredential,
      amount: 0  // Amount doesn't matter, just triggers validation
    }
  ],
  requiredSigners: [adminKeyHash]  // Admin signature required
};
```

## Usage Examples

### Split Funds for Multiple Operations
```typescript
// Split large UTXO for parallel operations
await dispatchSplit({
  inputUTXO: largeDispatchUTXO,
  outputs: [
    { amount: 50_000_000 },  // 50 ADA for operation A
    { amount: 30_000_000 },  // 30 ADA for operation B
    { amount: 20_000_000 }   // 20 ADA for operation C
  ]
});
```

### Merge Small UTXOs
```typescript
// Consolidate fragmented UTXOs
await dispatchMerge({
  inputUTXOs: [smallUTXO1, smallUTXO2, smallUTXO3],
  outputAmount: totalAmount
});
```

### Pay Multiple Contributors
```typescript
// Batch payment to contributors
await dispatchPay({
  dispatchUTXO: fundsUTXO,
  contributionUTXOs: [
    { utxo: contrib1, adaPaid: 10_000_000 },
    { utxo: contrib2, adaPaid: 15_000_000 }
  ]
});
```

## Migration Checklist

- [ ] Update all scripts to handle `OutputPayoutDatum`
- [ ] Implement dispatch split/merge/pay operations
- [ ] Add withdrawal pattern to all dispatch transactions
- [ ] Test with admin signature requirements
- [ ] Update datum creation in contribution scripts
- [ ] Verify balance calculations include `ada_paid` amounts
- **Edge Cases**: Tests boundary conditions and error scenarios
- **Security Testing**: Validates authorization and balance requirements

## Integration Points

### With Contribution Validator
- Reads `OutputPayoutDatum` from contribution inputs
- Processes `ada_paid` amounts for payment calculations
- Maintains consistency with contribution lifecycle

### With Vault Parameters
- Requires vault reference input for admin key access
- Validates operations against vault configuration
- Ensures proper authorization chain

## Benefits

1. **Security**: Comprehensive validation and authorization
2. **Flexibility**: Supports multiple operation types in one validator
3. **Efficiency**: Batch operations reduce transaction costs
4. **Maintainability**: Clean, well-tested codebase
5. **Integration**: Seamless vault system compatibility

---
 