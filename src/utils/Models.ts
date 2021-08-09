import BigNumber from "bignumber.js";

export interface Dictionary<T> {
    [key: string]: T;
}

export interface BlockchainInfo {
    baseCurrencyName: string;
    chainId: number;
    chainName: string;
    exchangeContractAddress: string;
    matcherAddress: string;
    assetToAddress: Dictionary<string>;
    assetToDecimals: Dictionary<number>;
    assetToIcons: Dictionary<string>;
}

export interface PoolsConfig {
    governanceAddress: string;
    votingAddress: string;
    factoryAddress: string;
    routerAddress: string;
    pools: Record<string, PoolConfig>;
}

export interface PoolConfig {
    stakingRewardAddress: string;
    lpTokenAddress: string;
    vote_rewards_disabled?: boolean;
    rewardToken?: string;
}

export interface SignOrderModel {
    fromCurrency: string, 
    toCurrency: string, 
    side: string, 
    price: BigNumber, 
    amount: BigNumber, 
    // matcherFee: BigNumber, 
    senderAddress: string, 
    priceDeviation: BigNumber, 
    // feeCurrency: string, 
    numberFormat: NumberFormat, 
    needWithdraw: boolean
}

export interface BlockchainOrder {
    id: string; // hash of BlockchainOrder (it's not part of order structure in smart-contract)

    senderAddress: string; // address
    matcherAddress: string; // address
    baseAsset: string; // address
    quoteAsset: string; // address
    matcherFeeAsset: string; // address
    amount: number; // uint64
    price: number; // uint64
    matcherFee: number; // uint64
    nonce: number; // uint64
    expiration: number; // uint64
    buySide: number; // uint8, 1=buy, 0=sell
    isPersonalSign: boolean; // bool
    signature: string; // bytes
    needWithdraw?: boolean; // bool (not supported yet by smart-contract)
}

export interface NumberFormat {
    name: string;
    minQty: number; // validating order amount
    maxQty: number;
    minPrice: number;  // validating order price
    maxPrice: number;
    pricePrecision: number; // formatting price
    qtyPrecision: number; // formatting amount
    baseAssetPrecision: number; // fromCurrency
    quoteAssetPrecision: number; // formatting totals / toCurrency
    limitOrderThreshold?: number;
    executableOnBrokersPriceDeviation?: number;
}

export const DEFAULT_NUMBER_FORMAT: NumberFormat = {
    "name": "ETH-BTC",
    "minQty": 0,
    "maxQty": Number.MAX_VALUE,
    "minPrice": 0,
    "maxPrice": Number.MAX_VALUE,
    "pricePrecision": 8,
    "qtyPrecision": 8,
    "baseAssetPrecision": 8,
    "quoteAssetPrecision": 8,
    "limitOrderThreshold": 0.001,
    "executableOnBrokersPriceDeviation": 0.001
}

export enum Side {
    BUY = 'buy',
    SELL = 'sell',
}

export enum OrderType {
    LIMIT = 'LIMIT',
    MARKET = 'MARKET',
}

export interface OrderbookItem {
    price: BigNumber;
    size: BigNumber;
    total: BigNumber;
    cumulativeSize: BigNumber;
    cumulativeTotal: BigNumber;
    avgPrice: BigNumber;
    deltaSize: number;
    exchanges: string[];
}

export function parseOrderbookItem(arr: any): OrderbookItem {
    const price = new BigNumber(arr[0]);
    const size = new BigNumber(arr[1]);
    return {
        price: price,
        size: size,
        total: price.multipliedBy(size),
        cumulativeSize: new BigNumber(0),
        cumulativeTotal: new BigNumber(0),
        avgPrice: new BigNumber(0),
        deltaSize: 0,
        exchanges: (arr[2] as string[])?.map(s => s.toLowerCase())
    }
}

export interface Orderbook {
    asks: OrderbookItem[];
    bids: OrderbookItem[];
    maxAskSize: BigNumber,
    maxAskTotal: BigNumber,
    maxBidSize: BigNumber,
    maxBidTotal: BigNumber,
}

export function defaultOrderbook(): Orderbook {
    return {
        asks: [],
        bids: [],
        maxAskSize: new BigNumber(0),
        maxAskTotal: new BigNumber(0),
        maxBidSize: new BigNumber(0),
        maxBidTotal: new BigNumber(0),
    }
}

export function fromMinToMax(a: OrderbookItem, b: OrderbookItem) {
    if (a.price.gt(b.price)) return 1;
    if (a.price.lt(b.price)) return -1;
    return 0;
}

export function fromMaxToMin(a: OrderbookItem, b: OrderbookItem) {
    if (a.price.gt(b.price)) return -1;
    if (a.price.lt(b.price)) return 1;
    return 0;
}

export interface OrderData {
    price: BigNumber;
    amount: BigNumber;
    total: BigNumber;
    isAsk: boolean;
}

export function orderDataEquals(a?: OrderData, b?: OrderData): boolean {
    if (!a && !b) return true;
    if (!a) return false;
    if (!b) return false;
    return a.price.eq(b.price) && a.amount.eq(b.amount) && a.total.eq(b.total);
}

export interface Pair {
    name: string;
    fromCurrency: string;
    toCurrency: string;
    lastPrice: BigNumber;
    openPrice: BigNumber;
    change24h: BigNumber;
    high: BigNumber;
    low: BigNumber;
    vol24h: BigNumber;
}

export function parsePair(arr: string[]): Pair {
    const name = arr[0]; // "ETH-BTC"
    const [fromCurrency, toCurrency] = name.split('-');
    const lastPrice = new BigNumber(arr[1]);
    const openPrice = new BigNumber(arr[2]);
    const change24h = lastPrice.div(openPrice).minus(1).multipliedBy(100);
    const high = new BigNumber(arr[3]);
    const low = new BigNumber(arr[4]);
    const vol24h = new BigNumber(arr[5]);
    return {name, fromCurrency, toCurrency, lastPrice, openPrice, change24h, high, low, vol24h};
}

export const getDefaultPair = (name: string): Pair => {
    const arr = name.split('-');
    return {
        name: name,
        fromCurrency: arr[0],
        toCurrency: arr[1],
        lastPrice: new BigNumber(0),
        openPrice: new BigNumber(0),
        change24h: new BigNumber(0),
        high: new BigNumber(0),
        low: new BigNumber(0),
        vol24h: new BigNumber(0),
    }
}

export interface Transaction {
    type: 'deposit' | 'withdrawal';
    date: number; // in millis
    token: string;
    amount: BigNumber;
    status: 'Pending' | 'Done' | 'Bridge' | 'Approving' | 'Cancelled';
    transactionHash: string;
    user: string;
    chainId?: number,
    bridgeOrderId?: string;
    bridgeDepositAddress?: string;
    nativeWithdrawAddress?: string;
    bridgeDepositAmount?: BigNumber; // full amount to deposit to bridge
}

export function parseTransaction(item: any): Transaction {
    const createdAt: number = item.createdAt;
    return {
        type: item.type,
        date: createdAt * 1000,
        token: item.asset,
        amount: new BigNumber(item.amountNumber),
        status: 'Done',
        transactionHash: item.transactionHash,
        user: item.user,
    }
}

export type SubOrderStatus =
    'NEW'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'VALIDATION_FAILED'
    | 'FILLED'
    | 'TX_PENDING'
    | 'CANCELED'
    | 'FAILED'
    | 'SETTLED';

export interface TradeSubOrder {
    pair: string;
    exchange: string;
    id: number;
    amount: BigNumber;
    price: BigNumber;
    status: SubOrderStatus;
    side: Side;
    subOrdQty: number;
}

export function parseTradeSubOrder(item: any, pair?: string, side?: Side): TradeSubOrder {
    let symbol = '';
    if (process.env.REACT_APP_AGG_V2) {
        const fromCurrency = item.assetPair.amountAsset.asset;
        const toCurrency = item.assetPair.priceAsset.asset;
        symbol = fromCurrency + '-' + toCurrency;
    }
    const sd = side ?? item.side.toLowerCase();
    const pr = pair ?? symbol;

    return {
        pair: pr,
        exchange: item.exchange,
        id: Number(item.id),
        amount: new BigNumber(process.env.REACT_APP_AGG_V2 ? item.amount : item.subOrdQty),
        price: new BigNumber(item.price),
        status: item.status || 'NEW', // todo: backend,
        subOrdQty: item.subOrdQty,
        side: sd,
    }
}

export type OrderStatus =
  | "NEW"
  | "ACCEPTED"
  | "DIRECT_SWAP_PENDING"
  | "ROUTING"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "TX_PENDING"
  | "REJECTED"
  | "SETTLED"
  | "CANCELED"
  | "FAILED";

export interface TradeOrder {
    blockchainOrder?: Record<string, unknown>,
    status: OrderStatus;
    date: number;
    clientOrdId: string;
    id: number | string;
    type: string;
    pair: string;
    fromCurrency: string;
    toCurrency: string;
    amount: BigNumber;
    price: BigNumber;
    total: BigNumber;
    subOrders: TradeSubOrder[];
}

export function parseTradeOrder(item: any): TradeOrder {
    const amount = new BigNumber(process.env.REACT_APP_AGG_V2 ? item.amount : item.orderQty);
    const price = new BigNumber(item.price);


    let fromCurrency: string;
    let toCurrency: string;
    let subOrders: TradeSubOrder[];
    let symbol = '';
    let side = '';

    if (process.env.REACT_APP_AGG_V2) {
        fromCurrency = item.assetPair.amountAsset.asset;
        toCurrency = item.assetPair.priceAsset.asset;
        symbol = fromCurrency + '-' + toCurrency;
        side = item.side.toLowerCase();

        subOrders = [];

        if (item.subOrders) {
            for (const id in item.subOrders) {
                subOrders.push(parseTradeSubOrder(item.subOrders[id]))
            }
        }

    } else {
        [fromCurrency, toCurrency] = item.symbol.split('-');
        subOrders = item.subOrders ? item.subOrders.map((sub: any) => parseTradeSubOrder(sub, item.symbol, item.side)) : [];
    }

    const total = amount.multipliedBy(price);

    // if (subOrders.length > 0) {
    //     let subOrdersAmount = new BigNumber(0);
    //     total = new BigNumber(0);
    //     for (let subOrder of subOrders) {
    //         const subOrderTotal = subOrder.amount.multipliedBy(subOrder.price);
    //         subOrdersAmount = subOrdersAmount.plus(subOrder.amount);
    //         total = total.plus(subOrderTotal);
    //     }
    //     if (amount.gt(subOrdersAmount)) {
    //         const rest = amount.minus(subOrdersAmount);
    //         total = total.plus(rest.multipliedBy(price));
    //     }
    //     price = total.dividedBy(amount);
    // }

    return {
        ...(process.env.REACT_APP_AGG_V2 ? {
            date: Number(item.creationTime),
            clientOrdId: item.blockchainOrder.id,
            id: item.id,
            type: side, // 'buy' / 'sell'
            pair: symbol,
        } : {
            date: Number(item.time),
            clientOrdId: item.clientOrdId,
            id: Number(item.id),
            type: item.side, // 'buy' / 'sell'
            pair: item.symbol, // 'ETH-BTC'
        }),
        blockchainOrder: item?.blockchainOrder,
        status: item.status,
        fromCurrency,
        toCurrency,
        amount,
        price,
        total,
        subOrders
    };
}

export function canCancelOrder(order: TradeOrder): boolean {
    return order.status === 'NEW' ||
        order.status === 'ACCEPTED' ||
        order.status === 'ROUTING' ||
        order.status === 'PARTIALLY_FILLED';
}

export function isOrderOpen(order: TradeOrder): boolean {
    return order.status === 'NEW' ||
        order.status === 'ACCEPTED' ||
        order.status === 'ROUTING' ||
        order.status === 'PARTIALLY_FILLED' ||
        order.status === 'FILLED' ||
        order.status === 'TX_PENDING' ||
        order.status === 'DIRECT_SWAP_PENDING';
}
