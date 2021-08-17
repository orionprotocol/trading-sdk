import WebSocket from 'ws';

export class WS {
    public readonly wsOrionUrl: string

    constructor(url: string) {
        this.wsOrionUrl = url
    }

    /* Return listener for price feed */
    public priceFeedSubscriber (symbol?: string): WebSocket {
        const wsUrl = symbol
            ? `${this.wsOrionUrl}/ws/ticker/${symbol}`
            : `${this.wsOrionUrl}/ws2/allTickers`

        const socket = new WebSocket(wsUrl, {
            perMessageDeflate: false
        });

        return socket
    }
}
