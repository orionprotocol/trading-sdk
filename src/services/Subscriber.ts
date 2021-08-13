import { io } from "socket.io-client";

export function feedSubscriber (url: string, symbol?: string) {
    const wsUrl = symbol ? `${url}/ticker/${symbol}` : `${url}/allTickers`
    const socket = io(wsUrl, {
        reconnectionDelayMax: 10000,
    });
    return socket
}
