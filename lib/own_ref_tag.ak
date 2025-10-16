use aiken/builtin.{blake2b_256, serialise_data}
use cardano/transaction.{Input, OutputReference}

pub fn generate_datum_tag(out_ref: OutputReference) {
  out_ref
    |> serialise_data
    |> blake2b_256
}

pub fn compare_datum_tag(datum: Data, out_ref: OutputReference) -> Bool {
  serialise_data(generate_datum_tag(out_ref)) == serialise_data(datum)
}

pub fn validate_tag_in_inputs(inputs: List<Input>, tag: ByteArray) -> Bool {
  when inputs is {
    [] -> False
    [input, ..rest] -> {
      let input_tag = generate_datum_tag(input.output_reference)
      if input_tag == tag {
        True
      } else {
        validate_tag_in_inputs(rest, tag)
      }
    }
  }
}

test generate_tag() {
  let out_ref =
    OutputReference {
      transaction_id: #"9acffdbf5042f8cc544a8141a7e60eff9d328db4064a20a17f5b0645ab2a0569",
      output_index: 0,
    }
  let tag = generate_datum_tag(out_ref)
  let hardcoded_tag =
    #"df3d7dc1a636919101dd293239564ab53910acd2fb5fb5c245568d67e52340b0"
  tag == hardcoded_tag
}

test generate_tag_v2() {
  let out_ref =
    OutputReference {
      transaction_id: #"8b3eb2749d56faf16d79d21b5ef9e4ab89809ebd5add2fc6444ff7cf37c77f24",
      output_index: 0,
    }
  let tag = generate_datum_tag(out_ref)
  let hardcoded_tag =
    #"bda6467c2511f34b2e23b20d9fef027960ad1fdae04805633bf62813f9210d34"
  tag == hardcoded_tag
}

test generate_tag_wrong() fail {
  let out_ref =
    OutputReference {
      transaction_id: #"ff6ffddfe2206bb47bf5e1d1d79bbb2d702519a5d5b6b3f95aeeb080141ae877",
      output_index: 0,
    }
  let tag = generate_datum_tag(out_ref)
  let hardcoded_tag =
    #"7f3bbc09949abafc21ec672115c1f9e229e508434deddac58928e85de7f450e5"
  tag == hardcoded_tag
}

test compare_tag() {
  let out_ref =
    OutputReference {
      transaction_id: #"ef6ffddfe2206bb47bf5e1d1d79bbb2d702519a5d5b6b3f95aeeb080141ae877",
      output_index: 0,
    }

  let hardcoded_tag =
    #"7f3bbc09949abafc21ec672115c1f9e229e508434deddac58928e85de7f450e5"

  compare_datum_tag(hardcoded_tag, out_ref)
}

test compare_tag_prod() {
  let out_ref =
    OutputReference {
      transaction_id: #"8e2576ae0465fe453c40b5466c278bebeb5bf266fd713a5b5dc0f7019d5b4d4b",
      output_index: 0,
    }

  let hardcoded_tag =
    #"3ba680ef14f352d6f6d02cbf369bbad3da7434ba0d043f7ff92a4e695e17de33"

  compare_datum_tag(hardcoded_tag, out_ref)
}
