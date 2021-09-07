import BigNumber from "bignumber.js";
import { ethers } from "ethers";
import { Dictionary, DEFAULT_NUMBER_FORMAT, NumberFormat, BlockchainInfo,
    TradeOrder, TradeSubOrder, Side, OrderbookItem, Pair, GetFeeArgs, MatcherFeeArgs } from "./Models";
import { SWAP_THROUGH_ORION_POOL_GAS_LIMIT, FILL_ORDERS_AND_WITHDRAW_GAS_LIMIT, FILL_ORDERS_GAS_LIMIT} from '../utils/Constants'

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

export function toFeePrice(currency: string, nameToPrice: Dictionary<BigNumber>, feeAsset: string): BigNumber {
    const price = nameToPrice[currency].dividedBy(nameToPrice[feeAsset]);
    return price || new BigNumber(0);
}

export function calculateMatcherFee({baseAsset, amount, blockchainPrices, feePercent, feeAsset}: MatcherFeeArgs): BigNumber {
    const MATCHER_FEE_PERCENT: BigNumber = new BigNumber(feePercent).dividedBy(100);

    const feeAmount = amount.multipliedBy(MATCHER_FEE_PERCENT);
    const feeToAssetPrice = feeAmount.multipliedBy(toFeePrice(baseAsset, blockchainPrices, feeAsset));

    return feeToAssetPrice;
}

export function calculateNetworkFee({
    networkAsset,
    feeAsset,
    gasPriceWei,
    blockchainPrices,
    needWithdraw,
    isPool = false
}: {
    networkAsset: string,
    feeAsset: string,
    gasPriceWei: string,
    blockchainPrices: Dictionary<BigNumber>,
    needWithdraw: boolean,
    isPool: boolean}): { networkFeeEth: BigNumber, networkFee: BigNumber } {
    if (gasPriceWei === 'N/A') return {networkFeeEth: new BigNumber(0), networkFee: new BigNumber(0)};

    const gasPriceEth = new BigNumber(ethers.utils.formatUnits(gasPriceWei, 'ether'));

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

    const price = blockchainPrices[feeAsset] && blockchainPrices[networkAsset]
        ? blockchainPrices[networkAsset].dividedBy(blockchainPrices[feeAsset])
        : new BigNumber(0);
    const networkFee = networkFeeEth.multipliedBy(price);

    return {networkFeeEth, networkFee};
}

export function getFee ({
    asset,
    amount,
    networkAsset,
    gasPriceWei,
    blockchainPrices,
    feePercent,
    feeAsset = 'ORN',
    needWithdraw = false,
    isPool = false
}: GetFeeArgs): BigNumber {
    const matcherFee = calculateMatcherFee({ baseAsset: asset, amount, blockchainPrices, feePercent, feeAsset })
    const { networkFee } = calculateNetworkFee({ networkAsset, feeAsset, gasPriceWei, blockchainPrices, needWithdraw, isPool })

    const totalFee = matcherFee.plus(networkFee)
    return totalFee
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
    const amount = new BigNumber(item.orderQty);
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
    const sd = side ?? item.side.toLowerCase();
    const pr = pair ?? '';

    return {
        pair: pr,
        exchange: item.exchange,
        id: Number(item.id),
        amount: new BigNumber(item.subOrdQty),
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

export function parseOrderbookItems (message: {asks: Array<[]>, bids: Array<[]>}): {asks: OrderbookItem[], bids: OrderbookItem[]} {
    const { asks, bids } = message
    return {asks: asks.map(parseOrderbookItem), bids: bids.map(parseOrderbookItem)}
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

export function parsePairs (data: any[]): Record<string, Pair> {
    const newNameToPair: Record<string, Pair> = {};

    for (let i = 1; i < data.length; i++) {
        const arr: string[] = data[i];
        const pair = parsePair(arr);
        newNameToPair[pair.name] = pair;
    }
    return newNameToPair
}
