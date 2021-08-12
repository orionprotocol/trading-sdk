import { ChainApi } from '../src/services/ChainApi'
// import { OrionBlockchain } from '../src/services/OrionBlockchain'
// import {getNumberFormat} from './utils/Helpers'
// import {CancelOrderRequest} from './utils/Models'


// const ETH_RPC_URL = 'https://staging.orionprotocol.io/rpc'
// const ETH_RPC_URL_PROD = 'https://trade.orionprotocol.io/rpc'
const BSC_RPC_URL = 'https://data-seed-prebsc-2-s1.binance.org:8545/'

// const ETH_ORION_BLOCKCHAIN = 'https://staging.orionprotocol.io'
// const ETH_ORION_BLOCKCHAIN_PROD = 'https://trade.orionprotocol.io'
const BSC_ORION_BLOCKCHAIN = 'https://dev-exp.orionprotocol.io'

describe('Api connect', () => {
    it('Connect and check', async () => {
        const provider = new ChainApi(BSC_RPC_URL, BSC_ORION_BLOCKCHAIN)
        await provider.init()
        // provider.connectWallet(wallet.privateKey)
        // const orion = new OrionBlockchain(provider, wallet.address, '')

        // const format = getNumberFormat(provider.blockchainInfo, 'ORN', 'DAI')

        // const order = {
        //   fromCurrency: 'ORN',
        //   toCurrency: 'DAI',
        //   side: 'sell',
        //   price: new BigNumber(12),
        //   amount: new BigNumber(10),
        //   senderAddress: wallet.address,
        //   priceDeviation: new BigNumber(1),
        //   numberFormat: format,
        //   needWithdraw: false
        // }

        // const balance = await orion.checkContractBalance('ORN', wallet.address)
        // console.log('balance: ', balance.toString());

        // const balanceReserved = await orion.checkReservedBalance(wallet.address)
        // console.log('balanceReserved: ', balanceReserved);

        // const signedOrder = await orion.signOrder(order)
        // console.log('signedOrder: ', signedOrder);

        // const sendOrder = await orion.sendOrder(signedOrder, false)
        // console.log('sendOrder: ', sendOrder);

        // const cancelOrder = {
        //   id: 9327,
        //   senderAddress: '0xe309Fb49005D01Df5d815a06a939260Ef0fff9ac',
        //   signature: '0xedf401f8842fdfe36cd88da2200ec3fcc53e936803f3a1dea8b3c1e61137af3b3c065d82671664b8bdfef7a2a5488d84e600d8c8f297576b97196326cb19dfe41b',
        //   isPersonalSign: false
        // }

        // const canceledOrder = await orion.cancelOrder(cancelOrder)
        // console.log('cancelOrder: ', canceledOrder);

        // const history = await provider.getTradeHistory(wallet.address)
        // // console.log('history: ', history)

        // const status = await provider.getOrderStatus(wallet.address, Number(history[0].id))
        // console.log('getOrderStatus: ', history[0], status);

    })
})
