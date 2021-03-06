import BigNumber from "bignumber.js";
import { ethers } from "ethers";
import { AxiosResponse, AxiosPromise } from "axios"
import { Dictionary, BlockchainInfo, TradeOrderV2, TradeSubOrderV2,
    TradeOrder, TradeSubOrder, OrderbookItem, Pair, GetFeeArgs, MatcherFeeArgs, OrderbookUpdates, TxType } from "./Models";
import { EXCHANGE_ORDER_PRECISION} from '../utils/Constants'
import { Chain } from '../services/chain'
import erc20ABI from '../abis/ERC20.json'
import { TxError } from './TxError'

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

function toFeePrice(currency: string, nameToPrice: Dictionary<BigNumber>, feeAsset: string): BigNumber {
    const price = nameToPrice[currency].dividedBy(nameToPrice[feeAsset]);
    return price || new BigNumber(0);
}

function calculateMatcherFee({baseAsset, amount, assetsPrices, feePercent, feeAsset}: MatcherFeeArgs): BigNumber {
    const MATCHER_FEE_PERCENT: BigNumber = new BigNumber(feePercent).dividedBy(100);

    const feeAmount = amount.multipliedBy(MATCHER_FEE_PERCENT);
    const feeToAssetPrice = feeAmount.multipliedBy(toFeePrice(baseAsset, assetsPrices, feeAsset));

    return feeToAssetPrice;
}

function calculateNetworkFee({
    networkAsset,
    feeAsset,
    gasPriceWei,
    assetsPrices,
    needWithdraw,
    isPool = false,
    limits
}: {
    networkAsset: string,
    feeAsset: string,
    gasPriceWei: string,
    assetsPrices: Dictionary<BigNumber>,
    needWithdraw: boolean,
    isPool: boolean,
    limits: Dictionary<number>
}): { networkFeeEth: BigNumber, networkFee: BigNumber } {
    if (gasPriceWei === 'N/A') return {networkFeeEth: new BigNumber(0), networkFee: new BigNumber(0)};

    const requiredKeys = ['SWAP_THROUGH_ORION_POOL_GAS_LIMIT', 'FILL_ORDERS_AND_WITHDRAW_GAS_LIMIT', 'FILL_ORDERS_GAS_LIMIT']
    requiredKeys.forEach(key => {
        if (!Object.keys(limits).includes(key)) throw new Error(`${key} in limits is required!`)
    })

    const { SWAP_THROUGH_ORION_POOL_GAS_LIMIT, FILL_ORDERS_AND_WITHDRAW_GAS_LIMIT, FILL_ORDERS_GAS_LIMIT } = limits

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

    const price = assetsPrices[feeAsset] && assetsPrices[networkAsset]
        ? assetsPrices[networkAsset].dividedBy(assetsPrices[feeAsset])
        : new BigNumber(0);
    const networkFee = networkFeeEth.multipliedBy(price);

    return {networkFeeEth, networkFee};
}
/*
    getFee return fee value rounded with EXCHANGE_ORDER_PRECISION
*/
export function getFee ({
    baseAsset,
    amount,
    networkAsset,
    gasPriceWei,
    assetsPrices,
    feePercent,
    feeAsset = 'ORN',
    needWithdraw = false,
    isPool = false,
    limits
}: GetFeeArgs): BigNumber {
    if (!amount || new BigNumber(amount).isNaN() || new BigNumber(amount).lte(0)) throw new Error('amount field is invalid!')
    if (!feePercent || Number.isNaN(Number(feePercent)) || Number(feePercent) <= 0) throw new Error('feePercent field is invalid!')

    if (!gasPriceWei || new BigNumber(gasPriceWei).isNaN() || new BigNumber(gasPriceWei).lte('0')) {
        throw new Error('gasPriceWei field is invalid!')
    }

    if (!assetsPrices || !Object.entries(assetsPrices).length) {
        throw new Error('assetsPrices field is invalid!')
    }
    Object.keys(assetsPrices).forEach(key => {
        assetsPrices[key] = new BigNumber(assetsPrices[key])
        if (assetsPrices[key].isNaN() || assetsPrices[key].lte(0)) throw new Error(`assetsPrices.${key} value should be valid BigNumber`)
    })

    if (!assetsPrices[baseAsset]) throw new Error('baseAsset field is invalid!')
    if (!assetsPrices[feeAsset]) throw new Error('feeAsset field is invalid!')
    if (!assetsPrices[networkAsset]) throw new Error('networkAsset field is invalid!')

    if (!limits || !Object.keys(limits).length) throw new Error('limits field is required')
    if (!Object.values(limits).every(el => typeof el === 'number' && el > 0)) throw new Error('limits values should be positive numbers')

    const matcherFee = calculateMatcherFee({ baseAsset, amount, assetsPrices, feePercent, feeAsset })
    const { networkFee } = calculateNetworkFee({ networkAsset, feeAsset, gasPriceWei, assetsPrices, needWithdraw, isPool, limits })

    if (!matcherFee.gt(0)) throw new Error('matcherFee couldn`t be 0!')
    if (!networkFee.gt(0)) throw new Error('networkFee couldn`t be 0!')

    const totalFee = matcherFee.plus(networkFee).decimalPlaces(EXCHANGE_ORDER_PRECISION)

    return totalFee
}

export function parseTradeOrder(item: any): TradeOrder {
    const amount = new BigNumber(item.orderQty);
    const price = new BigNumber(item.price);
    const subOrders = item.subOrders ? item.subOrders.map((subOrder: any) => parseTradeSubOrder(subOrder)) : [];

    const total = amount.multipliedBy(price);

    return {
        ...{
            date: Number(item.time),
            sender: item.clientId,
            id: Number(item.id),
            type: item.side, // 'buy' / 'sell'
            pair: item.symbol, // 'ETH-BTC'
        },
        blockchainOrder: item?.blockchainOrder,
        status: item.status,
        baseAsset: item.baseAsset,
        quoteAsset: item.quoteAsset,
        feeAsset: item.feeCurrency,
        fee: new BigNumber(item.feeQty),
        side: item.side,
        amount,
        price,
        total,
        subOrders
    };
}

export function parseTradeSubOrder(item: any): TradeSubOrder {
    return {
        pair: item.symbol,
        exchange: item.exchange,
        id: Number(item.id),
        amount: new BigNumber(item.subOrdQty),
        price: new BigNumber(item.price),
        status: item.status || 'NEW',
        side: item.side,
        sent: item.sent,
    }
}

export function parseTradeOrderV2(item: any): TradeOrderV2 {
    const amount = new BigNumber(item.amount);
    const price = new BigNumber(item.price);
    const [baseAsset, quoteAsset] = item.assetPair.split('-')
    const subOrdersKeys = Object.keys(item.subOrders)
    const subOrders = subOrdersKeys.length ? subOrdersKeys.map((key: any) => parseTradeSubOrderV2(item.subOrders[key])) : [];

    const total = amount.multipliedBy(price);

    return {
        ...{
            date: Number(item.creationTime),
            sender: item.sender,
            id: item.id,
            type: item.side, // 'buy' / 'sell'
            pair: item.assetPair, // 'ETH-BTC'
        },
        blockchainOrder: item?.blockchainOrder,
        status: item.status,
        baseAsset,
        quoteAsset,
        feeAsset: item.feeAsset,
        fee: new BigNumber(item.fee),
        amount,
        side: item.side,
        price,
        total,
        subOrders
    };
}

export function parseTradeSubOrderV2(item: any): TradeSubOrderV2 {
    return {
        pair: item.assetPair,
        exchange: item.exchange,
        id: Number(item.id),
        amount: new BigNumber(item.amount),
        price: new BigNumber(item.price),
        status: item.status || 'NEW',
        side: item.side,
        tradesInfo: item.tradesInfo
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

export function parseOrderbookItemsV1 (message: {asks: Array<[]>, bids: Array<[]>}): {asks: OrderbookItem[], bids: OrderbookItem[]} {
    const { asks, bids } = message
    return {asks: asks.map(parseOrderbookItem), bids: bids.map(parseOrderbookItem)}
}

export function parseOrderbookItemsV2 (message: OrderbookUpdates): {asks: OrderbookItem[], bids: OrderbookItem[]} {
    const { a, b } = message.ob
    return {asks: a.map(parseOrderbookItem), bids: b.map(parseOrderbookItem)}
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

export function numberToUnit(currency: string, n: BigNumber, blockchainInfo: BlockchainInfo): string {
    if (currency === blockchainInfo.baseCurrencyName) {
        return ethers.utils.parseEther(n.toString()).toString();
    } else {
        const decimals = blockchainInfo.assetToDecimals[currency];
        if (decimals === undefined) throw new Error('no decimals for ' + currency)
        return n.multipliedBy(Math.pow(10, decimals)).toFixed(0, BigNumber.ROUND_DOWN);
    }
}

export function  unitToNumber(currency: string, n: BigNumber, blockchainInfo: BlockchainInfo): BigNumber {
    const decimals = currency === blockchainInfo.baseCurrencyName ? 18 : blockchainInfo.assetToDecimals[currency];
    if (decimals === undefined) throw new Error('no decimals for ' + currency)
    return n.dividedBy(Math.pow(10, decimals));
}

export function  numberTo8(n: BigNumber.Value): number {
    return Number(new BigNumber(n).multipliedBy(1e8).toFixed(0));
}

export async function handleResponse(request: AxiosPromise): Promise<AxiosResponse['data']> {
    try {
        const { data } = await request
        return data
    } catch (error) {
        return Promise.reject(error)
    }
}

export async function waitForTx(txResponse: ethers.providers.TransactionResponse, timeoutSec: number, txType: TxType): Promise<string> {
    let txHasResult = false
    const timeoutRunner = setTimeout(() => {
        if (!txHasResult) throw new TxError(txResponse.hash, txType, `Request failed due to exceeding the time limit of ${timeoutSec} seconds!`)
    }, timeoutSec * 1000);

    const txResult = await txResponse.wait()
    txHasResult = true
    clearTimeout(timeoutRunner)

    if (txResult.status !== 1) throw new TxError(txResponse.hash, txType, `Request failed with status ${txResult.status}!`)

    return txResponse.hash
}

export function getTokenContracts (chain: Chain): Dictionary<ethers.Contract> {
    const tokensContracts: Dictionary<ethers.Contract> = {};
    const tokens = chain.blockchainInfo.assetToAddress;
    for (const name in tokens) {
        if (name === chain.blockchainInfo.baseCurrencyName) continue;
        const tokenAddress = tokens[name];
        const tokenContract = new ethers.Contract(
            tokenAddress,
            erc20ABI,
            chain.signer
        );

        tokensContracts[name] = tokenContract;
        tokensContracts[tokenAddress] = tokenContract;
    }
    return tokensContracts
}
