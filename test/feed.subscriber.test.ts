import { WS }  from '../src/index'

describe('Subscriber', () => {
    const wsUrl = 'wss://dev-exp.orionprotocol.io'

    it('Subscribe for all tickers price feed', async (done) => {
        const ws = new WS(wsUrl)

        // Create subscriber
        const subscriberForAll = ws.priceFeed()

        // Listen
        subscriberForAll.onmessage = (message) => {
            subscriberForAll.close()
            expect(message.data.length).toBeTruthy()
            done()
        }
    })

    it('Subscribe for specific ticker price feed', async (done) => {
        const ws = new WS(wsUrl)

        // Create another subscriber ORN-USDT
        const subscriberOrnUsdt = ws.priceFeed('ORN-USDT')

        // Listen
        subscriberOrnUsdt.onmessage = (message) => {
            subscriberOrnUsdt.close()
            const { asks, bids }: {asks: [], bids: []} = JSON.parse(message.data)
            expect(asks.length).toBeTruthy()
            expect(bids.length).toBeTruthy()
            done()
        }
    })

    it('Subscribe for orderbooks', async (done) => {
        const ws = new WS(wsUrl)

        // Create subscriber
        const orderBooksSubscriber = ws.orderBooks('ORN-USDT')

        // Listen
        orderBooksSubscriber.onmessage = (message) => {
            orderBooksSubscriber.close()
            const { asks, bids }: {asks: [], bids: []} = JSON.parse(message.data)
            expect(asks.length).toBeTruthy()
            expect(bids.length).toBeTruthy()
            done()
        }
    })
})
