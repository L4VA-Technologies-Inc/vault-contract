**Creating Wallets** (these are included with a bit of preprod test ADA):

```bash
# No ADA Needed
~/Downloads/cardano-wallet-macos-latest --name=admin.json --mnemonic
# Has couple of ADA
~/Downloads/cardano-wallet-macos-latest --name=customer.json --mnemonic
```

**Deploy smart contract**

```bash
deno run -A deploy.ts
```

| Smart Contract Hash |
| ------------------- |
| ac2bb90a5a34ee1a7fe5340b73932132df67afb54d90605be6a8329f |
| 479f356943df735488e8f6ce7dd7dd9e757b68b9e01175da42031111 |
| 39478941fa99431e4d425430968be47e26af9690678668edd22ef462 |
| 2068562bc30d2f31e80e74a2387465c2d7a284eca822116d78f6c256 |
| d4915ac1dd9ef95493351cfaa2a6c9a85086472f12523999b5e32aeb |  
**Create Vault**

```bash
deno run --env-file -A create_vault.ts
```

**Update Vault**

```bash
deno run --env-file -A update_vault.ts
```

**Burn Vault**

```bash
deno run --env-file -A burn_vault.ts
```
**Tracking Interaction for troubleshooting**

| Transaction Hash | Asset Name |
| ---------------- | ---------- |
| 3c6d5eb6f750567c6766755e39ab1c16ffe30a588543ed26961f01dcd33a44bf | 0aacb1763613dc2868497e42fa4bc08271c8ca401b5013605a547cf31c0d8228 |
| e25fe2dfe2e082c461d0409b0eed30a8cb2008e98b68aa0e328eeaa34f641950 | 0aacb1763613dc2868497e42fa4bc08271c8ca401b5013605a547cf31c0d8228 |
| c81b496bcd2da6cd6a42a1b593c1c9ac0db34f4e2c88740246c08f35b374ec16 | 0aacb1763613dc2868497e42fa4bc08271c8ca401b5013605a547cf31c0d8228 |
| 78db36a015a7df3db5d6595f7621a87a9d5fdbb598a7ea66532d9b55b4f479bc | 0aacb1763613dc2868497e42fa4bc08271c8ca401b5013605a547cf31c0d8228 |
| 1b4ccd8677e981bc53e2932699b205fb580f05f3fff427161a492b7b0eb85c04 | 0aacb1763613dc2868497e42fa4bc08271c8ca401b5013605a547cf31c0d8228 |
| b4ccc591fe8e7b87967132b6de83aeaf18e806d886249cf25ea017f81a664375 | 773993aa3a212a28e18b3be3601f0164c4a6580868dea632fec02280e6d18715 |
| bb2450a90fcc08a1e2d17c2e854a02514d0154b80c3aa5d8971885fb78543106 | 9ef493c5fe45a6476f282137ac9803019a217dc7bf89bcd1db7e2309e11963ef |
| abe12a714bca7e53823b316dacce02f67ce05e71b3fb5bcb30de589953b05b49 | 7228a4e09c72b65c5299841ef29f708f39ca3a5e4032278664fc5d69f0e912f9 |
| a270ad6255654e57f7e85427190acecaec14f39fad3fa777c88a3e4838711434 | 7228a4e09c72b65c5299841ef29f708f39ca3a5e4032278664fc5d69f0e912f9 |
| 10feea9bc424c8fc4797971dfbd99f70edeea4371436c20a17e8e6dc4e75ec06 | 31bb1760417592754e0a7181d8e1f1e910daa3530ef0d5fb6a4c74c1c9d3e535 |
| b0aed2016ed4fdc82fb77fafb384fe67afe92a773c5c1126351114151aea8848 | fd375efc80465145494ae25a5e43339d8f4ee6d3e75c27435b34fa8e52e949f9 | 
| 8ab98da43d56face7f41686553b25ff856a62d7f41fba3bd38a20afd46d17b26 | ac2e494c7eb3c17be217c40d8291449e40948109080e0b9bb4ca5a4de2139927 |
| 7959176f5ab7f76505420f826610fe299ba10e60ca17bbdca884e43267a7e1da | 1aec92461978a8e7f3924329c1b12de47d838c2dd817a8e18690215c42d970ca |
| e3ec1002af0d332abd907e6d57b63c3f51a20b7556f30cd1042774affeee6308 | d18912e96a3196e26be360f5ecf3496a5a0d65978a4794182717059c227215b9 |
**LP generation thought vault**

To mint a LP token after contributing to a vault, you need to generate a parametized script and add ada/fts to the smartcontract.

The amount of LP minted is a parameter in the redemeer, the amount of LP is defined by many parameters like floor price, traits, etc. (offchain value for nfts/fts)

Upon contributing in ada, the ada will stay locked until the acquire windows is done with the LPs. The contributor will be able to either claim them, or they
will be distributed upon creating the liquidity pool on vify.

The script contribute_ada is not able to run in deno since it needs some codes from github. 

**Contribute ADA**
```bash
npm i
tsx ./LP/contribute_ada.ts
```