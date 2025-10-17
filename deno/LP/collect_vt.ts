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

import customer from "../wallets/customer.json";
import admin from "../wallets/admin.json";
import type { Datum, Redeemer, Redeemer1 } from "../type.ts";
import scriptHashes from "../script-hashes.json" with { type: "json" };
import vaultParams from "./vault-parameters.json" with { type: "json" };
import fs from "fs";

const X_API_KEY = "testnet_4Y4K4wORt4fK5TQyHeoRiqAvw7DFeuAzayhlvtG5";
const API_ENDPOINT = "https://preprod.api.ada-anvil.app/v2/services";

const headers = {
  "x-api-key": X_API_KEY,
  "Content-Type": "application/json",
};

const CUSTOMER_ADDRESS = customer.base_address_preprod;
const ADMIN_KEY_HASH = admin.key_hash;

const CONTRIBUTION_SCRIPT_HASH = vaultParams.contribution_parametized_hash;
const DISPATCH_SCRIPT_HASH = scriptHashes.dispatch_script_hash;
const VAULT_ID = vaultParams.vault_id;
const LAST_UPDATE_TX_HASH = vaultParams.last_update_tx_hash;
const LAST_UPDATE_TX_INDEX = vaultParams.last_update_tx_index;
const TX_HASH_INDEX_WITH_LPS_TO_COLLECT =
  "c492effa1138604371fd9e2af0943092274bb1077dc36742020cee5329a05a2a#0";
const DISPATCH_UTXO_TX_HASH = vaultParams.dispatch_utxo_tx_hash;
const DISPATCH_UTXO_INDEX = vaultParams.dispatch_utxo_index;
const index = async () => {
  const utxos = await getUtxos(Address.from_bech32(CUSTOMER_ADDRESS));
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

  // Check if this is an asset contribution (has non-ADA assets)
  const hasAssets = output.amount.some((a: { unit: string }) =>
    a.unit !== "lovelace" && a.unit !== lpsUnit
  );

  // Create dispatch script address for asset contributions
  const DISPATCH_ADDRESS = EnterpriseAddress.new(
    0, // preprod network
    Credential.from_scripthash(ScriptHash.from_hex(DISPATCH_SCRIPT_HASH))
  ).to_address().to_bech32();
  const input: {
    changeAddress: string;
    message: string;
    mint?: Array<object>;
    scriptInteractions: object[];
    outputs: {
      address: string;
      assets?: object[];
      lovelace?: number;
      datum?: { type: "inline"; value: string | Datum | { datum_tag: string; ada_paid: number }; shape?: object };
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
    message: hasAssets ? "Claim LPs from asset contribution and collect ADA from dispatch" : "Claim LPs from ada contribution",
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
            vault_token_output_index: 0,
            change_output_index: hasAssets ? 2 : 1, // Account for dispatch output
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
      // Add dispatch interactions for asset contributions
      ...(hasAssets ? [
        {
          purpose: "spend",
          hash: DISPATCH_SCRIPT_HASH,
          outputRef: {
            txHash: DISPATCH_UTXO_TX_HASH,
            index: DISPATCH_UTXO_INDEX,
          },
          redeemer: {
            type: "json",
            value: null, // Dispatch spend redeemer
          },
        },
        {
          purpose: "withdraw",
          hash: DISPATCH_SCRIPT_HASH,
          redeemer: {
            type: "json",
            value: null, // Dispatch withdraw redeemer
          },
        },
      ] : []),
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
        lovelace: hasAssets ? 5000000 : undefined, // Add ADA from dispatch for asset contributions
        datum: {
          type: "inline",
          value: {
            datum_tag: PlutusData.new_bytes(Buffer.from(datumTag, "hex")).to_hex(),
            ada_paid: 5000000,
          },
          shape: {
            validatorHash: POLICY_ID,
            purpose: "spend",
          }
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
