import scriptHashes from "../script-hashes.json" with { type: "json" };

const X_API_KEY = "testnet_4Y4K4wORt4fK5TQyHeoRiqAvw7DFeuAzayhlvtG5";
const API_ENDPOINT = "https://preprod.api.ada-anvil.app/v2/services";

const headers = {
  "x-api-key": X_API_KEY,
  "Content-Type": "application/json",
};

/**
 * Apply parameters to the dispatch script
 * @param vault_policy - PolicyId of the vault
 * @param vault_id - ByteArray vault identifier
 * @param contribution_script_hash - ByteArray contribution script hash
 * @returns The parameterized script hash and full response
 */
export async function applyDispatchParameters(
  vault_policy: string,
  vault_id: string, 
  contribution_script_hash: string
): Promise<{
  parameterizedHash: string;
  fullResponse: any;
}> {
  const unparametizedDispatchHash = scriptHashes.dispatch_script_hash;

  // Apply parameters to the dispatch script
  const applyParamsPayload = {
    "params": {
      [unparametizedDispatchHash]: [
        vault_policy, // PolicyId of the vault
        vault_id, // ByteArray vault identifier  
        contribution_script_hash  // ByteArray contribution script hash
      ]
    },
    "blueprint": {
      "title": "l4va/vault-with-dispatch",
      "version": "0.1.1"
    }
  };

  console.log("Applying dispatch parameters:", JSON.stringify(applyParamsPayload, null, 2));

  const applyParamsResponse = await fetch(`${API_ENDPOINT}/blueprints/apply-params`, {
    method: "POST",
    headers,
    body: JSON.stringify(applyParamsPayload),
  });

  const applyParamsResult = await applyParamsResponse.json();
  console.log("Apply dispatch params result:", JSON.stringify(applyParamsResult, null, 2));

  if (!applyParamsResult.preloadedScript) {
    throw new Error("Failed to apply parameters to dispatch script");
  }

  // Find the parameterized dispatch script hash
  const parameterizedScript = applyParamsResult.preloadedScript.blueprint.validators.find(
    (v: any) => v.title === "dispatch.dispatch.spend" && v.hash !== unparametizedDispatchHash
  );

  if (!parameterizedScript) {
    throw new Error("Failed to find parameterized dispatch script hash");
  }

  console.log(`Parameterized dispatch script hash: ${parameterizedScript.hash}`);

  return {
    parameterizedHash: parameterizedScript.hash,
    fullResponse: applyParamsResult
  };
}

