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
import { Chain, Orion, Constants } from '@tumakot/orion-trading-sdk'

// Set params for Chain constructor

const privateKey = 'your_private_key'

// in Constants.NETWORK you should choose mode (MAIN | TEST) and then chain (BSC | ETH)
const networkParams = Constants.NETWORK.TEST.BSC

// By default networkParams is NETWORK.TEST.BSC

const chain = new Chain(privateKey, networkParams)

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
    needWithdraw: false,
    // chainPrices is optional, use it when prices are already known
    // to increase request speed
    chainPrices: {
        orn: 1,
        baseCurrency: 57,
        gasWei: '10000000000'
    }
}

// sign order
const signedOrder = await orion.signOrder(order)

// send order
const sentOrderResponse = await orion.sendOrder(signedOrder, false)
// Should return order id if successful
```

**Cancel order:**
```javascript
const orderCancelation = await orion.cancelOrder(sentOrderResponse.orderId)
// Should return order id if cancelation is successful
```

**Get orders history/status:**
```javascript
const history = await chain.getTradeHistory()

const order = await chain.getOrderById(sentOrderResponse.orderId)
const status = order.status
```

**Check balance on smart contract:**
```javascript
const balance = await orion.checkContractBalance('ORN')
```

## Websockets

**Create WS instance:**
```javascript
import { WS, Constants } from '@tumakot/orion-trading-sdk'

// Create ws instance

// in Constants.ORION_WS you should choose mode (MAIN | TEST) and then chain (BSC | ETH)
const wsUrl = Constants.ORION_WS.TEST.BSC

// wsUrl by default is ORION_WS.TEST.BSC
const ws = new WS(wsUrl)
```

**To subscribe to the price feed:**
```javascript
// Subscribe for all tickers
const subscriberForAll = ws.priceFeedAll()

// Subscribe for specified ticker
const subscriberForTicker = ws.priceFeedTicker('ORN-USDT')

subscriberForAll.on('message', (message) => {
    // do something with message data
});

subscriberForTicker.on('message', (message) => {
    // do something with message data
});

// Unsubscribe
subscriberForAll.close()
subscriberForTicker.close()
```

**To subscribe to the orderbooks:**
```javascript
// Subscribe for orderbooks
const subscriberForOrderbooks = ws.orderBooks('ORN-USDT')

subscriberForOrderbooks.on('message', (message) => {
    // do something with message data
});

// Unsubscribe
subscriberForOrderbooks.close()
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
