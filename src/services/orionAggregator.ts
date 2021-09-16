import BigNumber from "bignumber.js"
import { BlockchainOrder, SignOrderModel, SignOrderModelRaw, TradeOrder, CancelOrderRequest } from "../utils/Models"
import { getPriceWithDeviation, getFee, getNumberFormat, numberTo8, handleResponse, parseTradeOrder} from '../utils/Helpers'
import { DEFAULT_EXPIRATION } from '../utils/Constants'
import { hashOrder, signOrder, signCancelOrder } from './crypto'
import { Chain } from './chain'
import { Exchange } from './exchange'

export class OrionAggregator {
    public readonly chain: Chain;
    public readonly exchange: Exchange;

    constructor(chain: Chain) {
        this.chain = chain
        this.exchange = new Exchange(chain)
    }

    private async checkBalanceForOrder (order: SignOrderModel, feeAsset: string, feeAmount: BigNumber): Promise<void> {
        try {
            const asset = order.side === 'buy' ? order.toCurrency.toUpperCase() : order.fromCurrency.toUpperCase()
            const amount = order.side === 'buy' ? order.amount.multipliedBy(order.price) : order.amount
            const balance = await this.exchange.getContractBalance()

            if (asset === feeAsset) {
                if (balance[asset].available.lt(amount.plus(feeAmount))) {
                    throw new Error(`The available contract balance (${balance[asset].available} ${asset}) is less than the order amount+fee (${amount.plus(feeAmount)} ${asset})!`)
                }
            } else {
                if (balance[asset].available.lt(amount)) {
                    throw new Error(`The available contract balance (${balance[asset].available} ${asset}) is less than the order amount (${amount} ${asset})!`)
                }

                if (balance[feeAsset].available.lt(feeAmount)) {
                    throw new Error(`The available contract balance (${balance[feeAsset].available} ${feeAsset}) is less than the order fee amount (${feeAmount} ${feeAsset})!`)
                }
            }
        } catch (error) {
            return Promise.reject(error)
        }
    }

    private formatRawOrder (order: SignOrderModelRaw): SignOrderModel {
        const formattedOrder: SignOrderModel = Object.assign(order, {
            numberFormat: getNumberFormat(this.chain.blockchainInfo, order.fromCurrency, order.toCurrency),
            price: new BigNumber(order.price),
            amount: new BigNumber(order.amount),
            priceDeviation: new BigNumber(order.priceDeviation),
        })

        return formattedOrder
    }

    public async createOrder(orderParams: SignOrderModelRaw): Promise<BlockchainOrder> {
        const params = this.formatRawOrder(orderParams)

        try {
            const baseAsset: string = this.chain.getTokenAddress(params.fromCurrency);
            const quoteAsset: string = this.chain.getTokenAddress(params.toCurrency);
            const matcherFeeAsset: string = this.chain.getTokenAddress(params.feeCurrency);
            const nonce: number = Date.now();

            if (!params.price.gt(0)) throw new Error('Invalid price');
            if (!params.amount.gt(0)) throw new Error('Invalid amount');
            if (!params.priceDeviation.gte(0)) throw new Error('Invalid priceDeviation');
            if (!this.chain.tokensFee[params.feeCurrency]) throw new Error(`Invalid feeCurrency, should be one of ${Object.keys(this.chain.tokensFee)}`);

            if (params.numberFormat.qtyPrecision === undefined || params.numberFormat.qtyPrecision === null) throw new Error('Invalid qtyPrecision');
            if (params.numberFormat.pricePrecision === undefined || params.numberFormat.pricePrecision === null) throw new Error('Invalid pricePrecision');

            let gasPriceWei, blockchainPrices

            if (params.chainPrices) {
                gasPriceWei = params.chainPrices.gasWei

                blockchainPrices = {
                    [this.chain.blockchainInfo.baseCurrencyName]: new BigNumber(params.chainPrices.networkAsset),
                    [params.fromCurrency]: new BigNumber(params.chainPrices.baseAsset),
                    [params.feeCurrency]: new BigNumber(params.chainPrices.feeAsset),
                }

                if (!blockchainPrices[this.chain.blockchainInfo.baseCurrencyName].gt(0)) throw new Error('Invalid chainPrices networkAsset')
                if (!blockchainPrices[params.fromCurrency].gt(0)) throw new Error('Invalid chainPrices baseAsset')
                if (!blockchainPrices[params.feeCurrency].gt(0)) throw new Error('Invalid chainPrices feeAsset')
            } else {
                gasPriceWei = await this.chain.getGasPrice();
                blockchainPrices = await this.chain.getBlockchainPrices()
            }

            const totalFee = getFee({
                asset: params.fromCurrency,
                amount: params.amount,
                feePercent: this.chain.tokensFee[params.feeCurrency],
                assetsPrices: blockchainPrices,
                networkAsset: this.chain.blockchainInfo.baseCurrencyName,
                gasPriceWei,
                needWithdraw: params.needWithdraw,
                isPool: false,
                feeAsset: params.feeCurrency
            })

            const priceWithDeviation = params.priceDeviation.isZero() ? params.price : getPriceWithDeviation(params.price, params.side, params.priceDeviation);

            const amountRounded: BigNumber = params.amount.decimalPlaces(params.numberFormat.qtyPrecision, BigNumber.ROUND_DOWN);
            const priceRounded: BigNumber = priceWithDeviation.decimalPlaces(params.numberFormat.pricePrecision, params.side === 'buy' ? BigNumber.ROUND_UP : BigNumber.ROUND_DOWN);
            const totalFeeRounded: BigNumber = totalFee.decimalPlaces(this.chain.blockchainInfo.assetToDecimals[params.feeCurrency], BigNumber.ROUND_UP);

            if (totalFee.isZero()) throw new Error('Zero fee');

            await this.checkBalanceForOrder(params, params.feeCurrency, totalFee)

            const order: BlockchainOrder = {
                id: '',
                senderAddress: this.chain.signer.address,
                matcherAddress: this.chain.blockchainInfo.matcherAddress,
                baseAsset: baseAsset,
                quoteAsset: quoteAsset,
                matcherFeeAsset: matcherFeeAsset,
                amount: numberTo8(amountRounded),
                price: numberTo8(priceRounded),
                matcherFee: numberTo8(totalFeeRounded),
                nonce: nonce,
                expiration: nonce + DEFAULT_EXPIRATION,
                buySide: params.side === 'buy' ? 1 : 0,
                isPersonalSign: false,
                signature: '',
                needWithdraw: params.needWithdraw
            }

            order.id = hashOrder(order);
            order.signature = await signOrder(order, this.chain.signer, this.chain.network.CHAIN_ID);
            if (!(await this.exchange.validateOrder(order))) {
                throw new Error('Order validation failed');
            }
            return order;
        } catch (error) {
            return Promise.reject(error)
        }
    }

    public async sendOrder(order: BlockchainOrder, isCreateInternalOrder: boolean): Promise<{orderId: number}> {
        return handleResponse(this.chain.api.orionAggregator.post(isCreateInternalOrder ? '/order/maker' : '/order', order))
    }

    public async cancelOrder(orderId: number): Promise<{orderId: number}> {
        try {
            const order = await this.getOrderById(orderId)

            const cancelationSubject = this.getCancelationSubject(order)

            cancelationSubject.signature = await signCancelOrder(cancelationSubject, this.chain.signer, this.chain.network.CHAIN_ID)

            return handleResponse(this.chain.api.orionAggregator.delete('/order', {
                data: cancelationSubject
            }))
        } catch (error) {
            return Promise.reject(error)
        }
    }

    private getCancelationSubject (order: TradeOrder): CancelOrderRequest {
        const { id, blockchainOrder } = order
        return {
            id,
            senderAddress: blockchainOrder.senderAddress,
            signature: '',
            isPersonalSign: blockchainOrder.isPersonalSign
        }
    }

    public async getTradeHistory(fromCurrency?: string, toCurrency?: string): Promise<TradeOrder[]> {
        const url = '/orderHistory?address=' + this.chain.signer.address + (fromCurrency ? '&baseAsset=' + fromCurrency : '') + (toCurrency ? '&quoteAsset=' + toCurrency : '');
        const data = await handleResponse(this.chain.api.orionAggregator.get(url));

        return data.map(parseTradeOrder);
    }

    public async getOrderById (orderId: number): Promise<TradeOrder> {
        const path = `/order?orderId=${orderId}`

        return handleResponse(this.chain.api.orionAggregator.get(path))
    }
}
