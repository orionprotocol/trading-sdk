import BigNumber from "bignumber.js";
import { ethers } from "ethers";
import { Dictionary, DEFAULT_NUMBER_FORMAT, NumberFormat, BlockchainInfo, TradeOrder, TradeSubOrder, Side, 
    OrderbookItem, Pair, Transaction, Orderbook, OrderData } from "./Models";
import { ChainApi } from "../main";

export const ETH_CHAIN_ID = 3

export const MATCHER_FEE_PERCENT: BigNumber = new BigNumber(0.2).dividedBy(100); // 0.2%

export const SWAP_THROUGH_ORION_POOL_GAS_LIMIT = 350000;
export const FILL_ORDERS_AND_WITHDRAW_GAS_LIMIT = 385000;
export const FILL_ORDERS_GAS_LIMIT = 220000;
export const DEPOSIT_ETH_GAS_LIMIT = 220000;
export const DEPOSIT_ERC20_GAS_LIMIT = 250000;

export function getPriceWithDeviation(price: BigNumber, side: string, deviation: BigNumber): BigNumber {
    const d = deviation.dividedBy(100)
    const percent = (side === 'buy' ? d : d.negated()).plus(1);
    return price.multipliedBy(percent);
}

export function sumBigNumber(arr: BigNumber[]): BigNumber {
    let result = new BigNumber(0);
    for (const x of arr) {
        result = result.plus(x);
    }
    return result;
}

function toOrnPrice(currency: string, nameToPrice: Dictionary<BigNumber>): BigNumber {
    const price = nameToPrice[currency];
    if (!price) return new BigNumber(0);
    return price;
}

export function getPairNumberFormat(pairName: string, numberFormat: Dictionary<NumberFormat>): NumberFormat {
    return numberFormat[pairName] || DEFAULT_NUMBER_FORMAT;
}

export function calculateMatcherFee(fromCurrency: string, amount: BigNumber, price: BigNumber, side: string, nameToPrice: Dictionary<BigNumber>, inOrn: boolean): BigNumber {
    if (inOrn) {
        const feeValue = amount.multipliedBy(MATCHER_FEE_PERCENT);
        const feeValueInOrn = feeValue.multipliedBy(toOrnPrice(fromCurrency, nameToPrice));
        return feeValueInOrn;
    } else {
        if (side === 'buy') {
            return amount.multipliedBy(MATCHER_FEE_PERCENT)
        } else {
            return amount.multipliedBy(price).multipliedBy(MATCHER_FEE_PERCENT);
        }
    }
}

export function calculateNetworkFee(provider: ChainApi, gasPriceGwei: string, nameToPrice: Dictionary<BigNumber>, currency: string, needWithdraw: boolean, isPool = false): { networkFeeEth: BigNumber, networkFee: BigNumber } {
    if (gasPriceGwei === 'N/A') return {networkFeeEth: new BigNumber(0), networkFee: new BigNumber(0)};

    const gasPriceEth = new BigNumber(ethers.utils.formatUnits(gasPriceGwei, 'gwei'));
    let gasLimit: number;
    if (isPool) {
        gasLimit = SWAP_THROUGH_ORION_POOL_GAS_LIMIT;
    } else {
        if (needWithdraw) {
            gasLimit = FILL_ORDERS_AND_WITHDRAW_GAS_LIMIT;
        } else {
            gasLimit = FILL_ORDERS_GAS_LIMIT;
        }
    }
    const networkFeeEth = gasPriceEth.multipliedBy(gasLimit);

    const baseCurrencyName = provider.blockchainInfo.baseCurrencyName;
    const price = nameToPrice[currency] && nameToPrice[baseCurrencyName] ? nameToPrice[baseCurrencyName].dividedBy(nameToPrice[currency]) : new BigNumber(0);
    const networkFee = networkFeeEth.multipliedBy(price);
    return {networkFeeEth, networkFee};
}

export function getNumberFormat(info: BlockchainInfo, from: string, to: string): NumberFormat {
    const format = {...DEFAULT_NUMBER_FORMAT}
    format.name = `${from}-${to}`
    if(!info.assetToDecimals[from]) throw new Error('Invalid asset "from"')
    if(!info.assetToDecimals[to]) throw new Error('Invalid asset "to"')
    format.baseAssetPrecision = info.assetToDecimals[from]
    format.quoteAssetPrecision = info.assetToDecimals[to]
    return format
}

export function parseTradeOrder(item: any): TradeOrder {
    const amount = new BigNumber(process.env.REACT_APP_AGG_V2 ? item.amount : item.orderQty);
    const price = new BigNumber(item.price);
    const [fromCurrency, toCurrency] = item.symbol.split('-');
    const subOrders = item.subOrders ? item.subOrders.map((sub: any) => parseTradeSubOrder(sub, item.symbol, item.side)) : [];

    const total = amount.multipliedBy(price);

    return {
        ...{
            date: Number(item.time),
            clientOrdId: item.clientOrdId,
            id: Number(item.id),
            type: item.side, // 'buy' / 'sell'
            pair: item.symbol, // 'ETH-BTC'
        },
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

export function orderDataEquals(a?: OrderData, b?: OrderData): boolean {
    if (!a && !b) return true;
    if (!a) return false;
    if (!b) return false;
    return a.price.eq(b.price) && a.amount.eq(b.amount) && a.total.eq(b.total);
}