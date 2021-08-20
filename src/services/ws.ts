import Websocket from 'ws';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { ORION_WS } from '../utils/Constants'
import EventEmitter from 'events'
import { parseOrderbookItems, parsePairs } from '../utils/Helpers';

class WsEmitter extends EventEmitter {
    socket: ReconnectingWebSocket

    constructor (socket: ReconnectingWebSocket) {
        super()
        this.socket = socket
    }

    public close () {
        this.socket.close()
    }
}

interface MiddlewareFunction {
    (message: any): any;
}

export class WS {
    public readonly wsOrionUrl: string

    constructor(url: string = ORION_WS.TEST.BSC) {
        this.wsOrionUrl = url
    }

    private connect (url: string, middleware?: MiddlewareFunction): WsEmitter {
        const socket = new ReconnectingWebSocket(url, [], {
            WebSocket: Websocket
        });

        const localEmitter = new WsEmitter(socket);

        socket.onmessage = (message) => {
            if (!message.data) return

            let handledMessage = JSON.parse(message.data)

            if (middleware) handledMessage = middleware(handledMessage)

            localEmitter.emit('message', handledMessage);
        }

        return localEmitter
    }

    public priceFeedAll (): WsEmitter {
        const url = `${this.wsOrionUrl}/ws2/allTickers`

        return this.connect(url, parsePairs)
    }

    public priceFeedTicker (symbol: string): WsEmitter {
        const url = `${this.wsOrionUrl}/ws2/ticker/${symbol}`

        return this.connect(url, parsePairs)
    }

    public orderBooks (symbol: string): WsEmitter {
        const url = `${this.wsOrionUrl}/ws/${symbol}`

        return this.connect(url, parseOrderbookItems)
    }
}
