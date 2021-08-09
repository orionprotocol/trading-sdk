import BigNumber from "bignumber.js";
import { ethers } from "ethers";
import { Dictionary, DEFAULT_NUMBER_FORMAT, NumberFormat, BlockchainInfo } from "./Models";
import { ChainApi } from "../main";

export const ETH_CHAIN_ID = 3

export const MATCHER_FEE_PERCENT: BigNumber = new BigNumber(0.2).dividedBy(100); // 0.2%
export const SWAP_THROUGH_ORION_POOL_GAS_LIMIT = 350000;
export const FILL_ORDERS_AND_WITHDRAW_GAS_LIMIT = 385000;
export const FILL_ORDERS_GAS_LIMIT = 220000;

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

export function getPairNumberFormat(pairName: string, numberFormat: Dictionary<NumberFormat>) {
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