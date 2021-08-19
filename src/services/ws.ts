import Websocket from 'ws';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { ORION_WS } from '../utils/Constants'

export class WS {
    public readonly wsOrionUrl: string

    constructor(url: string = ORION_WS.TEST.BSC) {
        this.wsOrionUrl = url
    }

    private connect (url: string) {
        const socket = new ReconnectingWebSocket(url, [], {
            WebSocket: Websocket
        });

        return socket
    }

    /* Return listener for price feed */
    public priceFeed (symbol?: string): ReconnectingWebSocket {
        const url = symbol
            ? `${this.wsOrionUrl}/ws/ticker/${symbol}`
            : `${this.wsOrionUrl}/ws2/allTickers`

        return this.connect(url)
    }

    public orderBooks (symbol: string): ReconnectingWebSocket {
        const url = `${this.wsOrionUrl}/ws/${symbol}`

        return this.connect(url)
    }
}
