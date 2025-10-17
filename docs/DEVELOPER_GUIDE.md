# Cardano DeFi Vault System - Developer Implementation Guide

## Overview

This guide walks through implementing a complete vault lifecycle from creation to user claims. The system uses Aiken smart contracts with TypeScript integration scripts.

## Architecture Components

### Smart Contracts (Aiken)
- **`vault.ak`** - Main vault creation/management validator
- **`contribute.ak`** - Contribution system validator (ADA/NFT contributions, LP minting)
- **`dispatch.ak`** - Payment dispatch system for claims

### Key Identifiers
- **Policy ID**: `2de3551bbd703dd03d57bb4d16027a73b0501977dc830885523bb1e6`
- **Contribution Script Hash**: `9a9b0bc93c26a40952aaff525ac72a992a77ebfa29012c9cb4a72eb2`

### Vault States
- `0` = pending
- `1` = open  
- `2` = successful/complete
- `3` = cancelled

---

## Step 1: Create Vault with Parameters

### Script: `create_vault.ts`

**Vault parameters are hardcoded in the script:**
```typescript
// In create_vault.ts - modify these values directly
const one_day = 24 * 60 * 60 * 1000;

// Vault creation datum
vault_status: 1,              // 0: pending, 1: open, 2: successful, 3: cancelled
contract_type: 0,             // 0: PRIVATE, 1: PUBLIC, 2: SEMI_PRIVATE
asset_whitelist: POLICIES_ALLOWED_IN_THE_VAULT,
asset_window: {
  lower_bound: {
    bound_type: new Date().getTime(),
    is_inclusive: true,
  },
  upper_bound: {
    bound_type: new Date().getTime() + one_day * 7,  // 7 days from now
    is_inclusive: true,
  },
},
acquire_window: {
  lower_bound: {
    bound_type: new Date().getTime(),
    is_inclusive: true,
  },
  upper_bound: {
    bound_type: new Date().getTime() + one_day * 7,  // 7 days from now
    is_inclusive: true,
  },
},
valuation_type: 1,            // 0: 'FIXED', 1: 'LBE'
admin: ADMIN_KEY_HASH,
minting_key: ADMIN_KEY_HASH
```

**Asset Whitelist:**
```typescript
const POLICIES_ALLOWED_IN_THE_VAULT = [
  "b28533ab183e0146552d8d97a6111e7ec56afa389d76357cf2b3feff",
  "c82a4452eaebccb82aced501b3c94d3662cf6cd2915ad7148b459aec"
];
```

**Run:**
```bash
tsx create_vault.ts
```

---

## Step 2: Accept Contributions (ADA/NFTs)

### ADA Contributions: `contribute_ada.ts`
- Contributors receive receipt tokens
- Contribution amounts stored in datum
- Only during asset_window period

### NFT Contributions: `contribute_nft.ts`
- Asset validation against whitelist
- Receipt tokens issued
- NFTs locked in contribution script

**Run:**
```bash
tsx contribute_ada.ts
tsx contribute_nft.ts
```

---

## Step 3: Compute Vault Value (Manual Process)

**Calculate exchange rates based on:**
- Total ADA contributions
- Total NFT contributions  
- Desired VT token supply
- Valuation method (FIXED vs LBE)

---

## Step 4: Close Vault (Not "Update")

### Script: `update_vault.ts`

**This doesn't "update" parameters - it closes the vault and sets final values:**
```typescript
// Sets vault status to successful (2) and locks in final exchange rates
vault_status: 2,              // Close the vault
// Final VT exchange rates are set here
```

**Process:**
1. **Admin signature required**
2. **Status change** - From `1` (open) to `2` (successful)  
3. **Lock final values** - Set VT exchange rates permanently

**Run:**
```bash
tsx update_vault.ts
```

---

## Step 5: Extract ADA to Dispatch Contract

### Script: `extract_lovelace.ts`

**Purpose:**
- Move ADA from contributions to dispatch script
- Ensure sufficient funds for all NFT contribution claims

**Run:**
```bash
tsx extract_lovelace.ts
```

---

## Step 6: User Claims VTs and Receives ADA

### Claim Scripts: `collect_vt.ts` + `pay_ada_contribution.ts`

**Two-part process:**
1. **Collect VT tokens** - Burn receipts, mint VTs, return NFTs
2. **Receive ADA payment** - From dispatch script

**Run:**
```bash
tsx collect_vt.ts
tsx pay_ada_contribution.ts
```

---

## Key Configuration Files

### `vault-parameters.json` (Operational Parameters)
```json
{
  "vault_id": "generated_vault_id",
  "contribution_parametized_hash": "script_hash",
  "dispatch_script_hash": "dispatch_hash", 
  "last_update_tx_hash": "tx_hash",
  "last_update_tx_index": 0,
  "dispatch_utxo_tx_hash": "utxo_hash",
  "dispatch_utxo_index": 0
}
```

### `script-hashes.json`
```json
{
  "vault_policy_id": "2de3551bbd703dd03d57bb4d16027a73b0501977dc830885523bb1e6",
  "dispatch_script_hash": "dispatch_hash",
  "contribution_script_hash": "9a9b0bc93c26a40952aaff525ac72a992a77ebfa29012c9cb4a72eb2"
}
```

---

## Complete Implementation Flow

### 1. Setup Phase
```bash
# Modify parameters directly in create_vault.ts, then run:
tsx create_vault.ts
```

### 2. Contribution Phase  
```bash
# Users contribute during asset_window
tsx contribute_ada.ts
tsx contribute_nft.ts
```

### 3. Valuation Phase
```bash
# Admin calculates values manually, then closes vault:
tsx update_vault.ts  # Sets status to 2 (successful)
```

### 4. Distribution Phase
```bash
# Admin extracts ADA to dispatch
tsx extract_lovelace.ts
```

### 5. Claim Phase
```bash
# Users claim their VTs and receive ADA
tsx collect_vt.ts
tsx pay_ada_contribution.ts
```

---

## Key Corrections

1. **No parameter updates** - Vault parameters are set at creation and cannot be changed
2. **Hardcoded configuration** - Time windows and asset whitelist are in `create_vault.ts`
3. **Vault closure** - `update_vault.ts` closes the vault (status 1→2), doesn't update parameters
4. **Operational parameters** - `vault-parameters.json` contains tx hashes and script hashes, not vault config

--- 
