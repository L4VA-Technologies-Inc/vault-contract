use aiken/crypto.{VerificationKeyHash}
use aiken/interval.{Interval}
use cardano/address.{Address}
use cardano/assets.{AssetName, PolicyId}

pub type Acquire {
  reserve: Int,
  liquidityPool: Int,
}

pub type Fractionalization {
  percentage: Int,
  token_supply: Int,
  token_decimals: Int,
  token_policy: PolicyId,
}

pub type Termination {
  termination_type: Int,
  fdp: Int,
}

//Parameters used on a vault
pub type VaultParams {
  //0: pending, 1: open, 2: successful, 3: cancelled
  vault_status: Int,
  contract_type: Int,
  asset_whitelist: List<PolicyId>,
  contributor_whitelist: Option<List<VerificationKeyHash>>,
  asset_window: Interval<Int>,
  acquire_window: Interval<Int>,
  valuation_type: Int,
  fractionalization: Option<Fractionalization>,
  custom_metadata: List<Pair<ByteArray, ByteArray>>,
  termination: Option<Termination>,
  acquire: Option<Acquire>,
  acquire_multiplier: Option<List<(PolicyId, Option<AssetName>, Int)>>,
  ada_pair_multipler: Option<Int>,
  ada_distribution: Option<List<(PolicyId, Option<AssetName>, Int)>>,
  admin: VerificationKeyHash,
  minting_key: VerificationKeyHash,
}

//Optimization when minting a vault
pub type VaultRedeemer {
  VaultMintAndSpend { vault_token_index: Int, asset_name: AssetName }
  VaultBurn
}

pub type ContributionType {
  Lovelace
  Asset
}

//TODO add % from ada contribution
pub type ContributionMintRedeemer {
  Contribute { output_index: Int, contribution: ContributionType }
  MintVaultToken
  CancelContribution
  BurnLp
}

pub type ContributionSpendRedeemer {
  ExtractAda { vault_token_output_index: Option<Int> }
  ExtractAsset { vault_token_output_index: Option<Int> }
  CollectVaultToken { vault_token_output_index: Int, change_output_index: Int }
  CancelAsset { cancel_output_index: Option<Int> }
  CancelAda { cancel_output_index: Option<Int> }
}

pub type AssetDatum {
  policy_id: PolicyId,
  asset_name: AssetName,
  owner: Address,
  datum_tag: Option<ByteArray>,
}

pub type OutputPayoutDatum {
  datum_tag: Option<ByteArray>,
  ada_paid: Option<Int>,
}

pub type DispatchRedeemer {
  Split
  Merge
  Pay
}
