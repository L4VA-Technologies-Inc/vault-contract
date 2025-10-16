use admin.{is_admin}
use aiken/collection/list.{filter, foldr}
use aiken/collection/pairs.{get_first, has_key}
use cardano/address.{Credential, Script}
use cardano/assets.{PolicyId, add, match, merge, zero}
use cardano/transaction.{OutputReference, Spend, Transaction, find_input}
use datum.{find_datum}
use types.{CollectVaultToken, ContributionSpendRedeemer, OutputPayoutDatum}
use vault_parameters.{find_vault_parameters}

validator dispatch(
  vault_policy: PolicyId,
  vault_id: ByteArray,
  contribution_script_hash: ByteArray,
) {
  spend(
    _datum: Option<OutputPayoutDatum>,
    _redeemer: Data,
    own_ref: OutputReference,
    self: Transaction,
  ) {
    // Find current input to get the script hash
    expect Some(current_input) = find_input(self.inputs, own_ref)
    has_key(self.withdrawals, current_input.output.address.payment_credential)
  }

  withdraw(_redeemer: Data, account: Credential, self: Transaction) {
    // Get vault parameters to access admin key
    let vault =
      find_vault_parameters(vault_policy, vault_id, self.reference_inputs, self)
    expect Some(vault) = vault
    let admin_signed = is_admin(self, vault.admin)
    // Get the dispatch script hash from the withdrawal account
    // Shouldnt be possible to have a credential that is not a script
    let dispatch_script_hash =
      when account is {
        Script(script_hash) -> script_hash
        _ -> fail @"Withdrawal account is not a script"
      }
    // Filter all inputs with the same script hash (dispatch inputs)
    let dispatch_inputs =
      filter(
        self.inputs,
        fn(input) {
          when input.output.address.payment_credential is {
            Script(script_hash) -> script_hash == dispatch_script_hash
            _ -> False
          }
        },
      )
    // Check that all dispatch inputs are split/merge operations (require admin signature)
    let all_operations_valid = admin_signed
    // Sum all dispatch input values
    let total_dispatch_input_value =
      foldr(
        dispatch_inputs,
        zero,
        fn(input, acc) { merge(acc, input.output.value) },
      )
    // Sum all dispatch output values (outputs with same script hash)
    let dispatch_outputs =
      filter(
        self.outputs,
        fn(output) {
          when output.address.payment_credential is {
            Script(script_hash) -> script_hash == dispatch_script_hash
            _ -> False
          }
        },
      )
    let total_dispatch_output_value =
      foldr(
        dispatch_outputs,
        zero,
        fn(output, acc) { merge(acc, output.value) },
      )
    // Filter contribution inputs and calculate total ADA paid
    let contribution_inputs =
      filter(
        self.inputs,
        fn(input) {
          when input.output.address.payment_credential is {
            Script(script_hash) -> script_hash == contribution_script_hash
            _ -> False
          }
        },
      )
    // Sum all ADA amounts paid from contribution inputs
    let total_ada_paid =
      foldr(
        contribution_inputs,
        0,
        fn(input, acc) {
          // Find the redeemer associated with this input
          expect Some(redeemer) =
            self.redeemers |> get_first(Spend(input.output_reference))
          expect input_redeemer: ContributionSpendRedeemer = redeemer
          when input_redeemer is {
            CollectVaultToken { vault_token_output_index, .. } -> {
              // Find the output at the specified index
              expect Some(vault_token_output) =
                list.at(self.outputs, vault_token_output_index)
              // Get the datum from the vault token output
              let output_datum = find_datum(vault_token_output, self)
              when output_datum is {
                Some(datum) -> {
                  expect payout_datum: OutputPayoutDatum = datum
                  when payout_datum.ada_paid is {
                    Some(ada_amount) -> acc + ada_amount
                    None -> acc
                  }
                }
                None -> acc
              }
            }
            _ -> acc
          }
        },
      )
    // Not a CollectVaultToken redeemer, skip
    // Create expected output value by adding the paid ADA amount
    let expected_output_value =
      total_dispatch_output_value |> add(#"", #"", total_ada_paid)
    // Unified validation: input_value >= output_value + paid_amount
    // For Split/Merge: total_ada_paid = 0, so input >= output + 0 (input >= output)
    // For Pay: total_ada_paid > 0, so input >= output + paid_amount
    let balance_equation_valid =
      total_dispatch_input_value |> match(expected_output_value, >=)
    and {
      all_operations_valid?,
      balance_equation_valid?,
    }
  }

  else(_) {
    fail
  }
}
