use aiken/interval.{between}
use cardano/address.{Script, from_script}
use cardano/assets.{add, zero}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Spend, Transaction, placeholder,
}
use dispatch
use types.{CollectVaultToken, OutputPayoutDatum, VaultParams}

// Test constants
const vault_policy_id =
  #"5555555555555555555555555555555555555555555555555555555555555555"

const vault_id = #"76616c756c74313233"

const dispatch_script_hash =
  #"7f3bbc09949abafc21ec672115c1f9e229e508434deddac58928e85de7f450e5"

const contribution_script_hash =
  #"9a9b0bc93c26a40952aaff525ac72a992a77ebfa29012c9cb4a72eb2"

const admin_key = #"61646d696e313233"

const dispatch_address = from_script(dispatch_script_hash)

const contribution_address = from_script(contribution_script_hash)

const vault_address = from_script(vault_policy_id)

// Helper function to create vault parameters
fn create_vault_params() -> VaultParams {
  VaultParams {
    vault_status: 1,
    contract_type: 1,
    asset_whitelist: [],
    contributor_whitelist: None,
    asset_window: between(0, 100),
    acquire_window: between(0, 100),
    valuation_type: 0,
    fractionalization: None,
    custom_metadata: [],
    termination: None,
    acquire: None,
    acquire_multiplier: None,
    ada_pair_multipler: None,
    ada_distribution: None,
    admin: admin_key,
    minting_key: admin_key,
  }
}

// Helper function to create output reference
fn create_output_ref(tx_id: ByteArray, index: Int) -> OutputReference {
  OutputReference { transaction_id: tx_id, output_index: index }
}

// Helper function to create dispatch input
fn create_dispatch_input(value, ref: OutputReference) -> Input {
  Input {
    output_reference: ref,
    output: Output {
      address: dispatch_address,
      value,
      datum: InlineDatum(Void),
      reference_script: None,
    },
  }
}

// Helper function to create dispatch output
fn create_dispatch_output(value) -> Output {
  Output {
    address: dispatch_address,
    value,
    datum: InlineDatum(Void),
    reference_script: None,
  }
}

// Helper function to create contribution input with payout datum
fn create_contribution_input(
  ada_paid: Option<Int>,
  ref: OutputReference,
) -> Input {
  let payout_datum = OutputPayoutDatum { datum_tag: None, ada_paid }
  Input {
    output_reference: ref,
    output: Output {
      address: contribution_address,
      value: zero |> add(#"", #"", 1000000),
      datum: InlineDatum(payout_datum),
      reference_script: None,
    },
  }
}

// Helper function to create vault reference input
fn create_vault_reference_input() -> Input {
  let vault_params = create_vault_params()
  Input {
    output_reference: create_output_ref(#"7661756c745f726566", 0),
    output: Output {
      address: vault_address,
      value: zero |> add(vault_policy_id, vault_id, 1),
      datum: InlineDatum(vault_params),
      reference_script: None,
    },
  }
}

test dispatch_split_operation_success() {
  let input_value = zero |> add(#"", #"", 5000000)
  let output_value1 = zero |> add(#"", #"", 2000000)
  let output_value2 = zero |> add(#"", #"", 3000000)
  let dispatch_input =
    create_dispatch_input(input_value, create_output_ref(#"747831", 0))
  let dispatch_output1 = create_dispatch_output(output_value1)
  let dispatch_output2 = create_dispatch_output(output_value2)
  let vault_ref = create_vault_reference_input()
  let tx =
    Transaction {
      ..placeholder,
      inputs: [dispatch_input],
      reference_inputs: [vault_ref],
      outputs: [dispatch_output1, dispatch_output2],
      withdrawals: [],
      extra_signatories: [admin_key],
    }
  dispatch.dispatch.withdraw(
    vault_policy_id,
    vault_id,
    contribution_script_hash,
    Void,
    Script(dispatch_script_hash),
    tx,
  )
}

test dispatch_merge_operation_success() {
  let input_value1 = zero |> add(#"", #"", 2000000)
  let input_value2 = zero |> add(#"", #"", 3000000)
  let output_value = zero |> add(#"", #"", 5000000)
  let dispatch_input1 =
    create_dispatch_input(input_value1, create_output_ref(#"747831", 0))
  let dispatch_input2 =
    create_dispatch_input(input_value2, create_output_ref(#"747832", 0))
  let dispatch_output = create_dispatch_output(output_value)
  let vault_ref = create_vault_reference_input()
  let tx =
    Transaction {
      ..placeholder,
      inputs: [dispatch_input1, dispatch_input2],
      reference_inputs: [vault_ref],
      outputs: [dispatch_output],
      withdrawals: [],
      extra_signatories: [admin_key],
    }
  dispatch.dispatch.withdraw(
    vault_policy_id,
    vault_id,
    contribution_script_hash,
    Void,
    Script(dispatch_script_hash),
    tx,
  )
}

test dispatch_pay_operation_success() {
  let input_value = zero |> add(#"", #"", 5000000)
  let output_value = zero |> add(#"", #"", 3000000)
  let ada_paid = 2000000
  let dispatch_input =
    create_dispatch_input(input_value, create_output_ref(#"747831", 0))
  let dispatch_output = create_dispatch_output(output_value)
  let contribution_input =
    create_contribution_input(
      Some(ada_paid),
      create_output_ref(#"636f6e747269623031", 0),
    )
  let vault_ref = create_vault_reference_input()
  // Create redeemer for contribution input
  let collect_redeemer: Data =
    CollectVaultToken { vault_token_output_index: 0, change_output_index: 0 }
  let tx =
    Transaction {
      ..placeholder,
      inputs: [dispatch_input, contribution_input],
      reference_inputs: [vault_ref],
      outputs: [dispatch_output],
      withdrawals: [],
      extra_signatories: [admin_key],
      redeemers: [
        Pair(
          Spend(create_output_ref(#"636f6e747269623031", 0)),
          collect_redeemer,
        ),
      ],
    }
  dispatch.dispatch.withdraw(
    vault_policy_id,
    vault_id,
    contribution_script_hash,
    Void,
    Script(dispatch_script_hash),
    tx,
  )
}

test dispatch_multiple_payments_success() {
  let input_value = zero |> add(#"", #"", 10000000)
  let output_value = zero |> add(#"", #"", 6000000)
  let ada_paid1 = 2000000
  let ada_paid2 = 2000000
  let dispatch_input =
    create_dispatch_input(input_value, create_output_ref(#"747831", 0))
  let dispatch_output = create_dispatch_output(output_value)
  let contribution_input1 =
    create_contribution_input(
      Some(ada_paid1),
      create_output_ref(#"636f6e747269623031", 0),
    )
  let contribution_input2 =
    create_contribution_input(
      Some(ada_paid2),
      create_output_ref(#"636f6e747269623032", 0),
    )
  let vault_ref = create_vault_reference_input()
  // Create redeemers for both contribution inputs
  let collect_redeemer1: Data =
    CollectVaultToken { vault_token_output_index: 0, change_output_index: 0 }
  let collect_redeemer2: Data =
    CollectVaultToken { vault_token_output_index: 0, change_output_index: 0 }
  let tx =
    Transaction {
      ..placeholder,
      inputs: [dispatch_input, contribution_input1, contribution_input2],
      reference_inputs: [vault_ref],
      outputs: [dispatch_output],
      withdrawals: [],
      extra_signatories: [admin_key],
      redeemers: [
        Pair(
          Spend(create_output_ref(#"636f6e747269623031", 0)),
          collect_redeemer1,
        ),
        Pair(
          Spend(create_output_ref(#"636f6e747269623032", 0)),
          collect_redeemer2,
        ),
      ],
    }
  dispatch.dispatch.withdraw(
    vault_policy_id,
    vault_id,
    contribution_script_hash,
    Void,
    Script(dispatch_script_hash),
    tx,
  )
}

test dispatch_with_assets_success() {
  let token_policy = #"746f6b656e313233"
  let token_name = #"544f4b454e"
  let input_value =
    zero
      |> add(#"", #"", 5000000)
      |> add(token_policy, token_name, 100)
  let output_value1 =
    zero
      |> add(#"", #"", 2000000)
      |> add(token_policy, token_name, 40)
  let output_value2 =
    zero
      |> add(#"", #"", 3000000)
      |> add(token_policy, token_name, 60)
  let dispatch_input =
    create_dispatch_input(input_value, create_output_ref(#"747831", 0))
  let dispatch_output1 = create_dispatch_output(output_value1)
  let dispatch_output2 = create_dispatch_output(output_value2)
  let vault_ref = create_vault_reference_input()
  let tx =
    Transaction {
      ..placeholder,
      inputs: [dispatch_input],
      reference_inputs: [vault_ref],
      outputs: [dispatch_output1, dispatch_output2],
      withdrawals: [],
      extra_signatories: [admin_key],
    }
  dispatch.dispatch.withdraw(
    vault_policy_id,
    vault_id,
    contribution_script_hash,
    Void,
    Script(dispatch_script_hash),
    tx,
  )
}

test dispatch_no_admin_signature_fails() fail {
  let input_value = zero |> add(#"", #"", 5000000)
  let output_value = zero |> add(#"", #"", 5000000)
  let dispatch_input =
    create_dispatch_input(input_value, create_output_ref(#"747831", 0))
  let dispatch_output = create_dispatch_output(output_value)
  let vault_ref = create_vault_reference_input()
  let tx =
    Transaction {
      ..placeholder,
      inputs: [dispatch_input],
      reference_inputs: [vault_ref],
      outputs: [dispatch_output],
      withdrawals: [],
      extra_signatories: [],
    }
  // No admin signature
  dispatch.dispatch.withdraw(
    vault_policy_id,
    vault_id,
    contribution_script_hash,
    Void,
    Script(dispatch_script_hash),
    tx,
  )
}

test dispatch_insufficient_input_value_fails() fail {
  let input_value = zero |> add(#"", #"", 3000000)
  let output_value = zero |> add(#"", #"", 5000000)
  // More than input
  let dispatch_input =
    create_dispatch_input(input_value, create_output_ref(#"747831", 0))
  let dispatch_output = create_dispatch_output(output_value)
  let vault_ref = create_vault_reference_input()
  let tx =
    Transaction {
      ..placeholder,
      inputs: [dispatch_input],
      reference_inputs: [vault_ref],
      outputs: [dispatch_output],
      withdrawals: [],
      extra_signatories: [admin_key],
    }
  dispatch.dispatch.withdraw(
    vault_policy_id,
    vault_id,
    contribution_script_hash,
    Void,
    Script(dispatch_script_hash),
    tx,
  )
}

test dispatch_pay_insufficient_input_fails() fail {
  let input_value = zero |> add(#"", #"", 5000000)
  let output_value = zero |> add(#"", #"", 4000000)
  let ada_paid = 2000000
  // Input should be >= output + paid (6M), but only 5M
  let dispatch_input =
    create_dispatch_input(input_value, create_output_ref(#"747831", 0))
  let dispatch_output = create_dispatch_output(output_value)
  let contribution_input =
    create_contribution_input(
      Some(ada_paid),
      create_output_ref(#"636f6e747269623031", 0),
    )
  let vault_ref = create_vault_reference_input()
  // Create redeemer for contribution input
  let collect_redeemer: Data =
    CollectVaultToken { vault_token_output_index: 0, change_output_index: 0 }
  let tx =
    Transaction {
      ..placeholder,
      inputs: [dispatch_input, contribution_input],
      reference_inputs: [vault_ref],
      outputs: [dispatch_output],
      withdrawals: [],
      extra_signatories: [admin_key],
      redeemers: [
        Pair(
          Spend(create_output_ref(#"636f6e747269623031", 0)),
          collect_redeemer,
        ),
      ],
    }
  dispatch.dispatch.withdraw(
    vault_policy_id,
    vault_id,
    contribution_script_hash,
    Void,
    Script(dispatch_script_hash),
    tx,
  )
}

test dispatch_missing_vault_reference_fails() fail {
  let input_value = zero |> add(#"", #"", 5000000)
  let output_value = zero |> add(#"", #"", 5000000)
  let dispatch_input =
    create_dispatch_input(input_value, create_output_ref(#"747831", 0))
  let dispatch_output = create_dispatch_output(output_value)
  let tx =
    Transaction {
      ..placeholder,
      inputs: [dispatch_input],
      reference_inputs: [],
      outputs: // Missing vault reference
      [dispatch_output],
      withdrawals: [],
      extra_signatories: [admin_key],
    }
  dispatch.dispatch.withdraw(
    vault_policy_id,
    vault_id,
    contribution_script_hash,
    Void,
    Script(dispatch_script_hash),
    tx,
  )
}
