import 'jest-extended'
import { Chain, Orion } from '../src/index'
import { SignOrderModelRaw, BlockchainOrder } from '../src/utils/Models'
import { ORDER_STATUSES, NETWORK } from '../src/utils/Constants'
import dotenv from 'dotenv';
dotenv.config()

const { PRIVATE_KEY } = process.env

describe('Send order with known chain prices', () => {
    let chain: Chain
    let orion: Orion
    let order: SignOrderModelRaw
    let signedOrder: BlockchainOrder
    let sentOrderResponse: {orderId: number}

    if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY is required for this test!')

    it('Create chain instance and init', async () => {
        chain = new Chain(PRIVATE_KEY, NETWORK.TEST.BSC)
        await chain.init()
        expect(chain.blockchainInfo).toHaveProperty('chainName')
        expect(chain.signer).toHaveProperty('address')
    })

    it('Create orion instance', async () => {
        orion = new Orion(chain)
        expect(orion).toHaveProperty('chain')
    })

    it('Sign order with known ornPrice and gasPrice', async () => {
        order = {
            fromCurrency: 'ORN',
            toCurrency: 'DAI',
            side: 'sell',
            price: 20000,
            amount: 100,
            priceDeviation: 1,
            needWithdraw: false,
            chainPrices: {
                orn: 1,
                baseCurrency: 57,
                gasWei: '10000000000'
            }
        }

        signedOrder = await orion.signOrder(order)
        expect(signedOrder).toHaveProperty('id')
    })

    it('Send signed order', async () => {
        sentOrderResponse = await orion.sendOrder(signedOrder, false)
        expect(sentOrderResponse.orderId).toBeNumber()
    })

    it('Cancel order', async () => {
        const orderCancelation = await orion.cancelOrder(sentOrderResponse.orderId)
        expect(orderCancelation.orderId).toBeNumber()
    })

    it('Check order status', async () => {
        const order = await chain.getOrderById(sentOrderResponse.orderId)
        expect(ORDER_STATUSES).toContain(order.status)
    })
})
