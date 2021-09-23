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

describe.skip('Send order with known chain prices', () => {
    let chain: Chain
    let orionAggregator: OrionAggregator
    let order: SignOrderModelRaw
    let signedOrder: BlockchainOrder
    let sentOrderResponse: {orderId: number}

    if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY is required for this test!')

    it('Create chain instance and init', async () => {
        chain = new Chain(PRIVATE_KEY, NETWORK.TEST.ETH)
        await chain.init()
        expect(chain.blockchainInfo).toHaveProperty('chainName')
        expect(chain.signer).toHaveProperty('address')
    })

    it('Create orionAggregator instance', async () => {
        orionAggregator = new OrionAggregator(chain)
        expect(orionAggregator).toHaveProperty('chain')
    })

    it('Create and sign order with known ornPrice and gasPrice', async () => {
        // Get current price for network asset
        const prices = await chain.getBlockchainPrices()
        const gasPriceWei = await chain.getGasPrice()
        const networkAssetPrice = prices[chain.blockchainInfo.baseCurrencyName].toString()

        order = {
            fromCurrency: 'ORN',
            toCurrency: 'UNI',
            side: 'sell',
            price: 10,
            amount: 10,
            priceDeviation: 1,
            needWithdraw: false,
            chainPrices: {
                networkAsset: networkAssetPrice,
                baseAsset: prices['ORN'].toString(),
                feeAsset: prices['ORN'].toString(),
                gasWei: gasPriceWei
            }
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

    it('Send order with empty token balance', async () => {
        // Empty balance for DAI token required

        order = {
            fromCurrency: 'USDC',
            toCurrency: 'USDT',
            side: 'sell',
            price: 2000,
            amount: 100,
            priceDeviation: 1,
            needWithdraw: false
        }

        try {
            await orionAggregator.createOrder(order)
        } catch (error) {
            expect(error instanceof Error).toBeTruthy();
        }
    })
})
