 
const X_API_KEY = "testnet_4Y4K4wORt4fK5TQyHeoRiqAvw7DFeuAzayhlvtG5";
const API_ENDPOINT = "https://preprod.api.ada-anvil.app/v2/services";

const headers = {
  "x-api-key": X_API_KEY,
  "Content-Type": "application/json",
};

const getBlueprint = await fetch(
  `${API_ENDPOINT}/blueprints?title=l4va/vault&version=0.0.7`,
  {
    method: "GET",
    headers,
  },
);

const blueprint = await getBlueprint.json();
if(blueprint.results[0]){
   await Deno.writeTextFile("./blueprint.json", JSON.stringify(blueprint.results[0]));
}
console.debug("blueprint", JSON.stringify(blueprint));
