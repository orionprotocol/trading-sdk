# Orion Trading SDK

[![code style: eslint](https://img.shields.io/badge/code%20style-eslint-green)](https://github.com/standard/eslint-config-standard)
[![Actions Status](https://github.com/orionprotocol/orion-pool-sdk/workflows/CI/badge.svg)](https://github.com/orionprotocol/trading-sdk)
[![npm version](https://img.shields.io/npm/v/@orionprotocol/orion-pool-sdk/latest.svg)](https://www.npmjs.com/package/@orionprotocol/orion-pool-sdk/v/latest)

## Installation

```sh
npm install @tumakot/orion-trading-sdk
```

## Usage

**First step:** Initialize *sdk.Api*

```javascript
import { Api, Orion } from '@tumakot/orion-trading-sdk'

/* Urls for orion*/
const orionRpcUrl = 'https://trade.orionprotocol.io/rpc'
const orionBlockchainApiUrl = 'https://trade.orionprotocol.io'

const sdkApi = new Api(orionRpcUrl, orionBlockchainApiUrl)

await sdkApi.init() // get blockchain info
```

**Second step:** Connect your wallet

```javascript
sdkApi.connectWallet(privateKey)
```
Now you can sign your operations

**Third step:** Create Orion instance to interact with blockchain

```javascript
const orion = new Orion(sdkApi, walletAddress, '')
```
