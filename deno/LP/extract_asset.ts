import { Buffer } from "node:buffer";
import { 
  Address,
  FixedTransaction,
  PrivateKey,
  PlutusData,
} from "@emurgo/cardano-serialization-lib-nodejs";

import {
  getUtxos,
  blockfrost,
  generate_tag_from_txhash_index,
} from "../lib-js.ts";

// 1 wallet = customer.json
import customer from "../wallets/customer.json";
// 1 wallet = admin.json
import admin from "../wallets/admin.json";
import type { Datum, Redeemer, Redeemer1 } from "../type.ts"; 
const X_API_KEY = "testnet_4Y4K4wORt4fK5TQyHeoRiqAvw7DFeuAzayhlvtG5";
const API_ENDPOINT = "https://preprod.api.ada-anvil.app/v2/services";

const headers = {
  "x-api-key": X_API_KEY,
  "Content-Type": "application/json",
};

const CUSTOMER_ADDRESS = customer.base_address_preprod;
const ADMIN_KEY_HASH = admin.key_hash; // The keyhash of the generated private key to manage the vault

const CONTRIBUTION_SCRIPT_HASH = "9a9b0bc93c26a40952aaff525ac72a992a77ebfa29012c9cb4a72eb2";
  const VAULT_ID =
  "d18912e96a3196e26be360f5ecf3496a5a0d65978a4794182717059c227215b9"; // The vault ID, used to identify the vault in the smart contract.
const LAST_UPDATE_TX_HASH =
  "74aef3bfc5c824e06cd707260faadeb0d4dcd2f3efb8fd9150640c9fbd364e5f";
const LAST_UPDATE_TX_INDEX = 0; // The index off the output in the transaction

const TX_HASH_INDEX_WITH_LPS_TO_COLLECT =
  "d8ed53d03d7f37544c40d777580e00451fa1379039509f51d535814145c29d70#0";
const index = async () => {
  const utxos = await getUtxos(Address.from_bech32(CUSTOMER_ADDRESS)); // Any UTXO works.
 

  const POLICY_ID = CONTRIBUTION_SCRIPT_HASH;
  const lpsUnit = CONTRIBUTION_SCRIPT_HASH + "72656365697074";
  // Find the receipt token on the UTXO to extract assets from
  const [tx_hash, index] = TX_HASH_INDEX_WITH_LPS_TO_COLLECT.split("#");
  const txUtxos = await blockfrost.txsUtxos(tx_hash);
  const output = txUtxos.outputs[index];
  if (!output) {
    throw new Error("No output found");
  }
  const amountOfLpsToClaim = output.amount.find(
    (a: { unit: string; quantity: string }) => a.unit === lpsUnit
  );
  const datumTag = generate_tag_from_txhash_index(tx_hash, Number(index));
  if (!amountOfLpsToClaim) {
    console.log(JSON.stringify(output));
    throw new Error("No lps to claim.");
  }
  const input: {
    changeAddress: string;
    utxos: string[],
    message: string;
    mint?: Array<object>;
    scriptInteractions: object[];
    outputs: {
      address: string;
      assets?: object[];
      lovelace?: number;
      datum?: { type: "inline"; value: string | Datum; shape?: object };
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
    utxos,
    message: "Admin extract asset",
    scriptInteractions: [
      {
        purpose: "spend",
        hash: POLICY_ID,
        outputRef: {
          txHash: tx_hash,
          index: index,
        },
        redeemer: {
          type: "json",
          value: {
            __variant: "ExtractAsset",
            __data: {
              vault_token_output_index: 0,
            },
          } satisfies Redeemer1,
        },
      },
      {
        purpose: "mint",
        hash: POLICY_ID,
        redeemer: {
          type: "json",
          value: "MintVaultToken" satisfies Redeemer,
        },
      },
    ],
    mint: [
      {
        version: "cip25",
        assetName: { name: VAULT_ID, format: "hex" },
        policyId: POLICY_ID,
        type: "plutus",
        quantity: 5,
        metadata: {},
      },
      {
        version: "cip25",
        assetName: { name: "receipt", format: "utf8" },
        policyId: POLICY_ID,
        type: "plutus",
        quantity: -1,
        metadata: {},
      },
    ],
    outputs: [
      {
        address: customer.base_address_preprod,
        assets: [
          {
            assetName: { name: VAULT_ID, format: "hex" },
            policyId: CONTRIBUTION_SCRIPT_HASH,
            quantity: 5,
          },
        ],
        datum: {
          type: "inline",
          value: PlutusData.new_bytes(Buffer.from(datumTag, "hex")).to_hex(),
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

  console.log(JSON.stringify(input));

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

  const submittedTx = await submitted.json();
  console.debug(submittedTx);
};

index();
