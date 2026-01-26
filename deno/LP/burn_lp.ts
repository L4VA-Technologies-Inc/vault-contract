import { Buffer } from "node:buffer";
import {
  Address,
  FixedTransaction,
  PrivateKey,
} from "@emurgo/cardano-serialization-lib-nodejs";

import {
  blockfrost,
  getUtxosExtract, 
} from "../lib-js.ts";
import customer from "../wallets/customer.json";
// 1 wallet = admin.json
import admin from "../wallets/admin.json";

/**
 * Burn LP Script
 * 
 * Uses the BurnLp redeemer to burn LP tokens from the contribution contract.
 * 
 * Requirements:
 * - Admin signature is required (admin wallet must sign)
 * - Can be executed in ANY vault phase (Open, Cancel, or Successful)
 * - Only burns (negative mint amounts) are allowed
 * - Reference input with vault parameters must be provided
 * 
 * Smart Contract Logic (from contribute.ak):
 * - Validates that mint contains only burns (negative amounts)
 * - Verifies admin signature
 * - No vault status restrictions
 */

import type {  Redeemer,  } from "../type.ts"; 
const X_API_KEY = "testnet_4Y4K4wORt4fK5TQyHeoRiqAvw7DFeuAzayhlvtG5";
const API_ENDPOINT = "https://preprod.api.ada-anvil.app/v2/services";

const headers = {
  "x-api-key": X_API_KEY,
  "Content-Type": "application/json",
};


// From vault info database
const CONTRIBUTION_SCRIPT_HASH = "d50976ea6f14605f0a2b5d3864d58b361beedf1bcddb57af4cf29da1"; 

// Reference to vault parameters UTXO 
const LAST_UPDATE_TX_HASH = "d203e828b4a87039340fe983e3b606c53a23f6dda16ef80ff5f171c6c76fbf97";
const LAST_UPDATE_TX_INDEX = 0;

// Asset details to burn (the LP receipt tokens - this is the vault token itself)
const ASSET_POLICY_ID = "d50976ea6f14605f0a2b5d3864d58b361beedf1bcddb57af4cf29da1";
const ASSET_HEX_NAME = "682afc977d12f606b2f9048d8c9a9f33f369b2f21038f3fedb9b1205d60c74c9";
const AMOUNT_TO_BURN = 948200000000; 

const index = async () => {
  // Fetch UTXOs containing the LP tokens to burn
  const {utxos} = await getUtxosExtract(
    Address.from_bech32(customer.base_address_preprod),
    blockfrost,
    {targetAssets: [{token: `${ASSET_POLICY_ID}${ASSET_HEX_NAME}`, amount: AMOUNT_TO_BURN}]} 
  );
  
  if (utxos.length === 0) {
    throw new Error("No UTXOs found with the specified LP tokens.");
  }
  
  console.log(`Found ${utxos.length} UTXOs with LP tokens to burn`);

  const input = {
    changeAddress: customer.base_address_preprod,
    utxos,
    message: "Burn LP tokens using BurnLp redeemer",
    scriptInteractions: [
      {
        purpose: "mint",
        hash: CONTRIBUTION_SCRIPT_HASH,
        redeemer: {
          type: "json",
          value: "BurnLp" satisfies Redeemer,
        },
      },
    ],
    mint: [ 
      {
        version: "cip25",
        assetName: { name: ASSET_HEX_NAME, format: "hex" },
        policyId: ASSET_POLICY_ID,
        type: "plutus",
        quantity: -AMOUNT_TO_BURN,
        metadata: {},
      },
    ],
    outputs: [],
    referenceInputs: [
      {
        txHash: LAST_UPDATE_TX_HASH,
        index: LAST_UPDATE_TX_INDEX,
      },
    ],
    // CRITICAL: This adds the minting_key to extra_signatories so admin_signed check passes
    requiredSigners: [admin.key_hash],
    validityInterval: {
      start: true,
      end: true,
    },
    network: "preprod",
  };

  console.log("Building transaction...");
  console.log(JSON.stringify(input, null, 2));

  const contractDeployed = await fetch(`${API_ENDPOINT}/transactions/build`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });

  const transaction = await contractDeployed.json();
  
  // Check if transaction build failed
  if (!transaction.complete) {
    console.error("Transaction build failed:");
    console.error(JSON.stringify(transaction, null, 2));
    throw new Error(`Transaction build failed: ${transaction.message || 'Unknown error'}`);
  }
  
  console.log("Transaction built successfully!");
  console.log("Transaction ID will be available after submission.");

  const txToSubmitOnChain = FixedTransaction.from_bytes(
    Buffer.from(transaction.complete, "hex")
  );
  
  // Admin signature is required for BurnLp redeemer
  console.log("Signing transaction with admin key...");
  txToSubmitOnChain.sign_and_add_vkey_signature(
    PrivateKey.from_bech32(customer.skey)
  );
  txToSubmitOnChain.sign_and_add_vkey_signature(
    PrivateKey.from_bech32(admin.skey)
  );

  console.log("Submitting transaction...");
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
  
  if (submittedTx.txHash) {
    console.log("\n✅ SUCCESS! LP tokens burned!");
    console.log("Transaction Hash:", submittedTx.txHash);
    console.log(`View on explorer: https://preprod.cardanoscan.io/transaction/${submittedTx.txHash}`);
  } else {
    console.error("\n❌ Transaction submission failed:");
    console.error(JSON.stringify(submittedTx, null, 2));
  }
};

index();
