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

const POLICY_ID = "2de3551bbd703dd03d57bb4d16027a73b0501977dc830885523bb1e6"; // same as script hash, do not change unless new smart contract deployed.
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
//9a9b0bc93c26a40952aaff525ac72a992a77ebfa29012c9cb4a72eb2 contribution script hash
//0f9d90277089b2f442bef581dcc1d333a92c3fedf688700c4e39ab89 contribution script with verbose
const unparametizedScriptHash = "0f9d90277089b2f442bef581dcc1d333a92c3fedf688700c4e39ab89"

// Apply parameters to the blueprint before building the transaction
const applyParamsPayload = {
  "params": {
    [unparametizedScriptHash]: [
      POLICY_ID, // policy id of the vault
      assetName  // newly created vault id from generate_tag_from_txhash_index
    ]
  },
  "blueprint": {
    "title": "l4va/vault",
    "version": "0.0.7"
  }
};

console.log("Applying parameters:", JSON.stringify(applyParamsPayload, null, 2));

const applyParamsResponse = await fetch(`${API_ENDPOINT}/blueprints/apply-params`, {
  method: "POST",
  headers,
  body: JSON.stringify(applyParamsPayload),
});

const applyParamsResult = await applyParamsResponse.json();
console.log("Apply params result:", JSON.stringify(applyParamsResult, null, 2));
if (!applyParamsResult.preloadedScript) {
  throw new Error("Failed to apply parameters to blueprint");
}

// Step 2: Upload the parameterized script to /blueprints
console.log("Uploading parameterized script to /blueprints...");
console.log("Assetname: ", assetName)
const uploadScriptResponse = await fetch(`${API_ENDPOINT}/blueprints`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    blueprint: {
      ...applyParamsResult.preloadedScript.blueprint,
      preamble: {
        ...applyParamsResult.preloadedScript.blueprint.preamble,
        id: undefined,
        title: "l4va/vault/" + assetName,
        version: "0.0.1",
      },
      validators: applyParamsResult.preloadedScript.blueprint.validators.filter((v: any) => v.title.includes("contribute") && v.hash !== unparametizedScriptHash),
    }
  }),
});

const uploadScriptResult = await uploadScriptResponse.json();
console.log("Script upload result:", JSON.stringify(uploadScriptResult, null, 2));


const scriptHash = applyParamsResult.preloadedScript.blueprint.validators.find((v: any) => v.title === "contribute.contribute.mint" && v.hash !== unparametizedScriptHash)?.hash || "";
if (!scriptHash) {
  throw new Error("Failed to find script hash");
}
console.log(`Script hash found: ${scriptHash}`);

// TRANSACTION 1: Create vault (normal process without script upload)
console.log("\n=== TRANSACTION 1: Creating Vault ===");
const vaultInput: {
  changeAddress: string;
  message: string;
  mint: Array<object>;
  scriptInteractions: object[];
  outputs: ({
    address: string;
    assets: object[];
    datum: { type: "inline"; value: Datum1; shape: object };
  })[];
  requiredInputs: string[];
} = {
  changeAddress: CUSTOMER_ADDRESS,
  message: "Vault Creation",
  mint: [
    {
      version: "cip25",
      assetName: { name: assetName, format: "hex" },
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
          assetName: { name: assetName, format: "hex" },
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
              bound_type: new Date().getTime(),
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
              bound_type: new Date().getTime(),
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

console.log("Vault transaction input:", JSON.stringify(vaultInput, null, 2)); 
const vaultTransaction = await fetch(`${API_ENDPOINT}/transactions/build`, {
  method: "POST",
  headers,
  body: JSON.stringify(vaultInput),
});

const vaultTxResult = await vaultTransaction.json();
console.log("Vault transaction result:", JSON.stringify(vaultTxResult, null, 2));

// Sign the vault transaction using CSL.
const vaultTxToSubmit = FixedTransaction.from_bytes(
  Buffer.from(vaultTxResult.complete, "hex"),
);
vaultTxToSubmit.sign_and_add_vkey_signature(
  PrivateKey.from_bech32(customer.skey),
);

await sleep(30000);

const urlSubmit = `${API_ENDPOINT}/transactions/submit`;
const vaultSubmitted = await fetch(urlSubmit, {
  method: "POST",
  headers,
  body: JSON.stringify({
    signatures: [], // no signature required as it is part of the `vaultTxToSubmit`.
    transaction: vaultTxToSubmit.to_hex(),
  }),
});

const vaultOutput = await vaultSubmitted.json();
console.log("Vault submission result:", vaultOutput);

// Get the transaction hash for vault creation
const { txHash: vaultTxHash } = vaultOutput;

if (vaultTxHash) {
  console.log("✅ Vault created successfully!");
  console.log(`Vault ID: ${assetName}`);
  console.log(`Vault Transaction Hash: ${vaultTxHash}`);

  // TRANSACTION 2: Upload script to chain
  console.log("\n=== TRANSACTION 2: Uploading Script to Chain ===");
  
  const scriptInput = {
    changeAddress: CUSTOMER_ADDRESS,
    message: "Script Upload",
    outputs: [
      {
        address: "addr_test1qrx2c5gjwmw0zle4ngl9yypca4mpz9ccwunqeshfqhqddy5p9et633htthpeffw4995u7khyug3j90c22hwrgwcg8c6sksutuj",
        datum: {
          type: "script",
          hash: scriptHash,
        },
      },
    ],
  };

  console.log("Script transaction input:", JSON.stringify(scriptInput, null, 2));

  const scriptTransaction = await fetch(`${API_ENDPOINT}/transactions/build`, {
    method: "POST",
    headers,
    body: JSON.stringify(scriptInput),
  });

  const scriptTxResult = await scriptTransaction.json();
  console.log("Script transaction result:", JSON.stringify(scriptTxResult, null, 2));

  // Sign the script transaction using CSL.
  const scriptTxToSubmit = FixedTransaction.from_bytes(
    Buffer.from(scriptTxResult.complete, "hex"),
  );
  scriptTxToSubmit.sign_and_add_vkey_signature(
    PrivateKey.from_bech32(customer.skey),
  );
  await sleep(30000);
  const scriptSubmitted = await fetch(urlSubmit, {
    method: "POST",
    headers,
    body: JSON.stringify({
      signatures: [], // no signature required as it is part of the `scriptTxToSubmit`.
      transaction: scriptTxToSubmit.to_hex(),
    }),
  });

  const scriptOutput = await scriptSubmitted.json();
  console.log("Script submission result:", scriptOutput);

  // Get the transaction hash for script upload
  const { txHash: scriptTxHash } = scriptOutput;

  if (scriptTxHash) {
    console.log("✅ Script uploaded successfully!");
    console.log(`Script Transaction Hash: ${scriptTxHash}`);

    // Step 3: Update blueprint with the script transaction reference
    const blueprintUpdatePayload = {
      blueprint: {
        ...applyParamsResult.preloadedScript.blueprint,
        preamble: {
          ...applyParamsResult.preloadedScript.blueprint.preamble,
          id: undefined,
          title: "l4va/vault/" + assetName,
          version: "0.0.1",
        },
        validators: applyParamsResult.preloadedScript.blueprint.validators.filter((v: any) => v.title.includes("contribute")),
      },
      refs: {
        [scriptHash]: {
          txHash: scriptTxHash,
          index: 0 // Script output is at index 0
        }
      }
    };

    console.log("Updating blueprint with script reference...");
    const blueprintUpdate = await fetch(`${API_ENDPOINT}/blueprints`, {
      method: "POST",
      headers,
      body: JSON.stringify(blueprintUpdatePayload),
    });

    const blueprintUpdateResult = await blueprintUpdate.json();
    console.log("Blueprint update result:", JSON.stringify(blueprintUpdateResult, null, 2));
   
    console.log("✅ Complete two-transaction workflow finished!");
    console.log(`Vault created with ID: ${assetName} (tx: ${vaultTxHash})`);
    console.log(`Script uploaded with hash: ${scriptHash} (tx: ${scriptTxHash})`);
    console.log("Blueprint updated with script reference");
  } else {
    console.error("Failed to upload script to chain");
  }
} else {
  console.error("Failed to create vault");
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}