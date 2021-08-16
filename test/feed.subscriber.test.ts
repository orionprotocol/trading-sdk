import { WS }  from '../src/index'

describe('Subscriber', () => {
    it('Subscribe for tickers price feed', async () => {
        const ws = new WS('wss://staging.orionprotocol.io/ws2')

        // Create subscriber
        const subscriber = ws.priceFeedSubscriber()

        // Listen to feed
        subscriber.on('message', (message) => {
            subscriber.close()
            expect(!!message)
        })
    })
})
