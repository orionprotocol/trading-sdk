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
    senderAddress: string,
    priceDeviation: BigNumber,
    numberFormat: NumberFormat,
    needWithdraw: boolean,
    gasPriceGwei?: string // in case if user already knows this value
}

export interface SignOrderModelRaw {
    fromCurrency: string,
    toCurrency: string,
    side: string,
    price: number,
    amount: number,
    senderAddress: string,
    priceDeviation: number,
    needWithdraw: boolean,
    gasPriceGwei?: string // in case if user already knows this value
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

export interface CancelOrderRequest {
    id: number | string;
    senderAddress: string;
    signature: string;
    isPersonalSign: boolean;
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

export interface Orderbook {
    asks: OrderbookItem[];
    bids: OrderbookItem[];
    maxAskSize: BigNumber,
    maxAskTotal: BigNumber,
    maxBidSize: BigNumber,
    maxBidTotal: BigNumber,
}

export interface OrderData {
    price: BigNumber;
    amount: BigNumber;
    total: BigNumber;
    isAsk: boolean;
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

