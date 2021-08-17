# Orion Trading SDK

[![code style: eslint](https://img.shields.io/badge/code%20style-eslint-green)](https://github.com/standard/eslint-config-standard)
[![Actions Status](https://github.com/orionprotocol/orion-pool-sdk/workflows/CI/badge.svg)](https://github.com/orionprotocol/trading-sdk)
[![npm version](https://img.shields.io/npm/v/@orionprotocol/orion-pool-sdk/latest.svg)](https://www.npmjs.com/package/@tumakot/orion-trading-sdk/v/latest)

## Installation

```sh
npm install @tumakot/orion-trading-sdk
```

## Usage

**First step:** Create *Chain* and *Orion* instances

```javascript
import { Chain, Orion } from '@tumakot/orion-trading-sdk'

/* Urls for Api */
const rpcUrl = 'https://trade.orionprotocol.io/rpc'
const orionBlockchainApiUrl = 'https://trade.orionprotocol.io'
const privateKey = 'your_private_key'

const chain = new Chain(rpcUrl, orionBlockchainApiUrl, privateKey)

await chain.init() // get blockchain info
```


**Second step:** Create Orion instance to interact with blockchain

```javascript
const orion = new Orion(chain)
```
Now you ready to go.

## Examples
(*previous steps are required*)

**Create, sign and send order to OrionBlockchain:**
```javascript
// create order
const order = {
    fromCurrency: 'ORN',
    toCurrency: 'DAI',
    side: 'sell',
    price: 12,
    amount: 10,
    priceDeviation: 1,
    needWithdraw: false
}

// sign order
const signedOrder = await orion.signOrder(order)

// send order
const sentOrderResponse = await orion.sendOrder(signedOrder, false)
```

**Get orders history/status:**
```javascript
const history = await chain.getTradeHistory()

const status = await chain.getOrderStatus(orderId)
```

**Cancel order:**
```javascript
const orderToCancel = {
  id: 9327, // order id
  senderAddress: '0xe309Fb49005D01Df5d815a06a939345Ef0fff444', // wallet address
  signature: '0xedf401f8842fdfe36cd88da2200ec3fcc53e936803f3a1dea8b3c1e61137af3b3c065d82671664b8bdfef7a2a5488d84e600d8c8f297576b97196326cb19dfe41b', // signature from order
  isPersonalSign: false // from order
}

const cancelOrderResponse = await orion.cancelOrder(orderToCancel)
```

**Check balance on smart contract:**
```javascript
const balance = await orion.checkContractBalance('ORN')
```

## Websockets

**To subscribe to the price feed:**
```javascript
import { WS } from '@tumakot/orion-trading-sdk'
// Create ws instance
const ws = new WS('wss://trade.orionprotocol.io/ws2')

// Subscriber for all tickers
const subscriberForAll = ws.priceFeedSubscriber()

// Subscriber for specified ticker
const subscriberForTicker = ws.priceFeedSubscriber('ORN-USDT')

// Listen to feed
subscriberForAll.on('message', (message) => {
    // do something with message
})

// Unsubscribe
subscriberForAll.close()
subscriberForTicker.close()
```

## Testing
To run the tests, follow these steps. You must have at least node v10 installed.

Clone repository

```sh
git clone https://github.com/orionprotocol/trading-sdk
```

Move into the trading-sdk working directory

```sh
cd trading-sdk/
```

Install dependencies

```sh
npm install
```

Copy .env.example file to .env
```sh
cp .env.example .env
```

Fill environment variables. It's necessary for order testing.
```sh
PRIVATE_KEY= # your private key
```

Run tests

```sh
npm run test
```

You should see output with all test passed
