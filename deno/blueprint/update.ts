import blueprint from "../../plutus.json" with { type: "json" };

const X_API_KEY = "testnet_4Y4K4wORt4fK5TQyHeoRiqAvw7DFeuAzayhlvtG5";
const API_ENDPOINT = "https://preprod.api.ada-anvil.app/v2/services";

const headers = {
  "x-api-key": X_API_KEY,
  "Content-Type": "application/json",
};

const txHash = "95ed74730f1abdeab243af374345bed42a9902dd6e49e2dbc0de9c124638847b";

if (txHash === "UPDATE_WITH_LATEST_TX_HASH") {
  throw new Error("You must update the tx hash before update");
}

function getValidators(validators: typeof blueprint.validators) {
  return [
    ...validators
      .reduce(
        (a, b) => a.set(b.hash, b) && a,
        new Map<string, (typeof blueprint.validators)[number]>(),
      )
      .values(),
  ];
}

const linkBlueprintAndTxHash = await fetch(`${API_ENDPOINT}/blueprints`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    blueprint,
    refs: getValidators(blueprint.validators).reduce(
      (a, b, index) => {
        a[b.hash] = { txHash, index };
        return a;
      },
      {} as Record<string, { txHash: string; index: number }>,
    ),
  }),
});

const updatedBlueprint = await linkBlueprintAndTxHash.json();
console.log("updatedBlueprint", JSON.stringify(updatedBlueprint, null, 2));
