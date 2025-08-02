use aiken/collection/list.{has}
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{
  AssetName, PolicyId, Value, flatten, from_asset_list, without_lovelace,
}

pub fn asset_are_whitelisted(value: Value, policy_ids: List<PolicyId>) {
  //Ignore ada  
  loop_throught_assets(flatten(without_lovelace(value)), policy_ids)
}

//One of the signature is whitelisted
pub fn contributor_whitelisted(
  signators: List<VerificationKeyHash>,
  whitelist: List<VerificationKeyHash>,
) -> Bool {
  when signators is {
    [] -> False
    [signator, ..rest] -> {
      let is_whitelisted = whitelist |> has(signator)
      if is_whitelisted {
        True
      } else {
        contributor_whitelisted(rest, whitelist)
      }
    }
  }
}

pub fn loop_throught_assets(
  assets: List<(PolicyId, AssetName, Int)>,
  policy_ids: List<PolicyId>,
) -> Bool {
  when assets is {
    [] -> True
    [(policy_id, _assetname, _quantity), ..rest] -> {
      let is_whitelisted = policy_ids |> has(policy_id)
      if is_whitelisted {
        loop_throught_assets(rest, policy_ids)
      } else {
        False
      }
    }
  }
}

test one_asset_whitelisted() {
  let policy_ids = [#"123123", #"1231231231"]
  let value = from_asset_list([Pair(#"123123", [Pair(#"", 1)])])
  expect asset_are_whitelisted(value, policy_ids)
}

test multiple_assets_whitelisted() {
  let policy_ids = [#"123123", #"1231231231"]
  let value =
    from_asset_list(
      [Pair(#"123123", [Pair(#"", 1)]), Pair(#"1231231231", [Pair(#"1234", 1)])],
    )
  expect asset_are_whitelisted(value, policy_ids)
}

test asset_not_whitelisted() fail {
  let policy_ids = [#"123123", #"1231231231"]
  let value =
    from_asset_list(
      [Pair(#"2222", [Pair(#"", 1)]), Pair(#"123123", [Pair(#"1234", 1)])],
    )
  expect asset_are_whitelisted(value, policy_ids)
}
