import { Buffer } from "node:buffer";
import {
  Address,
  FixedTransaction,
  PrivateKey,
} from "@emurgo/cardano-serialization-lib-nodejs";

import {
  getUtxos,
  blockfrost, 
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

const CONTRIBUTION_SCRIPT_HASH = "9a9b0bc93c26a40952aaff525ac72a992a77ebfa29012c9cb4a72eb2"; 
const LAST_UPDATE_TX_HASH =
  "8d2f016aa13d1a7cb52e70a16b374216044cef4f71acb6fbd38a90f9b52b2b77";
const LAST_UPDATE_TX_INDEX = 0; // The index off the output in the transaction

const TX_HASH_INDEX_WITH_CONTRIBUTION_TO_CANCEL =
  "txhash#0";
const index = async () => {
  const utxos = await getUtxos(Address.from_bech32(CUSTOMER_ADDRESS)); // Any UTXO works.
  if (utxos.length === 0) {
    throw new Error("No UTXOs found.");
  }

  const POLICY_ID = CONTRIBUTION_SCRIPT_HASH;
  const lpsUnit = CONTRIBUTION_SCRIPT_HASH + "72656365697074";
  //Find the lps on the utxo to collect
  const [tx_hash, index] = TX_HASH_INDEX_WITH_CONTRIBUTION_TO_CANCEL.split("#");
  const txUtxos = await blockfrost.txsUtxos(tx_hash);
  const output = txUtxos.outputs[index];
  if (!output) {
    throw new Error("No output found");
  }
  const amountOfLpsToClaim = output.amount.find(
    (a: { unit: string; quantity: string }) => a.unit === lpsUnit
  ); 
  if (!amountOfLpsToClaim) {
    console.log(JSON.stringify(output));
    throw new Error("No lps to claim.");
  }
  const input: {
    changeAddress: string;
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
    message: "Cancel asset contribution",
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
            __variant: "CancelAsset",
            __data: { 
            },
          } satisfies Redeemer1,
        },
      },
      {
        purpose: "mint",
        hash: POLICY_ID,
        redeemer: {
          type: "json",
          value: "CancelContribution" satisfies Redeemer,
        },
      },
      
    ],
    mint: [ 
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
    ],
    requiredSigners: [customer.key_hash],
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

  const inputWithNoPreloaded = { ...input };
  //@ts-ignore
  delete inputWithNoPreloaded.preloadedScripts;
  console.log(JSON.stringify(inputWithNoPreloaded));

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
