import { Buffer } from "node:buffer";
import {
  Credential,
  EnterpriseAddress,
  ScriptHash,
  Address,
  FixedTransaction,
  PrivateKey,
} from "@emurgo/cardano-serialization-lib-nodejs";

import { getUtxos } from "../lib-js.ts";

// 1 wallet = customer.json
import customer from "../wallets/customer.json";
// 1 wallet = admin.json
import admin from "../wallets/admin.json";
import type { Datum, Redeemer } from "../type.ts"; 
const X_API_KEY = "testnet_4Y4K4wORt4fK5TQyHeoRiqAvw7DFeuAzayhlvtG5";
const API_ENDPOINT = "https://preprod.api.ada-anvil.app/v2/services";

const headers = {
  "x-api-key": X_API_KEY,
  "Content-Type": "application/json",
};

const CUSTOMER_ADDRESS = customer.base_address_preprod;
const ADMIN_KEY_HASH = admin.key_hash; // The keyhash of the generated private key to manage the vault

const CONTRIBUTION_SCRIPT_HASH = "a8a0a77ac72610ef364ebf64c5a6101440ffb7ce863f4c47c88eba26";
const VAULT_ID = "d5a599c878766b21b8ac4037cf26a3c8223830aa77a130828c9beb7fb235f68d";
const LAST_UPDATE_TX_HASH =
  "7e7e31664d1dd4a596c600a5b263d161ad9d205c6a81b2ba502671784d3a4e8e";
const LAST_UPDATE_TX_INDEX = 0; // The index off the output in the transaction
const index = async () => {
  const utxos = await getUtxos(Address.from_bech32(CUSTOMER_ADDRESS)); // Any UTXO works.
  if (utxos.length=== 0) {
    throw new Error("No UTXOs found.");
  }

  const POLICY_ID = CONTRIBUTION_SCRIPT_HASH;
  const SC_ADDRESS = EnterpriseAddress.new(
    0,
    Credential.from_scripthash(ScriptHash.from_hex(POLICY_ID))
  )
    .to_address()
    .to_bech32();
  const input: {
    changeAddress: string;
    message: string;
    mint: Array<object>;
    scriptInteractions: object[];
    outputs: {
      address: string;
      assets: object[];
      lovelace: number;
      datum: { type: "inline"; value: Datum; shape: object };
    }[];
    requiredSigners: string[];
    referenceInputs: { txHash: string; index: number }[];
    validityInterval: {
      start: boolean;
      end: boolean;
    };
    network: string;
  } = {
    changeAddress: CUSTOMER_ADDRESS,
    message: "Contribution in ADA",
    mint: [
      {
        version: "cip25",
        assetName: { name: "receipt", format: "utf8" },
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
            output_index: 0,
            contribution: "Lovelace",
          } satisfies Redeemer,
        },
      },
    ],
    outputs: [
      {
        address: SC_ADDRESS,
        lovelace: 10000000,
        assets: [
          {
            assetName: { name: "receipt", format: "utf8" },
            policyId: POLICY_ID,
            quantity: 1,
          },
        ],
        datum: {
          type: "inline",
          value: {
            policy_id: POLICY_ID,
            asset_name: VAULT_ID,
            owner: CUSTOMER_ADDRESS,
          },
          shape: {
            validatorHash: POLICY_ID,
            purpose: "spend",
          },
        },
      },
    ],
    requiredSigners: [ADMIN_KEY_HASH],
    referenceInputs: [
      {
        txHash: LAST_UPDATE_TX_HASH,
        index: LAST_UPDATE_TX_INDEX,
      },
    ],
    validityInterval: {
      start: true,
      end: true,
    },
    network: "preprod",
  };

  const toLogInput = { ...input, preloadedScripts: {} };

  console.log(JSON.stringify(toLogInput));

  const contractDeployed = await fetch(`${API_ENDPOINT}/transactions/build`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });

  const transaction = await contractDeployed.json();
  console.log(JSON.stringify(transaction));

  // Sign the transaction using CSL.
  const txToSubmitOnChain = FixedTransaction.from_bytes(
    Buffer.from(transaction.complete, "hex")
  );
  txToSubmitOnChain.sign_and_add_vkey_signature(
    PrivateKey.from_bech32(customer.skey)
  );
  txToSubmitOnChain.sign_and_add_vkey_signature(
    PrivateKey.from_bech32(admin.skey)
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
};

index();
