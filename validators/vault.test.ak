use aiken/interval.{between}
use cardano/address.{from_script, from_verification_key}
use cardano/assets.{add, zero}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, placeholder,
}
use own_ref_tag.{generate_datum_tag}
use types.{VaultBurn, VaultMintAndSpend, VaultParams}
use vault

const output_reference =
  OutputReference {
    transaction_id: #"ef6ffddfe2206bb47bf5e1d1d79bbb2d702519a5d5b6b3f95aeeb080141ae877",
    output_index: 0,
  }

const output_reference2 =
  OutputReference {
    transaction_id: #"ef6ffddfe2206bb47bf5e1d1d79bbb2d702519a5d5b6b3f95aeeb080141ae877",
    output_index: 1,
  }

const tag = generate_datum_tag(output_reference)

const tag2 = generate_datum_tag(output_reference2)

const policy_id =
  #"7f3bbc09949abafc21ec672115c1f9e229e508434deddac58928e85de7f450e5"

const script_address = from_script(policy_id)

const test_signer = #"132123"

const datum =
  VaultParams {
    vault_status: 1,
    acquire_multiplier: None,
    contract_type: 1,
    asset_whitelist: [],
    contributor_whitelist: None,
    asset_window: between(0, 1),
    acquire_window: between(0, 1),
    valuation_type: 1,
    fractionalization: None,
    custom_metadata: [],
    termination: None,
    acquire: None,
    admin: test_signer,
    minting_key: test_signer,
    ada_pair_multipler: None,
  }

test mint_validator_perfect_flow() {
  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero |> add(policy_id, tag, 1),
        datum: NoDatum,
        reference_script: None,
      },
    }
  let redeemer = VaultMintAndSpend { vault_token_index: 0, asset_name: tag }
  let mint =
    zero |> add(policy_id, generate_datum_tag(first_input.output_reference), 1)
  let output =
    Output {
      address: script_address,
      value: mint,
      datum: InlineDatum(datum),
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      inputs: [first_input],
      mint: mint,
      outputs: [output],
    }
  vault.vault.mint(redeemer, policy_id, self)?
}

test mint_invalid_tag() fail {
  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero |> add(policy_id, tag, 1),
        datum: NoDatum,
        reference_script: None,
      },
    }

  let redeemer = VaultMintAndSpend { vault_token_index: 0, asset_name: tag2 }
  let mint = zero |> add(policy_id, tag2, 1)
  let output =
    Output {
      address: script_address,
      value: mint,
      datum: InlineDatum(datum),
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      inputs: [first_input],
      mint: mint,
      outputs: [output],
    }
  vault.vault.mint(redeemer, policy_id, self)?
}

test mint_validator_with_random_mint() {
  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero |> add(policy_id, tag, 1),
        datum: NoDatum,
        reference_script: None,
      },
    }

  let redeemer = VaultMintAndSpend { vault_token_index: 0, asset_name: tag }
  let mint =
    zero
      |> add(policy_id, generate_datum_tag(first_input.output_reference), 1)
      |> add("foo", "bar", 1)

  let output_value =
    zero
      |> add(policy_id, generate_datum_tag(first_input.output_reference), 1)
  let output =
    Output {
      address: script_address,
      value: output_value,
      datum: InlineDatum(datum),
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      inputs: [first_input],
      mint: mint,
      outputs: [output],
    }
  vault.vault.mint(redeemer, policy_id, self)?
}

test mint_validator_more_than_one() fail {
  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero |> add(policy_id, tag, 1),
        datum: NoDatum,
        reference_script: None,
      },
    }

  let redeemer = VaultMintAndSpend { vault_token_index: 0, asset_name: tag2 }
  let mint =
    zero
      |> add(policy_id, generate_datum_tag(first_input.output_reference), 3)
      |> add("foo", "bar", 1)

  let output_value =
    zero
      |> add(policy_id, generate_datum_tag(first_input.output_reference), 1)
  let output =
    Output {
      address: script_address,
      value: output_value,
      datum: InlineDatum(datum),
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      inputs: [first_input],
      mint: mint,
      outputs: [output],
    }
  vault.vault.mint(redeemer, policy_id, self)?
}

test spend_update_settings() {
  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero |> add(policy_id, tag, 1),
        datum: NoDatum,
        reference_script: None,
      },
    }

  let redeemer = VaultMintAndSpend { vault_token_index: 0, asset_name: tag2 }

  let output_value =
    zero
      |> add(policy_id, generate_datum_tag(first_input.output_reference), 1)
  let output =
    Output {
      address: script_address,
      value: output_value,
      datum: InlineDatum(datum),
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      inputs: [first_input],
      outputs: [output],
      extra_signatories: [test_signer],
    }
  vault.vault.spend(Some(datum), redeemer, output_reference, self)?
}

test spend_update_settings_without_admin_signature() fail {
  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero |> add(policy_id, tag, 1),
        datum: NoDatum,
        reference_script: None,
      },
    }

  let redeemer = VaultMintAndSpend { vault_token_index: 0, asset_name: tag2 }

  let output_value =
    zero
      |> add(policy_id, generate_datum_tag(first_input.output_reference), 1)
  let output =
    Output {
      address: script_address,
      value: output_value,
      datum: InlineDatum(datum),
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      inputs: [first_input],
      outputs: [output],
      extra_signatories: [],
    }
  vault.vault.spend(Some(datum), redeemer, output_reference, self)?
}

test spend_submit_to_another_address() fail {
  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero |> add(policy_id, tag, 1),
        datum: NoDatum,
        reference_script: None,
      },
    }

  let redeemer = VaultMintAndSpend { vault_token_index: 0, asset_name: tag2 }

  let output_value =
    zero
      |> add(policy_id, generate_datum_tag(first_input.output_reference), 1)
  let output =
    Output {
      address: from_verification_key(#"123123123123"),
      value: output_value,
      datum: InlineDatum(datum),
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      inputs: [first_input],
      outputs: [output],
      extra_signatories: [],
    }
  vault.vault.spend(Some(datum), redeemer, output_reference, self)?
}

test spend_with_no_datum_output() fail {
  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero |> add(policy_id, tag, 1),
        datum: datum |> InlineDatum,
        reference_script: None,
      },
    }

  let redeemer = VaultMintAndSpend { vault_token_index: 0, asset_name: tag2 }

  let output_value =
    zero
      |> add(policy_id, generate_datum_tag(first_input.output_reference), 1)
  let output =
    Output {
      address: from_verification_key(#"123123123123"),
      value: output_value,
      datum: NoDatum,
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      inputs: [first_input],
      outputs: [output],
      extra_signatories: [],
    }
  vault.vault.spend(Some(datum), redeemer, output_reference, self)?
}

test spend_and_burn() {
  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero |> add(policy_id, tag, 1),
        datum: datum |> InlineDatum,
        reference_script: None,
      },
    }

  let redeemer = VaultBurn

  let mint =
    zero
      |> add(policy_id, generate_datum_tag(first_input.output_reference), -1)
  let output =
    Output {
      address: from_verification_key(#"123123123123"),
      value: zero,
      datum: NoDatum,
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      inputs: [first_input],
      outputs: [output],
      mint: mint,
      extra_signatories: [test_signer],
    }
  and {
    vault.vault.spend(Some(datum), redeemer, output_reference, self)?,
    vault.vault.mint(redeemer, policy_id, self)?,
  }
}

test spend_update_and_burn() {
  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero |> add(policy_id, tag, 1),
        datum: datum |> InlineDatum,
        reference_script: None,
      },
    }

  let second_input =
    Input {
      output_reference: output_reference2,
      output: Output {
        address: script_address,
        value: zero |> add(policy_id, tag2, 1),
        datum: datum |> InlineDatum,
        reference_script: None,
      },
    }

  let redeemer = VaultBurn

  let redeemer2 = VaultMintAndSpend { vault_token_index: 1, asset_name: tag2 }

  let mint =
    zero
      |> add(policy_id, generate_datum_tag(first_input.output_reference), -1)
  let output =
    Output {
      address: from_verification_key(#"123123123123"),
      value: zero,
      datum: NoDatum,
      reference_script: None,
    }

  let output2 =
    Output {
      address: script_address,
      value: zero |> add(policy_id, tag2, 1),
      datum: datum |> InlineDatum,
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      inputs: [first_input, second_input],
      outputs: [output, output2],
      mint: mint,
      extra_signatories: [test_signer],
    }
  and {
    vault.vault.spend(Some(datum), redeemer, output_reference, self)?,
    vault.vault.spend(Some(datum), redeemer2, output_reference2, self)?,
    vault.vault.mint(redeemer, policy_id, self)?,
  }
}

test spend_and_burn_and_mint() fail {
  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero |> add(policy_id, tag, 1),
        datum: datum |> InlineDatum,
        reference_script: None,
      },
    }

  let redeemer = VaultBurn

  let mint =
    zero
      |> add(policy_id, generate_datum_tag(first_input.output_reference), -1)
      |> add(policy_id, #"000000", 1)
  let output =
    Output {
      address: from_verification_key(#"123123123123"),
      value: zero,
      datum: NoDatum,
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      inputs: [first_input],
      outputs: [output],
      mint: mint,
      extra_signatories: [],
    }
  and {
    vault.vault.spend(Some(datum), redeemer, output_reference, self)?,
    vault.vault.mint(redeemer, policy_id, self)?,
  }
}

test spend_double_burn() {
  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero |> add(policy_id, tag, 1),
        datum: datum |> InlineDatum,
        reference_script: None,
      },
    }

  let second_input =
    Input {
      output_reference: output_reference2,
      output: Output {
        address: script_address,
        value: zero |> add(policy_id, tag2, 1),
        datum: datum |> InlineDatum,
        reference_script: None,
      },
    }

  let redeemer = VaultBurn

  let mint =
    zero
      |> add(policy_id, generate_datum_tag(first_input.output_reference), -1)
      |> add(policy_id, generate_datum_tag(second_input.output_reference), -1)

  let output =
    Output {
      address: from_verification_key(#"123123123123"),
      value: zero,
      datum: NoDatum,
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      inputs: [first_input, second_input],
      outputs: [output],
      mint: mint,
      extra_signatories: [test_signer],
    }
  and {
    vault.vault.spend(Some(datum), redeemer, output_reference, self)?,
    vault.vault.spend(Some(datum), redeemer, output_reference2, self)?,
    vault.vault.mint(redeemer, policy_id, self)?,
  }
}

test mint_validator_perfect_flow_tqueri() {
  let tq_output_ref =
    OutputReference {
      transaction_id: #"9acffdbf5042f8cc544a8141a7e60eff9d328db4064a20a17f5b0645ab2a0569",
      output_index: 0,
    }
  let tq_tag = generate_datum_tag(tq_output_ref)

  let policy_id = #"db7eff7c2f6008628471b2d02bd41611c4127a8d705356d178f5933e"

  let script_address = from_script(policy_id)
  let first_input =
    Input {
      output_reference: tq_output_ref,
      output: Output {
        address: from_script(#"123213"),
        value: zero |> add("", "", 1000000),
        datum: NoDatum,
        reference_script: None,
      },
    }

  let redeemer = VaultMintAndSpend { vault_token_index: 0, asset_name: tq_tag }
  let mint =
    zero |> add(policy_id, generate_datum_tag(first_input.output_reference), 1)
  let output =
    Output {
      address: script_address,
      value: mint,
      datum: InlineDatum(datum),
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      inputs: [first_input],
      mint: mint,
      outputs: [output],
    }
  vault.vault.mint(redeemer, policy_id, self)?
}
