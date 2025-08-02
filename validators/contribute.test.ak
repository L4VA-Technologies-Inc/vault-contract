use aiken/interval.{between}
use cardano/address.{from_script, from_verification_key}
use cardano/assets.{add, zero}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Spend, Transaction, placeholder,
}
use constant.{receipt_tag}
use contribute
use own_ref_tag.{generate_datum_tag}
use types.{
  Asset, AssetDatum, CancelAda, CancelAsset, CancelContribution,
  CollectVaultToken, Contribute, ExtractAda, ExtractAsset, Lovelace,
  MintVaultToken, VaultParams,
}

const output_reference =
  OutputReference {
    transaction_id: #"ef6ffddfe2206bb47bf5e1d1d79bbb2d702519a5d5b6b3f95aeeb080141ae877",
    output_index: 0,
  }

const tag = generate_datum_tag(output_reference)

const policy_id =
  #"7f3bbc09949abafc21ec672115c1f9e229e508434deddac58928e85de7f450e5"

const vault_policy_id =
  #"5555555555555555555555555555555555555555555555555555555555555555"

const script_address = from_script(policy_id)

const vault_script_address = from_script(vault_policy_id)

const test_signer = #"132123"

const owner = from_verification_key(#"2222")

const whitelist_policy_id = #"456456"

const datum =
  VaultParams {
    vault_status: 2,
    acquire_multiplier: Some(
      [("", Some(""), 2), (#"1234", None, 1), (#"1234", Some("1234"), 1)],
    ),
    contract_type: 1,
    asset_whitelist: [whitelist_policy_id],
    contributor_whitelist: None,
    asset_window: between(0, 2),
    acquire_window: between(3, 6),
    valuation_type: 1,
    fractionalization: None,
    custom_metadata: [],
    termination: None,
    acquire: None,
    admin: test_signer,
    minting_key: test_signer,
    ada_pair_multipler: Some(10),
  }

const vault_open =
  VaultParams {
    vault_status: 1,
    acquire_multiplier: Some([("", Some(""), 1), (#"1234", Some("1234"), 1)]),
    contract_type: 1,
    asset_whitelist: [whitelist_policy_id],
    contributor_whitelist: None,
    asset_window: between(0, 2),
    acquire_window: between(3, 6),
    valuation_type: 1,
    fractionalization: None,
    custom_metadata: [],
    termination: None,
    acquire: None,
    admin: test_signer,
    minting_key: test_signer,
    ada_pair_multipler: Some(10),
  }

const vault_cancelled =
  VaultParams {
    vault_status: 3,
    acquire_multiplier: Some([("", Some(""), 1), (#"1234", Some("1234"), 1)]),
    contract_type: 1,
    asset_whitelist: [whitelist_policy_id],
    contributor_whitelist: None,
    asset_window: between(0, 2),
    acquire_window: between(3, 6),
    valuation_type: 1,
    fractionalization: None,
    custom_metadata: [],
    termination: None,
    acquire: None,
    admin: test_signer,
    minting_key: test_signer,
    ada_pair_multipler: Some(10),
  }

const vault_id = #"99999999"

const reference_input =
  Input {
    output_reference,
    output: Output {
      address: vault_script_address,
      value: zero |> add(vault_policy_id, vault_id, 1),
      datum: InlineDatum(datum),
      reference_script: None,
    },
  }

const reference_input_open =
  Input {
    output_reference,
    output: Output {
      address: vault_script_address,
      value: zero |> add(vault_policy_id, vault_id, 1),
      datum: InlineDatum(vault_open),
      reference_script: None,
    },
  }

const reference_input_cancelled =
  Input {
    output_reference,
    output: Output {
      address: vault_script_address,
      value: zero |> add(vault_policy_id, vault_id, 1),
      datum: InlineDatum(vault_cancelled),
      reference_script: None,
    },
  }

test contribute_to_vault_ada() {
  let redeemer = Contribute { output_index: 0, contribution: Lovelace }
  let mint = zero |> add(policy_id, receipt_tag, 1)

  let output_datum =
    AssetDatum { policy_id, asset_name: vault_id, owner, datum_tag: Some(tag) }
  let output =
    Output {
      address: script_address,
      value: zero |> add("", "", 10000000) |> add(policy_id, receipt_tag, 1),
      datum: InlineDatum(output_datum),
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      reference_inputs: [reference_input_open],
      mint: mint,
      outputs: [output],
      validity_range: between(4, 5),
      extra_signatories: [test_signer],
    }
  contribute.contribute.mint(
    vault_policy_id,
    vault_id,
    redeemer,
    policy_id,
    self,
  )?
}

test contribute_to_vault_ada_out_of_acquire_window() fail {
  let redeemer = Contribute { output_index: 0, contribution: Lovelace }
  let mint = zero |> add(policy_id, receipt_tag, 1)

  let output_datum =
    AssetDatum { policy_id, asset_name: vault_id, owner, datum_tag: Some(tag) }
  let output =
    Output {
      address: script_address,
      value: zero |> add(policy_id, receipt_tag, 1),
      datum: InlineDatum(output_datum),
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      reference_inputs: [reference_input],
      mint: mint,
      outputs: [output],
      validity_range: between(7, 10),
      extra_signatories: [test_signer],
    }
  contribute.contribute.mint(
    vault_policy_id,
    vault_id,
    redeemer,
    policy_id,
    self,
  )?
}

test contribute_to_vault_ada_burn_lp() fail {
  let redeemer = Contribute { output_index: 0, contribution: Lovelace }
  let mint = zero |> add(policy_id, receipt_tag, -1)

  let output_datum =
    AssetDatum { policy_id, asset_name: vault_id, owner, datum_tag: Some(tag) }
  let output =
    Output {
      address: script_address,
      value: zero |> add(policy_id, receipt_tag, 1),
      datum: InlineDatum(output_datum),
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      reference_inputs: [reference_input],
      mint: mint,
      outputs: [output],
      validity_range: between(4, 5),
      extra_signatories: [test_signer],
    }
  contribute.contribute.mint(
    vault_policy_id,
    vault_id,
    redeemer,
    policy_id,
    self,
  )?
}

test contribute_to_vault_nft() {
  let redeemer = Contribute { output_index: 0, contribution: Asset }
  let mint = zero |> add(policy_id, receipt_tag, 1)

  let output_datum =
    AssetDatum { policy_id, asset_name: vault_id, owner, datum_tag: Some(tag) }
  let output =
    Output {
      address: script_address,
      value: zero
        |> add(whitelist_policy_id, #"abc123", 1)
        |> add(policy_id, receipt_tag, 1),
      datum: InlineDatum(output_datum),
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      reference_inputs: [reference_input_open],
      mint: mint,
      outputs: [output],
      validity_range: between(1, 2),
      extra_signatories: [test_signer],
    }
  contribute.contribute.mint(
    vault_policy_id,
    vault_id,
    redeemer,
    policy_id,
    self,
  )?
}

test contribute_to_vault_nft_out_of_acquire_window() fail {
  let redeemer = Contribute { output_index: 0, contribution: Asset }
  let mint = zero |> add(policy_id, receipt_tag, 1)

  let output_datum =
    AssetDatum { policy_id, asset_name: vault_id, owner, datum_tag: Some(tag) }
  let output =
    Output {
      address: script_address,
      value: zero
        |> add(whitelist_policy_id, #"abc123", 1)
        |> add(policy_id, receipt_tag, 1),
      datum: InlineDatum(output_datum),
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      reference_inputs: [reference_input],
      mint: mint,
      outputs: [output],
      validity_range: between(5, 7),
      extra_signatories: [test_signer],
    }
  contribute.contribute.mint(
    vault_policy_id,
    vault_id,
    redeemer,
    policy_id,
    self,
  )?
}

test contribute_to_vault_nft_without_locking_lps() fail {
  let redeemer = Contribute { output_index: 0, contribution: Asset }
  let mint = zero |> add(policy_id, receipt_tag, 1)

  let output_datum =
    AssetDatum { policy_id, asset_name: vault_id, owner, datum_tag: Some(tag) }
  let output =
    Output {
      address: owner,
      value: zero
        |> add(whitelist_policy_id, #"abc123", 1)
        |> add(policy_id, receipt_tag, 1),
      datum: InlineDatum(output_datum),
      reference_script: None,
    }
  let self =
    Transaction {
      ..placeholder,
      reference_inputs: [reference_input],
      mint: mint,
      outputs: [output],
      validity_range: between(1, 2),
      extra_signatories: [test_signer],
    }
  contribute.contribute.mint(
    vault_policy_id,
    vault_id,
    redeemer,
    policy_id,
    self,
  )?
}

test mint_ada_pair() {
  let mint_redeemer = MintVaultToken
  let spend_redeemer = ExtractAda { vault_token_output_index: Some(0) }
  let mint =
    zero
      |> add(policy_id, vault_id, 1200000000)
      |> add(policy_id, receipt_tag, -1)

  let output_datum =
    AssetDatum { policy_id, asset_name: vault_id, owner, datum_tag: Some(tag) }
  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero
          |> add("", "", 100000000)
          |> add(policy_id, receipt_tag, 1),
        datum: InlineDatum(output_datum),
        reference_script: None,
      },
    }
  let outputs =
    [
      Output {
        address: owner,
        value: zero |> add(policy_id, vault_id, 200000000),
        datum: InlineDatum(tag),
        reference_script: None,
      },
    ]
  let spend_key = Spend(output_reference)
  let redeemer_data: Data = spend_redeemer
  let self =
    Transaction {
      ..placeholder,
      reference_inputs: [reference_input],
      mint: mint,
      outputs: outputs,
      inputs: [first_input],
      validity_range: between(10, 11),
      extra_signatories: [test_signer],
      redeemers: [Pair(spend_key, redeemer_data)],
    }
  and {
    contribute.contribute.mint(
      vault_policy_id,
      vault_id,
      mint_redeemer,
      policy_id,
      self,
    )?,
    contribute.contribute.spend(
      vault_policy_id,
      vault_id,
      Some(output_datum),
      spend_redeemer,
      output_reference,
      self,
    )?,
  }
}

test mint_ada_pair_with_claimed_lps() {
  let mint_redeemer = MintVaultToken
  let spend_redeemer = ExtractAda { vault_token_output_index: None }
  let mint = zero |> add(policy_id, vault_id, 1000000000)

  let output_datum =
    AssetDatum { policy_id, asset_name: vault_id, owner, datum_tag: Some(tag) }
  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero
          |> add("", "", 100000000),
        datum: InlineDatum(output_datum),
        reference_script: None,
      },
    }
  let outputs = []
  let spend_key = Spend(output_reference)
  let redeemer_data: Data = spend_redeemer
  let self =
    Transaction {
      ..placeholder,
      reference_inputs: [reference_input],
      mint: mint,
      outputs: outputs,
      inputs: [first_input],
      validity_range: between(10, 11),
      extra_signatories: [test_signer],
      redeemers: [Pair(spend_key, redeemer_data)],
    }
  and {
    contribute.contribute.mint(
      vault_policy_id,
      vault_id,
      mint_redeemer,
      policy_id,
      self,
    )?,
    contribute.contribute.spend(
      vault_policy_id,
      vault_id,
      Some(output_datum),
      spend_redeemer,
      output_reference,
      self,
    )?,
  }
}

test extract_asset_with_lps() {
  let spend_redeemer = ExtractAsset { vault_token_output_index: Some(0) }
  let mint_redeemer = MintVaultToken
  let mint =
    zero
      |> add(policy_id, vault_id, 100000000)
      |> add(policy_id, receipt_tag, -1)

  let output_datum =
    AssetDatum { policy_id, asset_name: vault_id, owner, datum_tag: Some(tag) }
  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero
          |> add(policy_id, receipt_tag, 1)
          |> add(#"1234", "1234", 100000000)
          |> add("", "", 1231231),
        datum: InlineDatum(output_datum),
        reference_script: None,
      },
    }
  let outputs =
    [
      Output {
        address: owner,
        value: zero |> add(policy_id, vault_id, 100000000),
        datum: InlineDatum(tag),
        reference_script: None,
      },
    ]
  let spend_key = Spend(output_reference)
  let redeemer_data: Data = spend_redeemer
  let self =
    Transaction {
      ..placeholder,
      reference_inputs: [reference_input],
      mint: mint,
      outputs: outputs,
      inputs: [first_input],
      validity_range: between(10, 11),
      extra_signatories: [test_signer],
      redeemers: [Pair(spend_key, redeemer_data)],
    }
  and {
    contribute.contribute.spend(
      vault_policy_id,
      vault_id,
      Some(output_datum),
      spend_redeemer,
      output_reference,
      self,
    )?,
    contribute.contribute.mint(
      vault_policy_id,
      vault_id,
      mint_redeemer,
      policy_id,
      self,
    )?,
  }
}

test extract_asset_with_claimed_lps() {
  let spend_redeemer = ExtractAsset { vault_token_output_index: None }
  let output_datum =
    AssetDatum { policy_id, asset_name: vault_id, owner, datum_tag: Some(tag) }
  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero
          |> add(#"1234", #"1234", 100000000),
        datum: InlineDatum(output_datum),
        reference_script: None,
      },
    }
  let outputs = []
  let spend_key = Spend(output_reference)
  let redeemer_data: Data = spend_redeemer
  let self =
    Transaction {
      ..placeholder,
      reference_inputs: [reference_input],
      outputs: outputs,
      inputs: [first_input],
      validity_range: between(10, 11),
      extra_signatories: [test_signer],
      redeemers: [Pair(spend_key, redeemer_data)],
    }
  contribute.contribute.spend(
    vault_policy_id,
    vault_id,
    Some(output_datum),
    spend_redeemer,
    output_reference,
    self,
  )?
}

test collect_lps_with_ada() {
  let spend_redeemer =
    CollectVaultToken { vault_token_output_index: 0, change_output_index: 1 }
  let output_datum =
    AssetDatum { policy_id, asset_name: vault_id, owner, datum_tag: Some(tag) }
  let mint_redeemer = MintVaultToken
  let mint =
    zero
      |> add(policy_id, vault_id, 200000000)
      |> add(policy_id, receipt_tag, -1)

  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero
          |> add(policy_id, receipt_tag, 1)
          |> add(#"", "", 100000000),
        datum: InlineDatum(output_datum),
        reference_script: None,
      },
    }
  let outputs =
    [
      Output {
        address: owner,
        value: zero |> add(policy_id, vault_id, 200000000),
        datum: InlineDatum(tag),
        reference_script: None,
      },
      Output {
        address: script_address,
        value: zero
          |> add(#"", "", 100000000),
        datum: InlineDatum(output_datum),
        reference_script: None,
      },
    ]
  let spend_key = Spend(output_reference)
  let redeemer_data: Data = spend_redeemer
  let self =
    Transaction {
      ..placeholder,
      reference_inputs: [reference_input],
      mint: mint,
      outputs: outputs,
      inputs: [first_input],
      validity_range: between(10, 11),
      extra_signatories: [test_signer],
      redeemers: [Pair(spend_key, redeemer_data)],
    }
  and {
    contribute.contribute.spend(
      vault_policy_id,
      vault_id,
      Some(output_datum),
      spend_redeemer,
      output_reference,
      self,
    )?,
    contribute.contribute.mint(
      vault_policy_id,
      vault_id,
      mint_redeemer,
      policy_id,
      self,
    )?,
  }
}

test cancel_ada_contribution() {
  let spend_redeemer = CancelAda { cancel_output_index: None }
  let output_datum =
    AssetDatum { policy_id, asset_name: vault_id, owner, datum_tag: Some(tag) }
  let mint_redeemer = CancelContribution
  let mint =
    zero
      |> add(policy_id, receipt_tag, -1)

  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero
          |> add(policy_id, receipt_tag, 1)
          |> add(#"", "", 100000000),
        datum: InlineDatum(output_datum),
        reference_script: None,
      },
    }
  let outputs =
    [
      Output {
        address: owner,
        value: zero
          |> add(#"", "", 100000000),
        datum: InlineDatum(tag),
        reference_script: None,
      },
    ]
  let spend_key = Spend(output_reference)
  let redeemer_data: Data = spend_redeemer
  let self =
    Transaction {
      ..placeholder,
      reference_inputs: [reference_input],
      mint: mint,
      outputs: outputs,
      inputs: [first_input],
      validity_range: between(3, 5),
      extra_signatories: [#"2222"],
      redeemers: [Pair(spend_key, redeemer_data)],
    }
  and {
    contribute.contribute.spend(
      vault_policy_id,
      vault_id,
      Some(output_datum),
      spend_redeemer,
      output_reference,
      self,
    )?,
    contribute.contribute.mint(
      vault_policy_id,
      vault_id,
      mint_redeemer,
      policy_id,
      self,
    )?,
  }
}

test cancel_asset_contribution() {
  let spend_redeemer = CancelAsset { cancel_output_index: None }
  let output_datum =
    AssetDatum { policy_id, asset_name: vault_id, owner, datum_tag: Some(tag) }
  let mint_redeemer = CancelContribution
  let mint =
    zero
      |> add(policy_id, receipt_tag, -1)

  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero
          |> add(policy_id, receipt_tag, 1)
          |> add(#"1234", "12", 1),
        datum: InlineDatum(output_datum),
        reference_script: None,
      },
    }
  let outputs =
    [
      Output {
        address: owner,
        value: zero
          |> add(#"1234", "12", 1),
        datum: InlineDatum(tag),
        reference_script: None,
      },
    ]
  let spend_key = Spend(output_reference)
  let redeemer_data: Data = spend_redeemer
  let self =
    Transaction {
      ..placeholder,
      reference_inputs: [reference_input],
      mint: mint,
      outputs: outputs,
      inputs: [first_input],
      validity_range: between(1, 2),
      extra_signatories: [#"2222"],
      redeemers: [Pair(spend_key, redeemer_data)],
    }
  and {
    contribute.contribute.spend(
      vault_policy_id,
      vault_id,
      Some(output_datum),
      spend_redeemer,
      output_reference,
      self,
    )?,
    contribute.contribute.mint(
      vault_policy_id,
      vault_id,
      mint_redeemer,
      policy_id,
      self,
    )?,
  }
}

test cancel_ada_contribution_admin() {
  let spend_redeemer = CancelAda { cancel_output_index: Some(0) }
  let output_datum =
    AssetDatum { policy_id, asset_name: vault_id, owner, datum_tag: Some(tag) }
  let mint_redeemer = CancelContribution
  let mint =
    zero
      |> add(policy_id, receipt_tag, -1)

  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero
          |> add(policy_id, receipt_tag, 1)
          |> add(#"", "", 100000000),
        datum: InlineDatum(output_datum),
        reference_script: None,
      },
    }
  let outputs =
    [
      Output {
        address: owner,
        value: zero
          |> add(#"", "", 100000000),
        datum: InlineDatum(tag),
        reference_script: None,
      },
    ]
  let spend_key = Spend(output_reference)
  let redeemer_data: Data = spend_redeemer
  let self =
    Transaction {
      ..placeholder,
      reference_inputs: [reference_input_cancelled],
      mint: mint,
      outputs: outputs,
      inputs: [first_input],
      validity_range: between(3, 5),
      extra_signatories: [],
      redeemers: [Pair(spend_key, redeemer_data)],
    }
  and {
    contribute.contribute.spend(
      vault_policy_id,
      vault_id,
      Some(output_datum),
      spend_redeemer,
      output_reference,
      self,
    )?,
    contribute.contribute.mint(
      vault_policy_id,
      vault_id,
      mint_redeemer,
      policy_id,
      self,
    )?,
  }
}

test cancel_ada_contribution_admin_wrong_owner() fail {
  let spend_redeemer = CancelAda { cancel_output_index: Some(0) }
  let output_datum =
    AssetDatum { policy_id, asset_name: vault_id, owner, datum_tag: Some(tag) }
  let mint_redeemer = CancelContribution
  let mint =
    zero
      |> add(policy_id, receipt_tag, -1)

  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero
          |> add(policy_id, receipt_tag, 1)
          |> add(#"", "", 100000000),
        datum: InlineDatum(output_datum),
        reference_script: None,
      },
    }
  let outputs =
    [
      Output {
        address: script_address,
        value: zero
          |> add(#"", "", 100000000),
        datum: InlineDatum(tag),
        reference_script: None,
      },
    ]
  let spend_key = Spend(output_reference)
  let redeemer_data: Data = spend_redeemer
  let self =
    Transaction {
      ..placeholder,
      reference_inputs: [reference_input_cancelled],
      mint: mint,
      outputs: outputs,
      inputs: [first_input],
      validity_range: between(3, 5),
      extra_signatories: [],
      redeemers: [Pair(spend_key, redeemer_data)],
    }
  and {
    contribute.contribute.spend(
      vault_policy_id,
      vault_id,
      Some(output_datum),
      spend_redeemer,
      output_reference,
      self,
    )?,
    contribute.contribute.mint(
      vault_policy_id,
      vault_id,
      mint_redeemer,
      policy_id,
      self,
    )?,
  }
}

test cancel_ada_contribution_admin_vault_open() fail {
  let spend_redeemer = CancelAda { cancel_output_index: Some(0) }
  let output_datum =
    AssetDatum { policy_id, asset_name: vault_id, owner, datum_tag: Some(tag) }
  let mint_redeemer = CancelContribution
  let mint =
    zero
      |> add(policy_id, receipt_tag, -1)

  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero
          |> add(policy_id, receipt_tag, 1)
          |> add(#"", "", 100000000),
        datum: InlineDatum(output_datum),
        reference_script: None,
      },
    }
  let outputs =
    [
      Output {
        address: script_address,
        value: zero
          |> add(#"", "", 100000000),
        datum: InlineDatum(tag),
        reference_script: None,
      },
    ]
  let spend_key = Spend(output_reference)
  let redeemer_data: Data = spend_redeemer
  let self =
    Transaction {
      ..placeholder,
      reference_inputs: [reference_input_open],
      mint: mint,
      outputs: outputs,
      inputs: [first_input],
      validity_range: between(3, 5),
      extra_signatories: [],
      redeemers: [Pair(spend_key, redeemer_data)],
    }
  and {
    contribute.contribute.spend(
      vault_policy_id,
      vault_id,
      Some(output_datum),
      spend_redeemer,
      output_reference,
      self,
    )?,
    contribute.contribute.mint(
      vault_policy_id,
      vault_id,
      mint_redeemer,
      policy_id,
      self,
    )?,
  }
}

test cancel_ada_contribution_admin_no_receipt_burning() fail {
  let spend_redeemer = CancelAda { cancel_output_index: Some(0) }
  let output_datum =
    AssetDatum { policy_id, asset_name: vault_id, owner, datum_tag: Some(tag) }
  let mint_redeemer = CancelContribution
  let mint = zero

  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero
          |> add(policy_id, receipt_tag, 1)
          |> add(#"", "", 100000000),
        datum: InlineDatum(output_datum),
        reference_script: None,
      },
    }
  let outputs =
    [
      Output {
        address: owner,
        value: zero
          |> add(#"", "", 100000000),
        datum: InlineDatum(tag),
        reference_script: None,
      },
    ]
  let spend_key = Spend(output_reference)
  let redeemer_data: Data = spend_redeemer
  let self =
    Transaction {
      ..placeholder,
      reference_inputs: [reference_input_cancelled],
      mint: mint,
      outputs: outputs,
      inputs: [first_input],
      validity_range: between(3, 5),
      extra_signatories: [],
      redeemers: [Pair(spend_key, redeemer_data)],
    }
  and {
    contribute.contribute.spend(
      vault_policy_id,
      vault_id,
      Some(output_datum),
      spend_redeemer,
      output_reference,
      self,
    )?,
    contribute.contribute.mint(
      vault_policy_id,
      vault_id,
      mint_redeemer,
      policy_id,
      self,
    )?,
  }
}

test cancel_ada_contribution_admin_wrong_amount_burned() fail {
  let spend_redeemer = CancelAda { cancel_output_index: Some(0) }
  let output_datum =
    AssetDatum { policy_id, asset_name: vault_id, owner, datum_tag: Some(tag) }
  let mint_redeemer = CancelContribution
  let mint =
    zero
      |> add(policy_id, receipt_tag, -5)

  let first_input =
    Input {
      output_reference,
      output: Output {
        address: script_address,
        value: zero
          |> add(policy_id, receipt_tag, 1)
          |> add(#"", "", 100000000),
        datum: InlineDatum(output_datum),
        reference_script: None,
      },
    }
  let outputs =
    [
      Output {
        address: owner,
        value: zero
          |> add(#"", "", 100000000),
        datum: InlineDatum(tag),
        reference_script: None,
      },
    ]
  let spend_key = Spend(output_reference)
  let redeemer_data: Data = spend_redeemer
  let self =
    Transaction {
      ..placeholder,
      reference_inputs: [reference_input_cancelled],
      mint: mint,
      outputs: outputs,
      inputs: [first_input],
      validity_range: between(3, 5),
      extra_signatories: [],
      redeemers: [Pair(spend_key, redeemer_data)],
    }
  and {
    contribute.contribute.spend(
      vault_policy_id,
      vault_id,
      Some(output_datum),
      spend_redeemer,
      output_reference,
      self,
    )?,
    contribute.contribute.mint(
      vault_policy_id,
      vault_id,
      mint_redeemer,
      policy_id,
      self,
    )?,
  }
}
