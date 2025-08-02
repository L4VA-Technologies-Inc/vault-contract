import { Buffer } from "node:buffer";
import {
  Credential,
  EnterpriseAddress,
  ScriptHash,
  Address,
  FixedTransaction,
  PrivateKey,
} from "npm:@emurgo/cardano-serialization-lib-nodejs@14.1.0";

import { getUtxos, getVaultUtxo, toHex } from "./lib.ts";

// 1 wallet = customer.json
import customer from "./wallets/customer.json" with { type: "json" };
// 1 wallet = admin.json
import admin from "./wallets/admin.json" with { type: "json" };

const X_API_KEY = "testnet_4Y4K4wORt4fK5TQyHeoRiqAvw7DFeuAzayhlvtG5";
const API_ENDPOINT = "https://preprod.api.ada-anvil.app/v2/services";

const headers = {
  "x-api-key": X_API_KEY,
  "Content-Type": "application/json",
};
 
const CUSTOMER_ADDRESS = customer.base_address_preprod;
const ADMIN_KEY_HASH = admin.key_hash; // The keyhash of the generated private key to manage the vault

const VAULT_ID =
  "12df32c23ae6a4c6d0295632f55e844f4f1a517bebae6c931e1e31f6875e573a"; // Represented by the assetname minted using mod.ts.
const POLICY_ID = "d4915ac1dd9ef95493351cfaa2a6c9a85086472f12523999b5e32aeb"; // same as script hash, do not change unless new smart contract deployed. 

const utxos = await getUtxos(Address.from_bech32(CUSTOMER_ADDRESS)); // Any UTXO works.
if (utxos.len() === 0) {
  throw new Error("No UTXOs found.");
}

const vaultUtxo = await getVaultUtxo(POLICY_ID, VAULT_ID);

const input = {
  changeAddress: CUSTOMER_ADDRESS,
  message: "Vault Burn",
  scriptInteractions: [
    {
      purpose: "spend",
      outputRef: vaultUtxo,
      hash: POLICY_ID,
      redeemer: {
        type: "json",
        value: "VaultBurn",
      },
    },
    {
      purpose: "mint", 
      hash: POLICY_ID,
      redeemer: {
        type: "json",
        value: "VaultBurn",
      },
    },
  ], 
  mint: [
    {
      version: "cip25",
      assetName: {name:VAULT_ID, format:"hex"}, 
      policyId: POLICY_ID,
      type: "plutus",
      quantity: -1, 
    },
  ],
  requiredSigners: [ADMIN_KEY_HASH],
};

console.log(JSON.stringify(input, null, 2));

const contractDeployed = await fetch(`${API_ENDPOINT}/transactions/build`, {
  method: "POST",
  headers,
  body: JSON.stringify(input),
});

const transaction = await contractDeployed.json();
console.log(JSON.stringify(transaction));

// Sign the transaction using CSL.
const txToSubmitOnChain = FixedTransaction.from_bytes(
  Buffer.from(transaction.complete, "hex"),
);
txToSubmitOnChain.sign_and_add_vkey_signature(
  PrivateKey.from_bech32(customer.skey),
);
txToSubmitOnChain.sign_and_add_vkey_signature(
  PrivateKey.from_bech32(admin.skey),
);

const urlSubmit = `${API_ENDPOINT}/transactions/submit`;
const submitted = await fetch(urlSubmit, {
  method: "POST",
  headers,
  body: JSON.stringify({
    signatures: [], // no signature required as it is part of the `txToSubmitOnChain`.
    transaction: txToSubmitOnChain.to_hex(),
  }),
});

const output = await submitted.json();
console.debug(output);
