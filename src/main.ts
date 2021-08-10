/*
  Import all staff here
*/
export * from './services/ChainApi'
export * from './services/OrionBlockchain'

/* TEST SECTION BELOW */

import { BigNumber } from 'bignumber.js'
import { ChainApi } from './services/ChainApi'
import { OrionBlockchain } from './services/OrionBlockchain'

import {SignOrderModel} from './utils/Models'
import {getNumberFormat} from './utils/Helpers'


// const ETH_RPC_URL = 'https://staging.orionprotocol.io/rpc'
const BSC_RPC_URL = 'https://data-seed-prebsc-2-s1.binance.org:8545/'
// const ETH_ORION_BLOCKCHAIN = 'https://staging.orionprotocol.io'
const BSC_ORION_BLOCKCHAIN = 'https://dev-exp.orionprotocol.io'

// const ETH_AGGREGATOR = 'https://staging.orionprotocol.io/backend'
const BSC_AGGREGATOR = 'https://dev-exp.orionprotocol.io/backend'

const walletAddress = '0xe309Fb49005D01Df5d815a06a939260Ef0fff9ac'
const privateKey = 'a4b9a035914e7a5142943ea1c90f034d9a1d8659cafdaf035845d67af388475b'

const run = async () => {
  try {
    const provider = new ChainApi(BSC_RPC_URL, BSC_ORION_BLOCKCHAIN, BSC_AGGREGATOR)
    await provider.init()
    provider.connectWallet(privateKey)
    const orion = new OrionBlockchain(provider, walletAddress, '')

    const format = getNumberFormat(provider.blockchainInfo, 'ORN', 'USDT')

    const order: SignOrderModel = {
      fromCurrency: 'ORN', 
      toCurrency: 'USDT',
      side: 'buy', 
      price: new BigNumber(12), 
      amount: new BigNumber(20),
      senderAddress: walletAddress, 
      priceDeviation: new BigNumber(1), 
      numberFormat: format, 
      needWithdraw: false
    }

    const signedOrder = await orion.signOrder(order)
    console.log('signedOrder: ', signedOrder);

    const sendOrder = await provider.sendOrder(signedOrder, false)
    console.log('sendOrder: ', sendOrder);

    const history = await provider.getTradeHistory(walletAddress)
    // console.log('history: ', history);

    const status = await provider.getOrderStatus(walletAddress, Number(history[0].id))
    console.log('getOrderStatus: ', status);

  } catch (error) {
    console.log('run error: ', error);
  }
}

run()