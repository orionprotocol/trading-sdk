/**
 * @jest-environment node
 */

import 'jest-extended'
import { Chain, OrionAggregator } from '../src/index'
import { SignOrderModelRaw, BlockchainOrder } from '../src/utils/Models'
import { ORDER_STATUSES, NETWORK } from '../src/utils/Constants'
import dotenv from 'dotenv';
dotenv.config()

jest.setTimeout(30000)

const { PRIVATE_KEY } = process.env

describe('Send order', () => {
    let chain: Chain
    let orionAggregator: OrionAggregator
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
        orionAggregator = new OrionAggregator(chain)
        expect(orionAggregator).toHaveProperty('chain')
    })

    it('Create and sign order', async () => {
        order = {
            fromCurrency: 'ORN',
            toCurrency: 'DAI',
            feeCurrency: 'ORN',
            side: 'sell',
            price: 20000,
            amount: 100,
            priceDeviation: 1,
            needWithdraw: false
        }

        signedOrder = await orionAggregator.createOrder(order)
        expect(signedOrder).toHaveProperty('id')
    })

    it('Send signed order', async () => {
        sentOrderResponse = await orionAggregator.sendOrder(signedOrder, false)
        expect(sentOrderResponse.orderId).toBeNumber()
    })

    it('Cancel order', async () => {
        const orderCancelation = await orionAggregator.cancelOrder(sentOrderResponse.orderId)
        expect(orderCancelation.orderId).toBeNumber()
    })

    it('Check order status', async () => {
        const order = await orionAggregator.getOrderById(sentOrderResponse.orderId)
        expect(ORDER_STATUSES).toContain(order.status)
    })

    it('Check order history', async () => {
        const history = await orionAggregator.getTradeHistory()
        expect(history).toBeArray()
    })
})
