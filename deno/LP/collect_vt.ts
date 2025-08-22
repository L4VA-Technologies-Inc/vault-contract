import { Buffer } from "node:buffer";
import {
  Credential,
  EnterpriseAddress,
  ScriptHash,
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
import fs from "fs";
const X_API_KEY = "testnet_4Y4K4wORt4fK5TQyHeoRiqAvw7DFeuAzayhlvtG5";
const API_ENDPOINT = "http://localhost:3000";

const headers = {
  "x-api-key": X_API_KEY,
  "Content-Type": "application/json",
};

const CUSTOMER_ADDRESS = customer.base_address_preprod;
const ADMIN_KEY_HASH = admin.key_hash; // The keyhash of the generated private key to manage the vault
 
const CONTRIBUTION_SCRIPT_HASH = "9a9b0bc93c26a40952aaff525ac72a992a77ebfa29012c9cb4a72eb2";
const VAULT_ID =
  "65ad08cea14a4075f963d54142c9673ada4e6aae6e94eeef3ab185d4fd434992";
const LAST_UPDATE_TX_HASH =
  "e3ca727df0b97b709f71ecad23ded7fc7e52bfa4f32cb43c40bdb6d99db69443";
const LAST_UPDATE_TX_INDEX = 0;
const TX_HASH_INDEX_WITH_LPS_TO_COLLECT =
  "c492effa1138604371fd9e2af0943092274bb1077dc36742020cee5329a05a2a#0";
const index = async () => {
  const utxos = await getUtxos(Address.from_bech32(CUSTOMER_ADDRESS)); // Any UTXO works.
  if (utxos.length === 0) {
    throw new Error("No UTXOs found.");
  }

  const POLICY_ID = CONTRIBUTION_SCRIPT_HASH;
  const SC_ADDRESS = EnterpriseAddress.new(
    0,
    Credential.from_scripthash(ScriptHash.from_hex(POLICY_ID))
  )
    .to_address()
    .to_bech32();
  const lpsUnit = CONTRIBUTION_SCRIPT_HASH + "72656365697074";
  //Find the lps on the utxo to collect
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
    message: "Claim LPs from ada contribution",
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
          value:  {
              vault_token_output_index: 0,
              change_output_index: 1,
            }, 
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
        quantity: 4375000000000000,
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
            quantity: 4375000000000000,
          },
        ],
        datum: {
          type: "inline",
          value: PlutusData.new_bytes(Buffer.from(datumTag, "hex")).to_hex(),
        },
      },
      {
        address: SC_ADDRESS,
        lovelace: 50000000,
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

  const inputWithNoPreloaded = { ...input };
  //@ts-ignore
  delete inputWithNoPreloaded.preloadedScripts;
  console.log(JSON.stringify(inputWithNoPreloaded));
  fs.writeFileSync("./working_payload.json", JSON.stringify(input))
  
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
