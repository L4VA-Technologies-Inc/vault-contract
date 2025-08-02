# Vault

Vault is a Cardano smart contract written in Aiken that allows minting, spending, and burning of vault tokens. A vault is represented by a unique token minted with a policy ID and an identifier derived from the first input of a transaction. The contract ensures that the token remains within the script and enforces strict validation rules for modifications and burns.

## Features

- **Minting**: Vault tokens are uniquely identified and minted using transaction inputs.
- **Spending**: Vault parameters can be updated by an admin while ensuring the NFT remains at the contract address.
- **Burning**: The vault NFT can be burned, ensuring no additional minting occurs in the transaction.

## Project Structure

- **`validators/`**: Contains smart contract logic in Aiken (`.ak` files).
- **`lib/`**: Utility functions supporting contract logic.
- **`env/`**: Environment-based configuration files.

## Example Validator

```aiken
validator vault {
  mint(redeemer: VaultRedeemer, policy_id: PolicyId, self: Transaction) {
    when redeemer is {
      VaultMintAndSpend { vault_token_index } -> {
        // Generate a unique asset name based on the first input
        expect Some(first_input) = self.inputs |> at(0)
        let datum_tag = generate_datum_tag(first_input.output_reference)

        // Ensure minting matches expected vault token structure
        let desired_mint = zero |> add(policy_id, datum_tag, 1)
        let mint_match_the_desired_mint =
          restricted_to(self.mint, [policy_id]) == desired_mint

        and { mint_match_the_desired_mint? }
      }
      VaultBurn ->
        self.mint |> tokens(policy_id) |> filter(fn(_, v) { v > 0 }) |> is_empty
    }
  }
}
```

## Installation

Ensure you have Aiken installed. If not, install it using:

```sh
curl -sSL https://get.aiken-lang.org | bash
```

## Building

Compile the contract with:

```sh
aiken build
```

## Configuration

Edit **`aiken.toml`** to set network parameters:

```toml
[config.default]
network_id = 41
```

Alternatively, use conditional environment modules in the `env/` directory.

## Testing

Aiken allows writing tests using the `test` keyword. Example:

```aiken
test vault_mint() {
  config.network_id + 1 == 42
}
```

Run all tests:

```sh
aiken check
```

Run specific tests:

```sh
aiken check -m vault_mint
```

## Documentation

Generate project documentation:

```sh
aiken docs
```

## Resources

- [Aiken User Manual](https://aiken-lang.org)
