use aiken/collection/dict.{size}
use aiken/collection/pairs.{get_first}
use cardano/address.{Address, Script}
use cardano/assets.{
  Value, add, flatten, merge, quantity_of, to_dict, without_lovelace, zero,
}
use cardano/transaction.{Input, Spend, Transaction}
use constant.{receipt_tag}
use datum.{find_datum}
use multiplier.{loop_throught_assets}
use types.{
  AssetDatum, CollectVaultToken, ContributionSpendRedeemer, ExtractAda,
  ExtractAsset, VaultParams,
}

pub fn mint_total(
  inputs: List<Input>,
  script_hash: ByteArray,
  vault: VaultParams,
  self: Transaction,
  accumulator: Value,
) -> Value {
  when inputs is {
    [] -> accumulator
    [input, ..rest] -> {
      let on_good_address =
        compare_address_script_hash(input.output.address, script_hash)
      let to_mint_on_that_utxo =
        when on_good_address is {
          True -> {
            let redeemer =
              self.redeemers |> get_first(Spend(input.output_reference))
            expect Some(redeemer) = redeemer
            expect redeemer: ContributionSpendRedeemer = redeemer
            let datum = find_datum(input.output, self)
            expect Some(datum) = datum
            expect AssetDatum { policy_id, asset_name, .. } = datum
            let receipt =
              input.output.value |> quantity_of(policy_id, receipt_tag)
            let lovelace = input.output.value |> quantity_of("", "")

            //Check for the amount to mint to the user base on the multipliers, must contains the receipt and the receipt has to be burn
            let from_multiplier =
              when redeemer is {
                ExtractAda { .. } |
                ExtractAsset { .. } |
                CollectVaultToken { .. } ->
                  if receipt == 1 {
                    let amount_of_policies =
                      input.output.value |> to_dict |> size
                    if amount_of_policies == 2 {
                      loop_throught_assets(
                        vault.acquire_multiplier,
                        flatten(input.output.value),
                        // Flatten the value to get the list of assets
                        0,
                      )
                    } else {
                      loop_throught_assets(
                        vault.acquire_multiplier,
                        flatten(input.output.value |> without_lovelace),
                        // Flatten the value to get the list of assets
                        0,
                      )
                    }
                  } else {
                    0
                  }
                _ -> 0
              }

            //Allow the vault manager to mint the ada pair to create the liquidity pool
            let from_minting_pair =
              when redeemer is {
                ExtractAda { .. } ->
                  when vault.ada_pair_multipler is {
                    Some(pair) -> pair * lovelace
                    None -> 0
                  }
                _ -> 0
              }
            zero
              |> add(policy_id, asset_name, from_multiplier + from_minting_pair)
              //Regardless the action, you have to burn the receipt
              //If it was an extractAda|Asset you would have distribute the vault token
              //If it was a collect vault, you have to burn it to mint the vault token
              //If it's a cancellation, you have to burn it to cancel it
              //The receipt is there to validate that the user was paid (vault token)
              |> add(policy_id, receipt_tag, -receipt)
          }
          False -> zero
        }
      mint_total(
        rest,
        script_hash,
        vault,
        self,
        merge(accumulator, to_mint_on_that_utxo),
      )
    }
  }
}

pub fn compare_address_script_hash(
  address: Address,
  script_hash: ByteArray,
) -> Bool {
  when address.payment_credential is {
    Script(hash) -> hash == script_hash
    _ -> False
  }
}
