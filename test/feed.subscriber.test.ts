import { WS }  from '../src/index'

describe('Subscriber', () => {
    it('Subscribe for all tickers price feed', async (done) => {
        const ws = new WS('wss://dev-exp.orionprotocol.io')

        // Create subscriber
        const subscriberForAll = ws.priceFeedSubscriber()

        // Listen to feed
        subscriberForAll.onmessage = (message) => {
            subscriberForAll.close()
            expect(message.data.length).toBeTruthy()
            done()
        }
    })

    it('Subscribe for specific ticker price feed', async (done) => {
        const ws = new WS('wss://dev-exp.orionprotocol.io')

        // Create another subscriber ORN-USDT
        const subscriberOrnUsdt = ws.priceFeedSubscriber('ORN-USDT')

        // Listen to feed
        subscriberOrnUsdt.onmessage = (message) => {
            subscriberOrnUsdt.close()
            const parsedMessage: {asks: [], bids: []} = JSON.parse(message.data)
            expect(parsedMessage.asks.length).toBeTruthy()
            expect(parsedMessage.bids.length).toBeTruthy()
            done()
        }
    })
})
