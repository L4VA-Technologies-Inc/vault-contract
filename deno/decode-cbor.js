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

// Metadata (Auxiliary Data)
const auxData = tx.auxiliary_data();
if (auxData) {
  console.log('\n=== METADATA ===');
  const metadata = auxData.metadata();
  if (metadata) {
    const keys = metadata.keys();
    for (let i = 0; i < keys.len(); i++) {
      const key = keys.get(i);
      const value = metadata.get(key);
      console.log(`\nLabel ${key.to_str()}:`);
      
      // Recursively decode metadata structure
      const decodeMetadata = (metadatum) => {
        const kind = metadatum.kind();
        
        if (kind === 0) { // Map
          const map = metadatum.as_map();
          const result = {};
          const mapKeys = map.keys();
          for (let j = 0; j < mapKeys.len(); j++) {
            const k = mapKeys.get(j);
            const v = map.get(k);
            result[decodeMetadata(k)] = decodeMetadata(v);
          }
          return result;
        } else if (kind === 1) { // List
          const list = metadatum.as_list();
          const result = [];
          for (let j = 0; j < list.len(); j++) {
            result.push(decodeMetadata(list.get(j)));
          }
          return result;
        } else if (kind === 2) { // Int
          return metadatum.as_int().to_str();
        } else if (kind === 3) { // Bytes
          return Buffer.from(metadatum.as_bytes()).toString('hex');
        } else if (kind === 4) { // Text
          return metadatum.as_text();
        }
        return null;
      };
      
      console.log(JSON.stringify(decodeMetadata(value), null, 2));
    }
  }
} else {
  console.log('\n=== NO METADATA ===');
}

