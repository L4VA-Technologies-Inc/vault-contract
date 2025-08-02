use admin.{is_admin, is_signed_by}
use aiken/collection/list.{at, concat, filter, is_empty}
use cardano/address.{Script}
use cardano/assets.{
  PolicyId, add, flatten, from_asset_list, quantity_of, restricted_to,
  without_lovelace, zero,
}
use cardano/transaction.{OutputReference, Transaction, find_input}
use constant.{receipt_tag}
use datum.{find_datum}
use inputs.{mint_total}
use interval.{is_after_window, is_within_window}
use outputs.{
  change_match_the_input, owner_is_refunded_with_correct_datum,
  vt_on_output_with_correct_datum_and_owner,
}
use types.{
  Asset, AssetDatum, BurnLp, CancelAda, CancelAsset, CancelContribution,
  CollectVaultToken, Contribute, ContributionMintRedeemer,
  ContributionSpendRedeemer, ExtractAda, ExtractAsset, Lovelace, MintVaultToken,
}
use vault_parameters.{
  find_vault_parameters, is_vault_cancelled, is_vault_completed,
}
use whitelist.{asset_are_whitelisted, contributor_whitelisted}

validator contribute(vault_policy: PolicyId, vault_id: ByteArray) {
  //A vault is represented by a token minted with the policy and a unique identifier
  mint(
    redeemer: ContributionMintRedeemer,
    policy_id: PolicyId,
    self: Transaction,
  ) {
    //Make sure a vault is passed in reference inputs and get the latest parameters 
    let vault =
      find_vault_parameters(vault_policy, vault_id, self.reference_inputs, self)
    expect Some(vault) = vault

    //Check either the admin of the vault signed or no
    let admin_signed = is_admin(self, vault.minting_key)

    //Vault status to validate phase 
    let vault_completed = is_vault_completed(vault)
    when redeemer is {
      Contribute { output_index, contribution } -> {
        //Find the output with the contribution
        expect Some(output) = self.outputs |> at(output_index)
        //Confirm that the output address is a contract address from itself
        expect Script(script_hash) = output.address.payment_credential
        let contribution_is_on_contract = script_hash == policy_id

        let is_contribution_respect_settings =
          when contribution is {
            Lovelace -> {
              //Check that the output amount is lovelace 
              let contains_only_ada =
                without_lovelace(output.value) == (
                  zero
                    |> add(policy_id, receipt_tag, 1)
                )
              //check acquire is in the range vault.acquire_window
              let acquire_window =
                is_within_window(vault.acquire_window, self.validity_range)
              and {
                acquire_window?,
                contains_only_ada?,
              }
            }
            Asset -> {
              //check asset is whitelist vault.asset_whitelist
              let assets_are_valid =
                asset_are_whitelisted(
                  output.value,
                  concat(vault.asset_whitelist, [policy_id]),
                )
              // check asset contribution is in the range vault.asset_window
              let asset_window =
                is_within_window(vault.asset_window, self.validity_range)

              and {
                assets_are_valid?,
                asset_window?,
              }
            }
          }

        //Check that the contributor is whitelist if set vault.contributor_whitelist
        let is_contributor_whitelist =
          when vault.contributor_whitelist is {
            Some(contributor_whitelist) ->
              contributor_whitelisted(
                self.extra_signatories,
                contributor_whitelist,
              )
            None -> True
          }

        //Confirm that what is minted is what is expected
        let minted_amount =
          self.mint |> without_lovelace |> restricted_to([policy_id])

        let should_be_minted =
          from_asset_list([Pair(policy_id, [Pair(receipt_tag, 1)])])

        let mint_match_the_desired_mint = minted_amount == should_be_minted
        //Newly LPs locked on the contract as well
        let locked_value =
          output.value |> without_lovelace |> restricted_to([policy_id])

        let output_value_match_the_minted_amount = locked_value == minted_amount

        //Confirm that the output datum match what was claimed
        expect Some(output_datum) = find_datum(output, self)
        expect output_datum: AssetDatum = output_datum
        let is_datum_correct =
          output_datum.policy_id == policy_id && output_datum.asset_name == vault_id
        and {
          admin_signed?,
          contribution_is_on_contract?,
          is_contribution_respect_settings?,
          is_contributor_whitelist?,
          mint_match_the_desired_mint?,
          is_datum_correct?,
          output_value_match_the_minted_amount?,
          !vault_completed?,
        }
      }
      MintVaultToken | CancelContribution -> {
        let amount_to_mint =
          mint_total(self.inputs, policy_id, vault, self, zero)
        trace amount_to_mint
        let good_burn_amount = self.mint == amount_to_mint
        good_burn_amount?
      }

      BurnLp -> {
        let contains_only_burn =
          self.mint
            |> restricted_to([policy_id])
            |> flatten
            |> filter(fn((_p, _a, v)) { v > 0 })
            |> is_empty
        //Temporary only admin can burn LPs in the future might wanna add more options there
        and {
          contains_only_burn?,
          admin_signed?,
        }
      }
    }
  }

  spend(
    datum: Option<AssetDatum>,
    redeemer: ContributionSpendRedeemer,
    own_ref: OutputReference,
    self: Transaction,
  ) {
    expect Some(datum) = datum
    let vault =
      find_vault_parameters(vault_policy, vault_id, self.reference_inputs, self)
    expect Some(vault) = vault
    let admin_signed = is_admin(self, vault.minting_key)
    //find the input
    let input = find_input(self.inputs, own_ref)
    expect Some(input) = input
    when redeemer is {
      ExtractAda { vault_token_output_index } -> {
        //Can only extract ada after acquire_window 
        let acquire_window_is_done =
          is_after_window(vault.acquire_window, self.validity_range)
        //Check if contains only ada (that means the owner already collect the LP)
        let no_ada_value = without_lovelace(input.output.value)
        let contains_only_ada = no_ada_value == zero
        if contains_only_ada {
          //Lps were collected
          and {
            admin_signed?,
            acquire_window_is_done?,
          }
        } else {
          expect Some(vault_token_output_index) = vault_token_output_index
          expect Some(output) = self.outputs |> at(vault_token_output_index)
          let lp_are_paid =
            vt_on_output_with_correct_datum_and_owner(
              self,
              output,
              input.output.value,
              datum,
              own_ref,
              vault.acquire_multiplier,
            )

          and {
            admin_signed?,
            lp_are_paid?,
            acquire_window_is_done?,
          }
        }
      }
      ExtractAsset { vault_token_output_index } -> {
        //Can only extract nft after asset_window 
        let asset_window_is_done =
          is_after_window(vault.asset_window, self.validity_range)
        //Check if contains only ada (that means the owner already collect the LP)
        let lps_on_input =
          input.output.value |> restricted_to([datum.policy_id])
        let contains_lp = lps_on_input != zero
        if !contains_lp {
          //Lps were collected
          and {
            admin_signed?,
            asset_window_is_done?,
          }
        } else {
          expect Some(vault_token_output_index) = vault_token_output_index
          //Find the output with the LP
          expect Some(output) = self.outputs |> at(vault_token_output_index)
          let lp_are_paid =
            vt_on_output_with_correct_datum_and_owner(
              self,
              output,
              input.output.value,
              datum,
              own_ref,
              vault.acquire_multiplier,
            )

          and {
            admin_signed?,
            lp_are_paid?,
            asset_window_is_done?,
          }
        }
      }
      CollectVaultToken { vault_token_output_index, change_output_index } -> {
        //Take only the LPs from the input
        expect Some(output) = self.outputs |> at(vault_token_output_index)
        expect Some(change_output) = self.outputs |> at(change_output_index)
        let lp_are_paid =
          vt_on_output_with_correct_datum_and_owner(
            self,
            output,
            input.output.value,
            datum,
            own_ref,
            vault.acquire_multiplier,
          )

        //Check that the change is sent back to the output with the same datum
        let change_is_sent =
          change_match_the_input(self, change_output, input, datum, own_ref)

        and {
          lp_are_paid?,
          change_is_sent?,
        }
      }

      //Possible cases
      //VTs where minted, in that case, the VT on the utxo is 0, so you just need claim them (weird situation where admin cancel after set it to completed)
      //VTs are not minted, in that case, we need to burn 1 per utxo
      //Cancel contributed ADA
      //Cancel contributed assets
      CancelAsset { cancel_output_index } |
      CancelAda { cancel_output_index } -> {
        let vault_cancelled = is_vault_cancelled(vault)
        //1. Receipt is burn, only have to check that the receit mint value is negative since we check the quantity in the mint
        let receipt_is_burnt =
          ( self.mint |> quantity_of(datum.policy_id, receipt_tag) ) < 0
        //2. Contribution phase is on, can be cancel if signed by the user
        if !vault_cancelled {
          let is_within_the_window =
            when redeemer is {
              CancelAda { .. } ->
                is_within_window(vault.acquire_window, self.validity_range)
              CancelAsset { .. } ->
                is_within_window(vault.asset_window, self.validity_range)
              _ -> False
            }
          let is_signed = is_signed_by(self, datum.owner)
          and {
            is_within_the_window?,
            is_signed?,
            receipt_is_burnt?,
          }
        } else {
          //3. Vault status is cancelled, anyone can cancel if sent to the owner
          expect Some(cancel_output_index) = cancel_output_index
          expect Some(output) = self.outputs |> at(cancel_output_index)
          let owner_is_refunded =
            owner_is_refunded_with_correct_datum(
              self,
              output,
              input,
              datum,
              own_ref,
            )
          and {
            owner_is_refunded?,
            receipt_is_burnt?,
          }
        }
      }
    }
  }

  else(_) {
    fail
  }
}
//CPU MAX  10000000000
//CPU REAL 60856716
//MEM MAX  14000000 
//MEM REAL 160967
