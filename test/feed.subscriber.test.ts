import { WS }  from '../src/index'

describe('Subscriber', () => {
    it('Subscribe for tickers price feed', async () => {
        const ws = new WS('wss://dev-exp.orionprotocol.io')

        // Create subscriber
        const subscriberForAll = ws.priceFeedSubscriber()

        // Listen to feed
        subscriberForAll.on('message', (message: string) => {
            const parsedMessage = JSON.parse(message)
            expect(parsedMessage.length).toBeTruthy()
            subscriberForAll.close()
        })

        // Create another subscriber ORN-USDT
        const subscriberOrnUsdt = ws.priceFeedSubscriber('ORN-USDT')

        // Listen to feed
        subscriberOrnUsdt.on('message', (message: string) => {
            const parsedMessage: {asks: [], bids: []} = JSON.parse(message)
            expect(parsedMessage.asks.length).toBeTruthy()
            expect(parsedMessage.bids.length).toBeTruthy()
            subscriberOrnUsdt.close()
        })
    })
})
