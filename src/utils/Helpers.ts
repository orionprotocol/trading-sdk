import BigNumber from "bignumber.js";
import { ethers } from "ethers";
import { Dictionary, DEFAULT_NUMBER_FORMAT, NumberFormat, BlockchainInfo, TradeOrder, TradeSubOrder, Side} from "./Models";
import {MATCHER_FEE_PERCENT, SWAP_THROUGH_ORION_POOL_GAS_LIMIT, FILL_ORDERS_AND_WITHDRAW_GAS_LIMIT, FILL_ORDERS_GAS_LIMIT} from '../utils/Constants'
import { Chain as ChainApi } from "../services/chain";

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

export function toOrnPrice(currency: string, nameToPrice: Dictionary<BigNumber>): BigNumber {
    const price = nameToPrice[currency];
    if (!price) return new BigNumber(0);
    return price;
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

export function calculateNetworkFee(api: ChainApi, gasPriceGwei: string, nameToPrice: Dictionary<BigNumber>, currency: string, needWithdraw: boolean, isPool = false): { networkFeeEth: BigNumber, networkFee: BigNumber } {
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

    const baseCurrencyName = api.blockchainInfo.baseCurrencyName;
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
