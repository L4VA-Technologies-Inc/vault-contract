use cardano/assets.{AssetName, PolicyId}

pub fn multiplier_given_asset(
  self: List<(PolicyId, Option<AssetName>, Int)>,
  policy_id: PolicyId,
  asset_name: AssetName,
) -> Int {
  when self is {
    [] -> 0
    [(policy, assetname, mult), ..rest] ->
      if policy == policy_id {
        when assetname is {
          None -> mult
          Some(assetname) ->
            if assetname == asset_name {
              mult
            } else {
              multiplier_given_asset(rest, policy_id, asset_name)
            }
        }
      } else {
        multiplier_given_asset(rest, policy_id, asset_name)
      }
  }
}

pub fn loop_throught_assets(
  self: Option<List<(PolicyId, Option<AssetName>, Int)>>,
  value: List<(PolicyId, AssetName, Int)>,
  accumulator: Int,
) {
  when self is {
    None -> accumulator
    Some(mults) ->
      when value is {
        [] -> accumulator
        [(policy_id, asset_name, quantity), ..rest] -> {
          let multiplier = multiplier_given_asset(mults, policy_id, asset_name)
          let new_accumulator = accumulator + multiplier * quantity
          loop_throught_assets(self, rest, new_accumulator)
        }
      }
  }
}
