use aiken/collection/dict.{size}
use cardano/assets.{
  AssetName, PolicyId, Value, add, flatten, match, merge, negate, quantity_of,
  restricted_to, to_dict, without_lovelace, zero,
}
use cardano/transaction.{Input, Output, OutputReference, Transaction}
use constant.{receipt_tag}
use datum.{find_datum}
use multiplier.{loop_throught_assets}
use own_ref_tag.{compare_datum_tag, generate_datum_tag}
use types.{AssetDatum, OutputPayoutDatum}

pub fn vt_on_output_with_correct_datum_and_owner(
  self: Transaction,
  output: Output,
  input_value: Value,
  datum: AssetDatum,
  own_ref: OutputReference,
  multiplier: Option<List<(PolicyId, Option<AssetName>, Int)>>,
  ada_paid: Option<Int>,
) {
  let amount_of_policies =
    (
      input_value
        |> to_dict
        |> size
    ) - (
      input_value
        |> quantity_of(datum.policy_id, receipt_tag)
    )
  //confirm that the address received the Lp 
  let amount_on_output =
    output.value |> quantity_of(datum.policy_id, datum.asset_name)

  let expected_amount_on_output =
    when amount_of_policies is {
      1 -> loop_throught_assets(multiplier, flatten(input_value), 0)
      _ ->
        loop_throught_assets(
          multiplier,
          flatten(input_value |> without_lovelace),
          0,
        )
    }
  let lp_is_on_output = amount_on_output == expected_amount_on_output

  let output_is_receiver = output.address == datum.owner

  let output_datum = find_datum(output, self)
  expect Some(output_datum) = output_datum
  expect output_datum: OutputPayoutDatum = output_datum
  
  let expected_output_datum = OutputPayoutDatum {
    datum_tag: Some(generate_datum_tag(own_ref)),
    ada_paid: ada_paid,
  }
  
  let output_contains_correct_datum = output_datum == expected_output_datum
  and {
    lp_is_on_output?,
    output_is_receiver?,
    output_contains_correct_datum?,
  }
}

pub fn owner_is_refunded_with_correct_datum(
  self: Transaction,
  output: Output,
  input: Input,
  datum: AssetDatum,
  own_ref: OutputReference,
) {
  let output_should_match =
    input.output.value |> add(datum.policy_id, receipt_tag, -1)

  let output_contains_right_value = match(output.value, output_should_match, >=)

  let output_is_receiver = output.address == datum.owner

  let output_datum = find_datum(output, self)
  expect Some(output_datum) = output_datum
  let output_contains_datum_tag = compare_datum_tag(output_datum, own_ref)
  and {
    output_contains_right_value?,
    output_is_receiver?,
    output_contains_datum_tag?,
  }
}

pub fn change_match_the_input(
  self: Transaction,
  output: Output,
  input: Input,
  datum: AssetDatum,
  own_ref: OutputReference,
) {
  //confirm that the address received the Lp
  let amount_on_input = input.output.value |> restricted_to([datum.policy_id])
  expect amount_on_input != zero

  let amount_on_output = input.output.value |> merge(negate(amount_on_input))
  let output_contains_the_right_value =
    output.value |> match(amount_on_output, >=)
  let output_address_is_the_same = output.address == input.output.address
  let input_datum = find_datum(input.output, self)
  expect Some(input_datum) = input_datum
  expect input_datum: AssetDatum = input_datum
  let expected_output_datum =
    AssetDatum { ..input_datum, datum_tag: Some(generate_datum_tag(own_ref)) }
  let datum = find_datum(output, self)
  expect Some(datum) = datum
  expect datum: AssetDatum = datum

  let input_and_output_datum_match = expected_output_datum == datum
  and {
    output_contains_the_right_value?,
    output_address_is_the_same?,
    input_and_output_datum_match?,
  }
}
