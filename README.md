# Orion Trading SDK

[![code style: eslint](https://img.shields.io/badge/code%20style-eslint-green)](https://github.com/standard/eslint-config-standard)
[![npm version](https://img.shields.io/npm/v/@orionprotocol/orion-trading-sdk/latest.svg)](https://www.npmjs.com/package/@orionprotocol/orion-trading-sdk/v/latest)

## Installation

```sh
npm install @orionprotocol/orion-trading-sdk
```

## Methods with parameters per module
<hr>

### Module *Chain*

***getWalletBalance(ticker)***

Parameter | Type | Required | Description
--- | --- | --- | ---
*ticker* | string | no | empty ticker field return balance for all tokens

@return token balance on wallet (uint)
<hr>

### Module *OrionAggregator*

***createOrder({...params})***

Parameter | Type | Required | Description
--- | --- | --- | ---
*fromCurrency* | string | yes | token symbol
*toCurrency* | string | yes | token symbol
*side* | string | yes | 'buy' or 'sell'
*price* | number | yes | any number
*amount* | number | yes | any number
*priceDeviation* | number | yes | it's percents, 0 < priceDeviation < 50
*needWithdraw* | boolean | yes
*chainPrices* | object | no

*chainPrices* is optional (use it if you already knew prices):

Parameter | Type | Required | Description
--- | --- | --- | ---
*gasWei* | string | yes | gas price in wei
*baseAsset* | string/number | yes
*networkAsset* | string/number | yes
*feeAsset* | string/number | yes

@return prepared and signed order

***sendOrder(order, isCreateInternalOrder)***

Parameter | Type | Required | Description
--- | --- | --- | ---
*order* | object | yes | Order object from `createOrder()`
*isCreateInternalOrder* | boolean | yes

@return *orderId*

***cancelOrder(orderId)***

Parameter | Type | Required | Description
--- | --- | --- | ---
*orderId* | number | yes |

@return *orderId* of cancelled order

***getOrderById(orderId)***

Parameter | Type | Required | Description
--- | --- | --- | ---
*orderId* | number | yes |

@return order with requested id

***getTradeHistory()***
- no params

@return list of orders

### Module *Exchange*

***getContractBalance(ticker)***

Parameter | Type | Required | Description
--- | --- | --- | ---
*ticker* | string | no | empty ticker field return balance for all tokens

@return token balance on smart contract (bignumber)

***deposit(token, amount)***

Parameter | Type | Required | Description
--- | --- | --- | ---
*token* | string | yes |
*amount* | string | yes |

@return transaction hash

***withdraw(token, amount)***

Parameter | Type | Required | Description
--- | --- | --- | ---
*token* | string | yes |
*amount* | string | yes |

@return transaction hash

<hr>

### Module *WS*

***priceFeedAll()***
- no params

@return subscriber for all tickers price feed

***priceFeedTicker(ticker)***

Parameter | Type | Required | Description
--- | --- | --- | ---
*ticker* | string | yes |

@return subscriber for specific ticker price feed

***orderBooks(pair)***

Parameter | Type | Required | Description
--- | --- | --- | ---
*pair* | string | yes |

@return subscriber for orderbooks

<hr>

## How to use
 **Important note!** you should always wrap your async functions in a try-catch block, so you could handle errors in a right way.
 ```javascript
try {
    // place here your async functions
    /* Example
        const chain = new Chain(privateKey, networkParams)
        await chain.init() // get blockchain info
     */

} catch(error) {
    // handle errors
}
 ```

**First step:** Create base *Chain* instance

```javascript
import { Chain, Constants } from '@orionprotocol/orion-trading-sdk'

// Set params for Chain constructor

const privateKey = 'your_private_key'

// in Constants.NETWORK you should choose mode (MAIN | TEST) and then chain (BSC | ETH)
const networkParams = Constants.NETWORK.TEST.BSC

// By default networkParams is NETWORK.TEST.BSC

try {
    const chain = new Chain(privateKey, networkParams)

    await chain.init() // get blockchain info
} catch (error) {
    // handle error
}

```
In examples below we hide try-catch blocks, because they are wrappers. But you should always use them.

Now you ready to go.

## Examples
(*previous steps are required*)


**Get wallet balance:**
```javascript
const walletBalance = await chain.getWalletBalance('ORN') // by ticker

const walletBalanceSummary = await chain.getWalletBalance() // summary

/*
    Example:
    { ORN: '13890000000000' } // uint
*/
```

**For further operations, network tokens are required to pay for transactions, as well as tokens for deposit / withdrawal / exchange.**

**Deposit token:**
```javascript
import { Exchange } from '@orionprotocol/orion-trading-sdk'

const exchange = new Exchange(chain)

const deposit = await exchange.deposit('ORN', '10')
// Should return transaction object
```

**Get smart contract balance:**
```javascript
const contractBalance = await exchange.getContractBalance('ORN') // by ticker

const contractBalanceSummary = await exchange.getContractBalance() // summary

/*
    Example:
     {
        ORN: {
          total: [BigNumber],
          locked: [BigNumber],
          available: [BigNumber]
        }
      }
*/
```

**Withdraw token:**
```javascript
const withdraw = await exchange.withdraw('ORN', '10')
// Should return transaction object
```
## Work with OrionAggregator:
Creating, sending, canceling orders and getting info

```javascript
import { OrionAggregator } from '@orionprotocol/orion-trading-sdk'

orionAggregator = new OrionAggregator(chain)

await orionAggregator.init()  // initializing of aggregator (required)

// for information purposes
orionAggregator.pairs // list of available exchange pairs
```

**Create, sign and send order to OrionAggregator:**
```javascript
// create order
const order = {
    fromCurrency: 'ORN',
    toCurrency: 'DAI',
    feeCurrency: 'ORN', // available fee tokens you can find in chain.tokensFee
    side: 'sell',   // 'buy' or 'sell'
    price: 12,
    amount: 10,
    priceDeviation: 1,   // it's percents: 0 < priceDeviation < 50
    needWithdraw: false,
    // 'chainPrices' is optional, use it when prices are already known
    // to increase request speed
    chainPrices: {
        networkAsset: 57,  // // 'networkAsset' price against ORN
        baseAsset: 1,    // 'fromCurrency' price against ORN
        feeAsset: 1,    // 'feeCurrency' price against ORN
        gasWei: '10000000000'
    }
}

// sign order
const signedOrder = await orionAggregator.createOrder(order)

// send order
const sentOrderResponse = await orionAggregator.sendOrder(signedOrder, false)
// Should return order id if successful
```

**Cancel order:**
```javascript
const orderCancelation = await orionAggregator.cancelOrder(sentOrderResponse.orderId)
// Should return order id if cancelation is successful
```

**Get orders history/status:**
```javascript
const history = await orionAggregator.getTradeHistory()

const order = await orionAggregator.getOrderById(sentOrderResponse.orderId)
const status = order.status
```

## Websockets

**Create WS instance:**
```javascript
import { WS, Constants } from '@orionprotocol/orion-trading-sdk'

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
**Also network tokens are required to pay for transactions, as well as tokens for deposit / withdrawal / exchange. (10 ORN in test cases)**

Run tests

```sh
npm run test
```

You should see output with all test passed
