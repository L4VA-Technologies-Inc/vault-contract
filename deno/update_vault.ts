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

import customer from "./wallets/customer.json" with { type: "json" };
import admin from "./wallets/admin.json" with { type: "json" };
import { Datum1 } from "./type.ts";

const X_API_KEY = "testnet_4Y4K4wORt4fK5TQyHeoRiqAvw7DFeuAzayhlvtG5";
const API_ENDPOINT = "https://preprod.api.ada-anvil.app/v2/services";

const headers = {
  "x-api-key": X_API_KEY,
  "Content-Type": "application/json",
};

const one_day = 24 * 60 * 60 * 1000;

const CUSTOMER_ADDRESS = customer.base_address_preprod;
const ADMIN_KEY_HASH = admin.key_hash;

const VAULT_ID =
  "1d52d08ef9bed08243e275cd4aed59756faaf0aeb6aa8a82cf50c49d4d4aa93a";
const POLICY_ID = "9122e54b6fb6a3c21dff97a6fd2bfce960c5e459a6061144e1ccd763";
const SC_ADDRESS = EnterpriseAddress.new(
  0,
  Credential.from_scripthash(ScriptHash.from_hex(POLICY_ID)),
)
  .to_address()
  .to_bech32();
const POLICIES_ALLOWED_IN_THE_VAULT = [
  "f7f5a12b681be1a2c02054414a726fefadd47e24b0343cd287c0283d",
  "c82a4452eaebccb82aced501b3c94d3662cf6cd2915ad7148b459aec"
];

const utxos = await getUtxos(Address.from_bech32(CUSTOMER_ADDRESS));
if (utxos.len() === 0) {
  throw new Error("No UTXOs found.");
}

const vaultUtxo = await getVaultUtxo(POLICY_ID, VAULT_ID);

const input = {
  changeAddress: CUSTOMER_ADDRESS,
  message: "Vault Update",
  scriptInteractions: [
    {
      purpose: "spend",
      outputRef: vaultUtxo,
      hash: POLICY_ID,
      redeemer: {
        type: "json",
        value: {
          vault_token_index: 0, // must fit the ordering defined in the outputs array
          asset_name: VAULT_ID,
        },
      },
    },
  ],
  outputs: [ 
    {
      address: SC_ADDRESS,
      assets: [
        {
          assetName: VAULT_ID,
          policyId: POLICY_ID,
          quantity: 1,
        },
      ],
      datum: {
        type: "inline",
        value: {
          vault_status: 2, //  0: pending, 1: open, 2: successful, 3: cancelled
          contract_type: 0, // Represent an enum setup by L4VA (0: PRIVATE | 1: PUBLIC | 2: SEMI_PRIVATE)
          asset_whitelist: POLICIES_ALLOWED_IN_THE_VAULT,
          // contributor_whitelist: [],
          asset_window: {
            // Time allowed to upload NFT
            lower_bound: {
              bound_type: new Date().getTime()  ,
              is_inclusive: true,
            },
            upper_bound: {
              bound_type: new Date().getTime(),
              is_inclusive: true,
            },
          },
          acquire_window: {
            // Time allowed to upload ADA
            lower_bound: {
              bound_type: new Date().getTime()  ,
              is_inclusive: true,
            },
            upper_bound: {
              bound_type: new Date().getTime() ,
              is_inclusive: true,
            },
          },
          valuation_type: 1, // Enum 0: 'FIXED' 1: 'LBE'
          // fractionalization: {
          //   percentage: 1,
          //   token_supply: 1,
          //   token_decimals: 1,
          //   token_policy: "",
          // },
          custom_metadata: [
            // <Data,Data>
            // [
            //   PlutusData.new_bytes(Buffer.from("foo")).to_hex(),
            //   PlutusData.new_bytes(Buffer.from("bar")).to_hex(),
            // ],
            [toHex("foo"), toHex("bar")],
            [toHex("bar"), toHex("foo")],
            [toHex("inc"), toHex("3")],
          ], // like a tuple

          // termination: {
          //   termination_type: 1,
          //   fdp: 1,
          // },
          // acquire: {
          //   reserve: 1,
          //   liquidityPool: 1,
          // },
          admin: ADMIN_KEY_HASH,
          minting_key: ADMIN_KEY_HASH,
          //Policy, assetName (can be empty for a wildcard) and multiplier
          acquire_multiplier: [["c82a4452eaebccb82aced501b3c94d3662cf6cd2915ad7148b459aec",undefined, 1], ["","",2]],
          ada_distribution: [["c82a4452eaebccb82aced501b3c94d3662cf6cd2915ad7148b459aec",undefined, 1000000]],
          ada_pair_multipler: 2
        } satisfies Datum1,
        shape: {
          validatorHash: POLICY_ID,
          purpose: "spend",
        },
      },
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
