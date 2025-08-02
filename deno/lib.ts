import { Buffer } from "node:buffer";
import {
  BlockFrostAPI,
  BlockfrostServerError,
} from "npm:@blockfrost/blockfrost-js";
import {
  Address,
  TransactionInput,
  TransactionOutput,
  TransactionHash,
  TransactionUnspentOutput,
  TransactionUnspentOutputs,
  AssetName,
  Assets,
  BigNum,
  MultiAsset,
  ScriptHash,
  Value,
  PlutusData,
  ConstrPlutusData,
  BigInt,
  hash_plutus_data,
  PlutusList,
} from "npm:@emurgo/cardano-serialization-lib-nodejs@14.1.0";

const blockfrost = new BlockFrostAPI({
  projectId: Deno.env.get("BLOCKFROST_KEY")!,
});

interface Amount {
  unit: string;
  quantity: string | number;
}

const assetsToValue = (assets: Amount[]) => {
  const multiAsset = MultiAsset.new();
  const lovelace = assets.find((asset) => asset.unit === "lovelace");
  const policies = assets
    .filter((asset) => asset.unit !== "lovelace")
    .map((asset) => asset.unit.slice(0, 56));

  if (!policies.length && lovelace) {
    return Value.new(
      BigNum.from_str(
        String(
          Number(lovelace.quantity) < 1000000 ? 1000000 : lovelace.quantity,
        ),
      ),
    );
  }
  policies.forEach((policy) => {
    const policyAssets = assets.filter(
      (asset) => asset.unit.slice(0, 56) === policy,
    );
    const assetsValue = Assets.new();
    policyAssets.forEach((asset) => {
      if (Number(asset.quantity) > 0)
        assetsValue.insert(
          AssetName.new(Buffer.from(asset.unit.slice(56), "hex")),
          BigNum.from_str(String(asset.quantity)),
        );
    });
    if (assetsValue.len() > 0)
      multiAsset.insert(
        ScriptHash.from_bytes(Buffer.from(policy, "hex")),
        assetsValue,
      );
  });

  const multiAssetsValue = Value.new(
    BigNum.from_str(lovelace ? String(lovelace.quantity) : "0"),
  );
  multiAssetsValue.set_multiasset(multiAsset);
  return multiAssetsValue;
};

export const getUtxos = async (address: Address, min = 0) => {
  const utxos = await blockfrost.addressesUtxosAll(address.to_bech32());
  const parsedUtxos = TransactionUnspentOutputs.new();
  utxos.forEach((utxo: any) => {
    const { tx_hash, output_index, amount } = utxo;
    if (Number(amount[0].quantity) > min) {
      parsedUtxos.add(
        TransactionUnspentOutput.new(
          TransactionInput.new(TransactionHash.from_hex(tx_hash), output_index),
          TransactionOutput.new(address, assetsToValue(amount)),
        ),
      );
    }
  });
  return parsedUtxos;
};

export function generate_tag_from_txhash_index(
  txHash: string,
  txOutputIdx: number,
) {
  const plutusList = PlutusList.new();
  plutusList.add(PlutusData.new_bytes(Buffer.from(txHash, "hex")));

  plutusList.add(PlutusData.new_integer(BigInt.from_str(String(txOutputIdx))));

  const plutusData = PlutusData.new_constr_plutus_data(
    ConstrPlutusData.new(BigNum.zero(), plutusList),
  );
  const hash = hash_plutus_data(plutusData);

  return hash.to_hex();
}

export async function getVaultUtxo(policyId: string, assetName: string) {
  try {
    const unit = policyId + assetName;
    const assets = await blockfrost.assetsTransactions(unit, {
      count: 1,
      order: "desc",
    });

    if (assets.length > 1) {
      throw new Error("Must be one.");
    }
    const utxo = await blockfrost.txsUtxos(assets[0].tx_hash);

    const index = utxo.outputs.findIndex((output) =>
      output.amount.find((amount) => amount.unit === unit),
    );

    if (index === -1) {
      throw new Error(
        "Vault not found in transaction, your vault might be burned.",
      );
    }

    return { txHash: utxo.hash, index: index };
  } catch (e: unknown) {
    if ((e as BlockfrostServerError).status_code === 404) {
      throw new Error("Vault not found on chain.");
    }
    throw e;
  }
}

export function toHex(str: string) {
  return Buffer.from(str).toString("hex");
}
