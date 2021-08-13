import { ChainApi } from '../src/services/ChainApi'
import { OrionBlockchain } from '../src/services/OrionBlockchain'
import { SignOrderModelRaw, BlockchainOrder} from '../src/utils/Models'
import dotenv from 'dotenv';
dotenv.config()

const { WALLET_ADDRESS, PRIVATE_KEY } = process.env

const rpcUrl = 'https://data-seed-prebsc-2-s1.binance.org:8545/'
const orionBlockchainApiUrl  = 'https://dev-exp.orionprotocol.io'

describe('Send order', () => {
    let sdkApi: ChainApi
    let orion: OrionBlockchain
    let order: SignOrderModelRaw
    let signedOrder: BlockchainOrder
    let sentOrderResponse: {orderId: number}

    if (!WALLET_ADDRESS || !PRIVATE_KEY) throw new Error('WALLET_ADDRESS and PRIVATE_KEY are required for this test!')

    it('Create api instance and init', async () => {
        sdkApi = new ChainApi(rpcUrl, orionBlockchainApiUrl )
        await sdkApi.init()
    })

    it('Connect wallet', async () => {
        sdkApi.connectWallet(PRIVATE_KEY)
    })

    it('Create orion instance', async () => {
        orion = new OrionBlockchain(sdkApi, WALLET_ADDRESS, '')
    })

    it('Sign order', async () => {

        order = {
            fromCurrency: 'ORN',
            toCurrency: 'DAI',
            side: 'sell',
            price: 12,
            amount: 10,
            senderAddress: WALLET_ADDRESS,
            priceDeviation: 1,
            needWithdraw: false
        }

        signedOrder = await orion.signOrder(order)
    })

    it('Send signed order', async () => {
        sentOrderResponse = await orion.sendOrder(signedOrder, false)
        expect(typeof sentOrderResponse.orderId == 'number')
    })

    it('Check order status', async () => {
        const status = await sdkApi.getOrderStatus(WALLET_ADDRESS, sentOrderResponse.orderId)
        expect(typeof status == 'string')
    })

    it('Check order history', async () => {
        const history = await sdkApi.getTradeHistory(WALLET_ADDRESS)
        expect(Array.isArray(history))
    })
})
