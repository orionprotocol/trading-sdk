import Websocket from 'ws';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { ORION_WS } from '../utils/Constants'
import EventEmitter from 'events'
import { parseOrderbookItemsV2, parsePairs } from '../utils/Helpers';

const SubscriptionType = {
    ASSET_PAIRS_CONFIG_UPDATES_SUBSCRIBE: 'apcus',
    AGGREGATED_ORDER_BOOK_UPDATES_SUBSCRIBE: 'aobus',
    ADDRESS_UPDATES_SUBSCRIBE: 'aus',
}

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

    constructor(url: string = ORION_WS.MAIN.BSC) {
        this.wsOrionUrl = url
    }

    public async init(): Promise<boolean> {
        /* method is deprecated and unnecessary, but left for backward compatibility */
        return new Promise(resolve => resolve(true))
    }

    private connect (url: string, middleware?: MiddlewareFunction, query?: Record<string, unknown>): WsEmitter {
        const socket = new ReconnectingWebSocket(url, [], {
            WebSocket: Websocket
        });

        const localEmitter = new WsEmitter(socket);

        socket.onerror = (error) => {
            throw new Error(`WS connection error: ${error.message}!`)
        }

        socket.onmessage = (message) => {
            if (!message.data) return
            let handledMessage = JSON.parse(message.data)

            // Ping-pong handling
            if(handledMessage && handledMessage.T === 'pp') {
                socket.send(JSON.stringify(handledMessage))
                return
            }

            if (query && handledMessage.T && query.T !== `${handledMessage.T}s`) return

            if (middleware) handledMessage = middleware(handledMessage)

            localEmitter.emit('message', handledMessage);
        }

        if (query) socket.send(JSON.stringify(query))

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

    public orderBooks (pair: string): WsEmitter {
        return this.orderBooksV2(pair)
    }

    private orderBooksV2 (pair: string): WsEmitter {
        const url = `${this.wsOrionUrl}/v1`

        return this.connect(url, parseOrderbookItemsV2, {
            S: pair,
            T: SubscriptionType.AGGREGATED_ORDER_BOOK_UPDATES_SUBSCRIBE
        })
    }
}
