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
import type { Datum, Redeemer } from "../type.ts";
import { toPreloadedScript, applyContributeParams } from "../apply_params.ts";
import blueprint from "../blueprint.json";
const X_API_KEY = "testnet_4Y4K4wORt4fK5TQyHeoRiqAvw7DFeuAzayhlvtG5";
const API_ENDPOINT = "https://preprod.api.ada-anvil.app/v2/services";

const headers = {
  "x-api-key": X_API_KEY,
  "Content-Type": "application/json",
};

const CUSTOMER_ADDRESS = customer.base_address_preprod;
const ADMIN_KEY_HASH = admin.key_hash; // The keyhash of the generated private key to manage the vault

const VAULT_POLICY_ID =
  "d4915ac1dd9ef95493351cfaa2a6c9a85086472f12523999b5e32aeb";
const VAULT_ID =
  "d18912e96a3196e26be360f5ecf3496a5a0d65978a4794182717059c227215b9"; // The vault ID, used to identify the vault in the smart contract.
const LAST_UPDATE_TX_HASH =
  "e3ec1002af0d332abd907e6d57b63c3f51a20b7556f30cd1042774affeee6308";
const LAST_UPDATE_TX_INDEX = 0; // The index off the output in the transaction

const TX_HASH_INDEX_WITH_LPS_TO_COLLECT =
  "2d7e7feb0584d309a4e2558d1cde6179c2eede9c42fd28e62899c6a79d81e9bd#0";
const index = async () => {
  const utxos = await getUtxos(Address.from_bech32(CUSTOMER_ADDRESS)); // Any UTXO works.
  if (utxos.length === 0) {
    throw new Error("No UTXOs found.");
  }

  const parameterizedScript = applyContributeParams({
    vault_policy_id: VAULT_POLICY_ID,
    vault_id: VAULT_ID,
  });
  const POLICY_ID = parameterizedScript.validator.hash;
  const SC_ADDRESS = EnterpriseAddress.new(
    0,
    Credential.from_scripthash(ScriptHash.from_hex(POLICY_ID))
  )
    .to_address()
    .to_bech32();

  const unparameterizedScript = blueprint.validators.find(
    (v) => v.title === "contribute.contribute"
  );
  if (!unparameterizedScript) {
    throw new Error("Contribute validator not found");
  }
  const lpsUnit = parameterizedScript.validator.hash + VAULT_ID;
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
    preloadedScripts: {
      type: string;
      blueprint: any;
    }[];
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
          value: { vault_token_output_index: 0, change_output_index: 1 },
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
            policyId: parameterizedScript.validator.hash,
            quantity: 1000,
          },
        ],
        datum: {
          type: "inline",
          value: PlutusData.new_bytes(Buffer.from(datumTag, "hex")).to_hex(),
        },
      },
      {
        address: SC_ADDRESS,
        lovelace: 10000000,
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
    preloadedScripts: [
      toPreloadedScript(blueprint, {
        validators: [parameterizedScript.validator, unparameterizedScript],
      }),
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
