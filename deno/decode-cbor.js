const CSL = require('@emurgo/cardano-serialization-lib-nodejs');

const cborHex = ""; // Paste your CBOR hex string here

const tx = CSL.Transaction.from_bytes(Buffer.from(cborHex, 'hex'));
const body = tx.body();

console.log('=== TRANSACTION DETAILS ===\n');

// Inputs
console.log('INPUTS:');
const inputs = body.inputs();
for (let i = 0; i < inputs.len(); i++) {
  const input = inputs.get(i);
  console.log(`  ${i}: ${input.transaction_id().to_hex()}#${input.index()}`);
}

// Outputs
console.log('\nOUTPUTS:');
const outputs = body.outputs();
for (let i = 0; i < outputs.len(); i++) {
  const output = outputs.get(i);
  console.log(`  ${i}: ${output.address().to_bech32()} - ${output.amount().coin().to_str()} lovelace`);
  
  const multiAsset = output.amount().multiasset();
  if (multiAsset) {
    const policyIds = multiAsset.keys();
    for (let j = 0; j < policyIds.len(); j++) {
      const policyId = policyIds.get(j);
      const assets = multiAsset.get(policyId);
      const assetNames = assets.keys();
      for (let k = 0; k < assetNames.len(); k++) {
        const assetName = assetNames.get(k);
        const amount = assets.get(assetName);
        console.log(`      + ${amount.to_str()} ${Buffer.from(assetName.name()).toString('hex')}`);
      }
    }
  }
}

// Fee
console.log(`\nFEE: ${body.fee().to_str()} lovelace`);

// Required Signers
const reqSigners = body.required_signers();
if (reqSigners) {
  console.log('\nREQUIRED SIGNERS:');
  for (let i = 0; i < reqSigners.len(); i++) {
    console.log(`  ${i}: ${reqSigners.get(i).to_hex()}`);
  }
}

// Witness Set
const witnessSet = tx.witness_set();
const vkeys = witnessSet.vkeys();
if (vkeys) {
  console.log('\nVKEY WITNESSES:');
  for (let i = 0; i < vkeys.len(); i++) {
    const vkey = vkeys.get(i);
    console.log(`  ${i}: ${vkey.vkey().public_key().hash().to_hex()}`);
  }
}
