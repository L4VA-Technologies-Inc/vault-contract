import { Buffer } from "node:buffer";
import {
  Address,
  EnterpriseAddress,
  ScriptHash,
  Credential,
  FixedTransaction,
  PrivateKey,
  PlutusData,
  PlutusList,
  BigInt as CSLBigInt,
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
import scriptHashes from "../script-hashes.json" with { type: "json" };
import vaultParams from "./vault-parameters.json" with { type: "json" };
import { applyDispatchParameters } from "./dispatch-helper.ts";

const X_API_KEY = "testnet_4Y4K4wORt4fK5TQyHeoRiqAvw7DFeuAzayhlvtG5";
const API_ENDPOINT = "https://preprod.api.ada-anvil.app/v2/services";

const headers = {
  "x-api-key": X_API_KEY,
  "Content-Type": "application/json",
};

const CUSTOMER_ADDRESS = customer.base_address_preprod;
const ADMIN_KEY_HASH = admin.key_hash; // The keyhash of the generated private key to manage the vault

const CONTRIBUTION_SCRIPT_HASH = vaultParams.contribution_parametized_hash; 
const VAULT_ID = vaultParams.vault_id; // The vault ID, used to identify the vault in the smart contract.
const LAST_UPDATE_TX_HASH = vaultParams.last_update_tx_hash;
const LAST_UPDATE_TX_INDEX = vaultParams.last_update_tx_index;

const TX_HASH_INDEX_WITH_LPS_TO_COLLECT =
  "0a755f8e8f80a82d881258d7ce37c16dd33341c6342f638ce6d64af6babd24f9#0";
const index = async () => {
  const utxos = await getUtxos(Address.from_bech32(CUSTOMER_ADDRESS)); // Any UTXO works.
  if (utxos.length === 0) {
    throw new Error("No UTXOs found.");
  }

  // Apply parameters to dispatch script to get the correct parameterized hash
  console.log("Applying parameters to dispatch script...");
  const dispatchResult = await applyDispatchParameters(
    scriptHashes.vault_policy_id,
    vaultParams.vault_id,
    vaultParams.contribution_parametized_hash
  );

  const PARAMETERIZED_DISPATCH_HASH = dispatchResult.parameterizedHash;
  console.log(`Using parameterized dispatch hash: ${PARAMETERIZED_DISPATCH_HASH}`);

  const POLICY_ID = CONTRIBUTION_SCRIPT_HASH;
  const lpsUnit = CONTRIBUTION_SCRIPT_HASH + "72656365697074";

  // Create dispatch script address using the parameterized hash
  const DISPATCH_ADDRESS = EnterpriseAddress.new(
    0, // preprod network
    Credential.from_scripthash(ScriptHash.from_hex(PARAMETERIZED_DISPATCH_HASH))
  ).to_address().to_bech32();

  console.log(`Dispatch address: ${DISPATCH_ADDRESS}`);
  // Find the receipt token on the UTXO to extract lovelace from
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
      datum?: { type: "inline"; value: any; shape?: object };
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
    message: "Admin extract ADA and send to dispatch script",
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
            __variant: "ExtractAda",
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
        quantity: 10000000 * 2 + 10000000 * 2,
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
            quantity: 10000000 * 2,
          },
        ],
        datum: {
          type: "inline",
          value: {
            datum_tag: datumTag,
            ada_paid: undefined
          },
          shape: {
            validatorHash: scriptHashes.dispatch_script_hash,
            purpose: "spend"
          },
        },
      },
      {
        address: DISPATCH_ADDRESS,
        lovelace: 10000000, // Send extracted ADA to dispatch script 
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
