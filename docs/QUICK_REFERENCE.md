# Vault System - Quick Reference

## Implementation Sequence

| Step | Script | Purpose | Admin Required |
|------|--------|---------|----------------|
| 1 | `create_vault.ts` | Create vault with parameters | Yes |
| 2 | `contribute_ada.ts` | Users contribute ADA | No |
| 2 | `contribute_nft.ts` | Users contribute NFTs | No |
| 3 | Manual calculation | Compute VT exchange rates | Yes |
| 4 | `update_vault.ts` | Set vault to complete + rates | Yes |
| 5 | `extract_lovelace.ts` | Move ADA to dispatch script | Yes |
| 6 | `collect_vt.ts` | Users claim VT tokens | No |
| 6 | `pay_ada_contribution.ts` | Users receive ADA payment | No |

## Vault States

| Code | Status | Description |
|------|--------|-------------|
| 0 | Pending | Vault created, not yet open |
| 1 | Open | Accepting contributions |
| 2 | Successful | Complete, ready for claims |
| 3 | Cancelled | Vault cancelled |

## Key Configuration

### Required Parameters
```typescript
// Vault Creation
vault_id: string           // Unique identifier
asset_window: number       // Opening timestamp  
acquire_window: number     // Closing timestamp
contract_type: 0|1|2       // PRIVATE|PUBLIC|SEMI_PRIVATE
valuation_type: 0|1        // FIXED|LBE
allowed_assets: string[]   // Whitelisted assets

// Script Hashes
vault_policy_id: "2de3551bbd703dd03d57bb4d16027a73b0501977dc830885523bb1e6"
contribution_script_hash: "9a9b0bc93c26a40952aaff525ac72a992a77ebfa29012c9cb4a72eb2"
```

## Critical Success Factors

### Before Launch
- [ ] Vault parameters configured correctly
- [ ] Time windows set appropriately  
- [ ] Asset whitelist defined
- [ ] Admin keys secured

### During Contributions
- [ ] Monitor contribution volume
- [ ] Validate asset submissions
- [ ] Track receipt token minting

### Before Completion
- [ ] Calculate accurate VT exchange rates
- [ ] Verify total contribution amounts
- [ ] Ensure dispatch script funding

### During Claims
- [ ] Monitor dispatch script balance
- [ ] Verify VT token minting
- [ ] Track successful claims

## Common Pitfalls

1. **Insufficient Dispatch Funding** - Must cover ALL NFT contributions
2. **Time Window Errors** - Contributions outside allowed periods
3. **Missing Admin Signatures** - Required for vault updates
4. **Asset Validation** - Non-whitelisted assets rejected
5. **UTXO Availability** - Need sufficient UTXOs for transactions

## Emergency Procedures

### Vault Cancellation
```bash
# Set vault status to cancelled (3)
tsx update_vault.ts  # Set status: 3
```

### Refund Process
```bash
# Cancel individual contributions
tsx cancel_ada_contribution.ts
tsx cancel_asset_contribution.ts
```

## Monitoring Commands

```bash
# Check vault status
cardano-cli query utxo --address <vault_address>

# Monitor contributions  
cardano-cli query utxo --address <contribution_address>

# Check dispatch balance
cardano-cli query utxo --address <dispatch_address>
```

---

*Keep this reference handy during implementation!*
