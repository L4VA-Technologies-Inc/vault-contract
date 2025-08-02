# 🛠 Vault Smart Contract - Changelog

## 📦 Updated Parameter Names

| **Old Name**            | **New Name**               |
| ----------------------- | -------------------------- |
| `lp_output_index`       | `vault_token_output_index` |
| `investment` (in types) | `acquire`                  |
| `investment_window`     | `acquire_window`           |

---

## ➕ New Vault Parameters

### `acquire_multiplier: Option<List<(PolicyId, Option<AssetName>, Int)>>`

Used to define multipliers for contributions made in **assets** (FTs/NFTs) or **ADA**.

#### Examples:

* Target an entire collection:
  `[(policy_id, None, 1)]`
* Target a specific token:
  `[(policy_id, Some(asset_name), 2)]`

---

### `ada_pair_multiplier: Option<Int>`

Defines a multiplier when extracting **ADA** to create a **liquidity pair** (e.g., on Vify).

---

### `vault_status: Int`

Represents the current status of the vault.

| **Value** | **Meaning** |
| --------- | ----------- |
| `0`       | Pending     |
| `1`       | Open        |
| `2`       | Successful  |
| `3`       | Cancelled   |

---

## ⚙️ Behavioral Changes

### 🔹 Token Minting on Contribution

* When contributing with **ADA** or **assets**, only **1 vault token** is minted at the time of contribution.
* This allows condition verification without fully minting the total amount up front.

### 🔹 Vault Token Collection Logic

* When collecting your vault tokens, you **must remint** the rest of the tokens based on the multiplier.
* Formula:

  ```
  Required = (contributed_amount × multiplier) - 1
  ```
* Example:

  * Contributed: `1_000_000 lovelace`
  * Multiplier: `1`
  * You already minted 1 token on contribution
  * At collection: **must remint 999,999 vault tokens**

 