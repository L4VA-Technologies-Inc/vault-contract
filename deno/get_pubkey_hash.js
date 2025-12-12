require('@emurgo/cardano-serialization-lib-nodejs');
const { Address } = require('@emurgo/cardano-serialization-lib-nodejs');
const bip39 = require('bip39');
const { Bip32PrivateKey } = require('@emurgo/cardano-serialization-lib-nodejs');

/**
 * Extracts the payment credential (public key hash) from a Cardano address
 * @param addressBech32 - Bech32 encoded Cardano address
 * @returns The public key hash as a hex string, or null if the address doesn't contain a payment key hash
 */
function getPubKeyHashFromAddress(addressBech32) {
  try {
    const address = Address.from_bech32(addressBech32);
    
    if (!address) {
      console.error("Address is not a base address");
      return null;
    }
    
    const paymentCred = address.payment_cred();
    if (!paymentCred) {
      console.error("Address does not contain a payment credential");
      return null;
    }

    const keyHash = paymentCred.to_keyhash();
    
    if (!keyHash) {
      console.error("Payment credential is not a key hash (might be a script)");
      return null;
    }
    
    return keyHash.to_hex();
  } catch (error) {
    console.error("Error extracting pub key hash:", error);
    return null;
  }
}

// // Example usage
//   const testAddress = "addr1q8pdlqvkvgj2..........jvkr45y8qqr5wmpqn63ghk";
//   const pubKeyHash = getPubKeyHashFromAddress(testAddress);
  
//   console.log("Address:", testAddress);
//   console.log("Pub Key Hash:", pubKeyHash);


  
/**
 * Derives the stake private key from a mnemonic
 * @param mnemonic - BIP39 mnemonic phrase
 * @returns The stake private key in bech32 format
 */
function getStakePrivateKeyFromMnemonic(mnemonic) {
  try {
    // Convert mnemonic to entropy
    const entropy = bip39.mnemonicToEntropy(mnemonic);
    
    // Generate root key from entropy
    const rootKey = Bip32PrivateKey.from_bip39_entropy(
      Buffer.from(entropy, 'hex'), 
      Buffer.from('')
    );

    // Derive stake key using Cardano's standard derivation path
    // m/1852'/1815'/0'/2/0
    const stakeKey = rootKey
      .derive(1852 | 0x80000000) // purpose (hardened)
      .derive(1815 | 0x80000000) // coin type (hardened)
      .derive(0 | 0x80000000)    // account (hardened)
      .derive(2)                 // staking chain (NOT hardened)
      .derive(0);                // first staking address (NOT hardened)

    // Convert to raw private key and encode as bech32
    const stakePrivateKey = stakeKey.to_raw_key().to_bech32();
    
    return stakePrivateKey;
  } catch (error) {
    console.error("Error deriving stake private key:", error);
    return null;
  }
}

function getPaymentPrivateKeyFromMnemonic(mnemonic) {
  try {
    const entropy = bip39.mnemonicToEntropy(mnemonic);
    const rootKey = Bip32PrivateKey.from_bip39_entropy(
      Buffer.from(entropy, 'hex'), 
      Buffer.from('')
    );

    // Derive payment key using Cardano's standard derivation path
    // m/1852'/1815'/0'/0/0
    const accountKey = rootKey
      .derive(1852 | 0x80000000) // purpose (hardened)
      .derive(1815 | 0x80000000) // coin type (hardened)
      .derive(0 | 0x80000000)    // account (hardened)
      .derive(0)                 // external chain (NOT hardened)
      .derive(0);                // first address (NOT hardened)

    const paymentPrivateKey = accountKey.to_raw_key().to_bech32();
    
    return paymentPrivateKey;
  } catch (error) {
    console.error("Error deriving payment private key:", error);
    return null;
  }
}

// Example usage
// const testMnemonic = "example example";

// const stakePrivateKey = getStakePrivateKeyFromMnemonic(testMnemonic);
// const paymentPrivateKey = getPaymentPrivateKeyFromMnemonic(testMnemonic);

// console.log("Mnemonic:", testMnemonic);
// console.log("\nPayment Private Key:", paymentPrivateKey);
// console.log("\nStake Private Key:", stakePrivateKey);

