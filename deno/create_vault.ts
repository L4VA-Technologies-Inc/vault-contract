import { Buffer } from "node:buffer";
import {
  Credential,
  EnterpriseAddress,
  ScriptHash,
  Address,
  FixedTransaction,
  PrivateKey,
} from "npm:@emurgo/cardano-serialization-lib-nodejs@14.1.0";

import {
  generate_tag_from_txhash_index,
  getUtxos,
  toHex,
} from "./lib.ts";

// 1 wallet = customer.json
import customer from "./wallets/customer.json" with { type: "json" };
// 1 wallet = admin.json
import admin from "./wallets/admin.json" with { type: "json" };
import type { Datum1 } from "./type.ts";

const one_day = 24 * 60 * 60 * 1000;

const X_API_KEY = "testnet_4Y4K4wORt4fK5TQyHeoRiqAvw7DFeuAzayhlvtG5";
const API_ENDPOINT = "https://preprod.api.ada-anvil.app/v2/services";

const headers = {
  "x-api-key": X_API_KEY,
  "Content-Type": "application/json",
};

const CUSTOMER_ADDRESS = customer.base_address_preprod;
const ADMIN_KEY_HASH = admin.key_hash; // The keyhash of the generated private key to manage the vault

const POLICY_ID = "d4915ac1dd9ef95493351cfaa2a6c9a85086472f12523999b5e32aeb"; // same as script hash, do not change unless new smart contract deployed.
const SC_ADDRESS = EnterpriseAddress.new(
  0,
  Credential.from_scripthash(ScriptHash.from_hex(POLICY_ID)),
)
  .to_address()
  .to_bech32();
const POLICIES_ALLOWED_IN_THE_VAULT = [
  "b28533ab183e0146552d8d97a6111e7ec56afa389d76357cf2b3feff",
  "c82a4452eaebccb82aced501b3c94d3662cf6cd2915ad7148b459aec"
]; // testnet baby sneklet, can be anything, represents the allow assets in the vault

const utxos = await getUtxos(Address.from_bech32(CUSTOMER_ADDRESS)); // Any UTXO works.
if (utxos.len() === 0) {
  throw new Error("No UTXOs found.");
}

const selectedUtxo = utxos.get(0);
const REQUIRED_INPUTS = [selectedUtxo.to_hex()];
const assetName = generate_tag_from_txhash_index(
  selectedUtxo.input().transaction_id().to_hex(),
  selectedUtxo.input().index(),
);

const input: {
  changeAddress: string;
  message: string;
  mint: Array<object>;
  scriptInteractions: object[];
  outputs: {
    address: string;
    assets: object[];
    datum: { type: "inline"; value: Datum1; shape: object };
  }[];
  requiredInputs: string[];
} = {
  changeAddress: CUSTOMER_ADDRESS,
  message: "Vault",
  mint: [
    {
      version: "cip25",
      assetName: {name:assetName, format:"hex"}, 
      policyId: POLICY_ID,
      type: "plutus",
      quantity: 1,
      metadata: {},
    },
  ],
  scriptInteractions: [
    {
      purpose: "mint",
      hash: POLICY_ID,
      redeemer: {
        type: "json",
        value: {
          vault_token_index: 0,
          asset_name: assetName,
        },
      },
    },
  ],
  outputs: [
    {
      address: SC_ADDRESS,
      assets: [
        {
          assetName: {name:assetName, format:"hex"},
          policyId: POLICY_ID,
          quantity: 1,
        },
      ],
      datum: {
        type: "inline",
        value: {
          vault_status: 1, //  0: pending, 1: open, 2: successful, 3: cancelled
          contract_type: 0, // Represent an enum setup by L4VA (0: PRIVATE | 1: PUBLIC | 2: SEMI_PRIVATE)
          asset_whitelist: POLICIES_ALLOWED_IN_THE_VAULT,
          // contributor_whitelist: [],
          asset_window: {
            // Time allowed to upload NFT
            lower_bound: {
              bound_type: new Date().getTime() ,
              is_inclusive: true,
            },
            upper_bound: {
              bound_type: new Date().getTime() + one_day * 7,
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
              bound_type: new Date().getTime() + one_day * 7,
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
            [toHex("inc"), toHex("1")],
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
          minting_key: ADMIN_KEY_HASH
        },
        shape: {
          validatorHash: POLICY_ID,
          purpose: "spend",
        },
      },
    },
  ],
  requiredInputs: REQUIRED_INPUTS,
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
