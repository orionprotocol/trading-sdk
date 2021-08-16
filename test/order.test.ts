import { Chain, Orion } from '../src/index'
import { SignOrderModelRaw, BlockchainOrder } from '../src/utils/Models'
import dotenv from 'dotenv';
dotenv.config()

const { PRIVATE_KEY } = process.env

const rpcUrl = 'https://data-seed-prebsc-2-s1.binance.org:8545/'
const orionBlockchainUrl  = 'https://dev-exp.orionprotocol.io'

describe('Send order', () => {
    let chain: Chain
    let orion: Orion
    let order: SignOrderModelRaw
    let signedOrder: BlockchainOrder
    let sentOrderResponse: {orderId: number}

    if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY is required for this test!')

    it('Create chain instance and init', async () => {
        chain = new Chain(rpcUrl, orionBlockchainUrl, PRIVATE_KEY)
        await chain.init()
    })

    it('Create orion instance', async () => {
        orion = new Orion(chain)
    })

    it('Sign order', async () => {
        order = {
            fromCurrency: 'ORN',
            toCurrency: 'DAI',
            side: 'sell',
            price: 12,
            amount: 10,
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
        const status = await chain.getOrderStatus(sentOrderResponse.orderId)
        expect(typeof status == 'string')
    })

    it('Check order history', async () => {
        const history = await chain.getTradeHistory()
        expect(Array.isArray(history))
    })
})
