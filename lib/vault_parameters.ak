use cardano/assets.{PolicyId, quantity_of}
use cardano/transaction.{Input, Transaction}
use datum.{find_datum}
use types.{VaultParams}

pub fn find_vault_parameters(
  vault_policy: PolicyId,
  vault_id: ByteArray,
  reference_inputs: List<Input>,
  tx: Transaction,
) -> Option<VaultParams> {
  when reference_inputs is {
    [] -> None
    [input, ..rest] -> {
      let is_input_contain_vault =
        input.output.value |> quantity_of(vault_policy, vault_id)
      if is_input_contain_vault == 0 {
        find_vault_parameters(vault_policy, vault_id, rest, tx)
      } else {
        let datum = find_datum(input.output, tx)
        expect Some(datum) = datum
        expect vault_params: VaultParams = datum
        Some(vault_params)
      }
    }
  }
}

pub fn is_vault_completed(vault: VaultParams) {
  vault.vault_status == 2
}

pub fn is_vault_cancelled(vault: VaultParams) {
  vault.vault_status == 3
}
