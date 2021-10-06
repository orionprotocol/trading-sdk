import 'jest-extended'
import { WS, Constants }  from '../src/index'
import { Pair, OrderbookItem }  from '../src/utils/Models'

jest.setTimeout(20000)

describe('Subscriber', () => {
    const wsUrl = Constants.ORION_WS.TEST.ETH
    const ws = new WS(wsUrl)

    it('Subscribe for all tickers price feed', async (done) => {

        // Create subscriber
        const subscriberForAll = ws.priceFeedAll()

        // Listen
        subscriberForAll.on('message', (message) => {
            subscriberForAll.close()
            const keys = Object.keys(message)
            expect(keys).toBeArray()
            expect(keys.length).toBeTruthy()
            done()
        });
    })

    it('Subscribe for specific ticker price feed', async (done) => {

        // Create another subscriber ORN-USDT
        const subscriberOrnUsdt = ws.priceFeedTicker('ORN-USDT')

        // Listen
        subscriberOrnUsdt.on('message', (message: Record<string, Pair>) => {
            subscriberOrnUsdt.close()
            const keys = Object.keys(message)
            const value: Pair = Object.values(message)[0]
            expect(keys).toBeArray()
            expect(keys.length).toBeTruthy()
            expect(value.lastPrice.gt(0)).toBeTruthy()
            expect(value.name === 'ORN-USDT').toBeTruthy()
            done()
        });

    })

    it('Subscribe for orderbooks', async (done) => {

        // Create subscriber
        const orderBooksSubscriber = ws.orderBooks('ORN-USDT')

        // Listen
        orderBooksSubscriber.on('message', (message) => {
            orderBooksSubscriber.close()
            const { asks, bids }: {asks: OrderbookItem[], bids: OrderbookItem[]} = message
            expect(asks).toBeArray()
            expect(bids).toBeArray()
            done()
        });

    })
})
