import { Buffer } from "node:buffer";
import {
  Address,
  EnterpriseAddress,
  ScriptHash,
  Credential,
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
import type { Redeemer } from "../type.ts";
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
const ADMIN_KEY_HASH = admin.key_hash;
const CONTRIBUTION_SCRIPT_HASH = vaultParams.contribution_parametized_hash;
const VAULT_ID = vaultParams.vault_id;
const LAST_UPDATE_TX_HASH = vaultParams.last_update_tx_hash;
const LAST_UPDATE_TX_INDEX = vaultParams.last_update_tx_index;
const DISPATCH_UTXO_TX_HASH = vaultParams.dispatch_utxo_tx_hash;
const DISPATCH_UTXO_INDEX = vaultParams.dispatch_utxo_index;
const CONTRIBUTION_TX_HASH_INDEX = "8e2576ae0465fe453c40b5466c278bebeb5bf266fd713a5b5dc0f7019d5b4d4b#0";
const ASSET_CONTRIBUTION_UNIT = "c82a4452eaebccb82aced501b3c94d3662cf6cd2915ad7148b459aec41584f";

const index = async () => {
  const utxos = await getUtxos(Address.from_bech32(CUSTOMER_ADDRESS));
  if (utxos.length === 0) {
    throw new Error("No UTXOs found.");
  }

  const dispatchResult = await applyDispatchParameters(
    scriptHashes.vault_policy_id,
    vaultParams.vault_id,
    vaultParams.contribution_parametized_hash
  );

  const PARAMETERIZED_DISPATCH_HASH = dispatchResult.parameterizedHash;
  const DISPATCH_ADDRESS = EnterpriseAddress.new(
    0,
    Credential.from_scripthash(ScriptHash.from_hex(PARAMETERIZED_DISPATCH_HASH))
  ).to_address().to_bech32();

  const SC_ADDRESS = EnterpriseAddress.new(
    0,
    Credential.from_scripthash(ScriptHash.from_hex(CONTRIBUTION_SCRIPT_HASH))
  ).to_address().to_bech32();

  const [contrib_tx_hash, contrib_index] = CONTRIBUTION_TX_HASH_INDEX.split("#");
  const datumTag = generate_tag_from_txhash_index(contrib_tx_hash, Number(contrib_index));

  const contribTxUtxos = await blockfrost.txsUtxos(contrib_tx_hash);
  const contribOutput = contribTxUtxos.outputs[contrib_index];
  if (!contribOutput) {
    throw new Error("No contribution output found");
  }

  const adaAmountToPay = 5000000;

  const input: {
    changeAddress: string;
    message: string;
    scriptInteractions: object[];
    mint?: Array<object>;
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
    preloadedScripts?: any;
  } = {
    changeAddress: CUSTOMER_ADDRESS,
    message: "Pay ADA to contributor from dispatch script",
    preloadedScripts: [dispatchResult.fullResponse.preloadedScript],
    scriptInteractions: [
      {
        purpose: "spend",
        hash: PARAMETERIZED_DISPATCH_HASH,
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
        hash: PARAMETERIZED_DISPATCH_HASH,
        redeemer: {
          type: "json",
          value: null, // Dispatch withdraw redeemer
        },
      },
      {
        purpose: "mint",
        hash: CONTRIBUTION_SCRIPT_HASH,
        redeemer: {
          type: "json",
          value: "MintVaultToken"

        },
      },
      {
        purpose: "spend",
        hash: CONTRIBUTION_SCRIPT_HASH,
        outputRef: {
          txHash: contrib_tx_hash,
          index: contrib_index,
        },
        redeemer: {
          type: "json",
          value: {
            __variant: "CollectVaultToken",
            __data: {
              vault_token_output_index: 0,
              change_output_index: 1, // Account for dispatch output
            }
          },
        },
      },
    ],
    mint: [
      {
        version: "cip25",
        assetName: { name: VAULT_ID, format: "hex" },
        policyId: CONTRIBUTION_SCRIPT_HASH,
        type: "plutus",
        quantity: 5,
        metadata: {},
      },
      {
        version: "cip25",
        assetName: { name: "receipt", format: "utf8" },
        policyId: CONTRIBUTION_SCRIPT_HASH,
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
        lovelace: adaAmountToPay, // Add ADA from dispatch for asset contributions
        datum: {
          type: "inline",
          value: {
            datum_tag: datumTag,
            ada_paid: adaAmountToPay,
          },
          shape: {
            validatorHash: scriptHashes.dispatch_script_hash,
            purpose: "spend"
          },
        },
      },
      {
        address: SC_ADDRESS,
        lovelace: contribOutput.amount.find(u => u.unit==='lovelace')?.quantity ,
        assets: [{
          assetName: {
            name: ASSET_CONTRIBUTION_UNIT.slice(56),
            format: "hex",
          },
          policyId: ASSET_CONTRIBUTION_UNIT.slice(0, 56),
          quantity: 5,
        },],
        datum: {
          type: "inline",
          value: {
            policy_id: CONTRIBUTION_SCRIPT_HASH,
            asset_name: VAULT_ID,
            owner: CUSTOMER_ADDRESS,
            datum_tag: datumTag,
          },
          shape: {
            validatorHash: CONTRIBUTION_SCRIPT_HASH,
            purpose: "spend",
          },
        },
      },
      {
        address: DISPATCH_ADDRESS,
        lovelace: 5000000, // Remaining ADA stays in dispatch script 
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

  const trimmedInput = {...input};
  delete trimmedInput.preloadedScripts;
  console.log(JSON.stringify(trimmedInput));

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
