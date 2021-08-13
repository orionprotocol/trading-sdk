import { feedSubscriber } from '../src/services/Subscriber'

const FEED_URL = 'wss://dev-exp.orionprotocol.io/ws2'

describe('Subscriber', () => {
    it('Subscribe for tickers feed', async () => {
        const subscriber = feedSubscriber(FEED_URL, 'ORN')
        console.log(subscriber);
        subscriber.onAny((response) => {
            console.log('response: ', response);
        })

        setTimeout(() => {
            console.log('ends');
        }, 5000);
    })
})
