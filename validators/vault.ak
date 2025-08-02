use admin.{is_admin}
use aiken/collection/dict.{filter, is_empty}
use aiken/collection/list.{at}
use cardano/address.{Script}
use cardano/assets.{
  PolicyId, add, flatten, match, quantity_of, restricted_to, tokens,
  without_lovelace, zero,
}
use cardano/transaction.{OutputReference, Transaction, find_input}
use datum.{find_datum}
use own_ref_tag.{validate_tag_in_inputs}
use types.{VaultBurn, VaultMintAndSpend, VaultParams, VaultRedeemer}

validator vault {
  //A vault is represented by a token minted with the policy and a unique identifier
  mint(redeemer: VaultRedeemer, policy_id: PolicyId, self: Transaction) {
    when redeemer is {
      VaultMintAndSpend { vault_token_index, asset_name } -> {
        //First step is to make sure the tag specified in the redeemer is a valid tag
        //To do that, we will loop throught all inputs, generate their tags and check if its the same as the one specified in the redeemer 
        let tag_is_valid = validate_tag_in_inputs(self.inputs, asset_name)

        //Once the assetname is validated, we have to make sure it is the good one in the transaction
        //* important,  you can only mint 1 vault setting per transaction
        let desired_mint = zero |> add(policy_id, asset_name, 1)
        let mint_match_the_desired_mint =
          restricted_to(self.mint, [policy_id]) == desired_mint

        //Check that the vault settings is sent back to the contract with the redeemer as the datum
        //All vault nft should never be sent somewhere else than the script
        let output = self.outputs |> at(vault_token_index)
        //Make sure there is an output at the specified index
        expect Some(output) = output

        //Confirm that the newly minted nft is on the output
        let nft_is_on_output =
          output.value
            |> match(desired_mint, fn(_, _) { True })
        //Confirm that the output address is a contract address from itself
        expect Script(script_hash) = output.address.payment_credential
        let output_address_is_contract = script_hash == policy_id

        //Confirm that the datum is the right type 
        expect Some(output_datum) = find_datum(output, self)
        expect VaultParams { .. } = output_datum

        //Return the conditions to mint the vault setting token
        and {
          tag_is_valid?,
          mint_match_the_desired_mint?,
          output_address_is_contract?,
          nft_is_on_output?,
        }
      }
      VaultBurn ->
        //Check there is no nft minted
        self.mint |> tokens(policy_id) |> filter(fn(_, v) { v > 0 }) |> is_empty
    }
  }

  //Spend the vault settings is to update the parameters 
  spend(
    datum: Option<VaultParams>,
    redeemer: VaultRedeemer,
    own_ref: OutputReference,
    self: Transaction,
  ) {
    //Find the input with the vault token
    expect Some(input) = find_input(self.inputs, own_ref)

    expect Some(datum) = datum
    let VaultParams { admin, .. } = datum

    trace datum
    let admin_signed = is_admin(self, admin)
    when redeemer is {
      VaultMintAndSpend { vault_token_index, .. } -> {
        //Find the output with the vault token
        expect Some(output) = self.outputs |> at(vault_token_index)

        //Check that the input and output address is the same
        let input_and_output_have_same_payment_cred =
          input.output.address.payment_credential == output.address.payment_credential

        //Confirm that the token is still on the output
        let nft_is_on_output =
          output.value |> match(input.output.value, fn(_a, _b) { True })

        //Confirm that the new datum is still the right type 
        expect Some(output_datum) = find_datum(output, self)
        expect VaultParams { .. } = output_datum

        and {
          input_and_output_have_same_payment_cred?,
          admin_signed?,
          nft_is_on_output?,
        }
      }
      VaultBurn -> {
        //The input should only contains 1 nft
        let input_value = flatten(without_lovelace(input.output.value))
        //Make sure that the vault token is burnt and not sent elsewhere
        let input_is_burnt =
          when input_value is {
            [] -> False
            [(policy_id, assetname, quantity)] -> {
              //Confirm that the nft on the input is burnt
              let amount_minted = self.mint |> quantity_of(policy_id, assetname)
              amount_minted == -quantity
            }
            _ -> False
          }

        and {
          input_is_burnt?,
          admin_signed?,
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
