import { Buffer } from "node:buffer";
import { FixedTransaction, PrivateKey } from "@emurgo/cardano-serialization-lib-nodejs";
import customer from "../wallets/customer.json" assert { type: "json" };
import vaultParams from "./vault-parameters.json" assert { type: "json" };

const API_ENDPOINT = "https://preprod.api.ada-anvil.app/v2/services";
const X_API_KEY = "testnet_4Y4K4wORt4fK5TQyHeoRiqAvw7DFeuAzayhlvtG5";

const headers = {
    "x-api-key": X_API_KEY,
    "Content-Type": "application/json",
};

const registerScriptStake = async () => {
    const input = {
        changeAddress: customer.base_address_preprod,
        deposits: [{
            hash: vaultParams.dispatch_script_hash,
            type: "script",
            deposit: "stake"
        }]
    };

    const buildResponse = await fetch(`${API_ENDPOINT}/transactions/build`, {
        method: "POST",
        headers,
        body: JSON.stringify(input),
    });

    if (!buildResponse.ok) {
        const errorText = await buildResponse.text();
        throw new Error(`Build failed: ${buildResponse.status} - ${errorText}`);
    }

    const transaction = await buildResponse.json();
    const txToSubmitOnChain = FixedTransaction.from_bytes(
        Buffer.from(transaction.complete, "hex")
    );
    txToSubmitOnChain.sign_and_add_vkey_signature(
        PrivateKey.from_bech32(customer.skey)
    );

    const submitResponse = await fetch(`${API_ENDPOINT}/transactions/submit`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            signatures: [],
            transaction: txToSubmitOnChain.to_hex(),
        }),
    });

    if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        throw new Error(`Submit failed: ${submitResponse.status} - ${errorText}`);
    }

    return await submitResponse.json();
};

const main = async () => {
    try {
        const result = await registerScriptStake();
        console.log(result);
    } catch (error) {
        console.error(error);
    }
};

main();
