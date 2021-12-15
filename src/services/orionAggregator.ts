import BigNumber from "bignumber.js"
import { BlockchainOrder, SignOrderModel, SignOrderModelRaw, TradeOrder, PairConfig, TradeOrderV2,
    CancelOrderRequestV2, HistoryParams } from "../utils/Models"
import { getPriceWithDeviation, getFee, numberTo8, handleResponse, parseTradeOrderV2} from '../utils/Helpers'
import { DEFAULT_EXPIRATION, PRICE_DEVIATIONS } from '../utils/Constants'
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

    public async init(): Promise<boolean> {
        console.warn('OrionAggregator.init() method is currently deprecated and unnecessary')
        return new Promise(resolve => resolve(true))
    }

    public async getPairsInfo (): Promise<Record<string, PairConfig>> {
        try {
            const data: PairConfig[] = await handleResponse(this.chain.api.orionAggregator.get('/pairs/exchangeInfo'))
            const pairConfigs: Record<string, PairConfig> = {};
            data.forEach((item) => {
                pairConfigs[item.name] = item;
            });
            return pairConfigs
        } catch (error) {
            return Promise.reject(error)
        }
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

    private async formatRawOrder (order: SignOrderModelRaw): Promise<SignOrderModel> {
        const pair = `${order.fromCurrency.toUpperCase()}-${order.toCurrency.toUpperCase()}`
        const pairs = await this.getPairsInfo()
        const pairConfig = pairs[pair]
        if (!pairConfig) throw new Error(`No such pair ${pair}`)

        if (order.priceDeviation && (new BigNumber(PRICE_DEVIATIONS.MIN).gt(order.priceDeviation) || new BigNumber(PRICE_DEVIATIONS.MAX).lt(order.priceDeviation) ) )
            throw new Error(`priceDeviation value should between ${PRICE_DEVIATIONS.MIN} and ${PRICE_DEVIATIONS.MAX}`);

        const formattedOrder: SignOrderModel = Object.assign(order, {
            numberFormat: pairConfig,
            price: new BigNumber(order.price),
            amount: new BigNumber(order.amount),
            priceDeviation: new BigNumber(order.priceDeviation!==undefined ? order.priceDeviation : 0),
            needWithdraw: order.needWithdraw || false // set to false by default, because this feature isn't ready
        })

        return formattedOrder
    }

    public async createOrder(orderParams: SignOrderModelRaw): Promise<BlockchainOrder> {
        try {
            const params = await this.formatRawOrder(orderParams)
            const baseAsset: string = this.chain.getTokenAddress(params.fromCurrency);
            const quoteAsset: string = this.chain.getTokenAddress(params.toCurrency);
            const matcherFeeAsset: string = this.chain.getTokenAddress(params.feeCurrency);
            const nonce: number = Date.now();

            if (!['buy', 'sell'].includes(params.side)) throw new Error('Invalid side, should be buy | sell');
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
                baseAsset: params.fromCurrency,
                amount: params.amount,
                feePercent: this.chain.tokensFee[params.feeCurrency],
                assetsPrices: blockchainPrices,
                networkAsset: this.chain.blockchainInfo.baseCurrencyName,
                gasPriceWei,
                needWithdraw: params.needWithdraw,
                isPool: false,
                feeAsset: params.feeCurrency,
                limits: this.chain.baseLimits
            })

            const priceWithDeviation = params.priceDeviation.isZero() ? params.price : getPriceWithDeviation(params.price, params.side, params.priceDeviation);

            const amountRounded: BigNumber = params.amount.decimalPlaces(params.numberFormat.qtyPrecision, BigNumber.ROUND_DOWN);
            const priceRounded: BigNumber = priceWithDeviation.decimalPlaces(params.numberFormat.pricePrecision, params.side === 'buy' ? BigNumber.ROUND_UP : BigNumber.ROUND_DOWN);

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
                matcherFee: numberTo8(totalFee),
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

    public async sendOrder(order: BlockchainOrder, isCreateInternalOrder = false): Promise<{orderId: string | number}> {
        const internalRoute = '/order/internal'
        return handleResponse(this.chain.api.orionAggregator.post(isCreateInternalOrder ? internalRoute : '/order', order))
    }

    public async cancelOrder(orderId: string | number): Promise<{orderId: string | number}> {
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

    private getCancelationSubject (order: TradeOrderV2 | TradeOrder): CancelOrderRequestV2 {
        const { id, blockchainOrder } = order
        return {
            id,
            sender: blockchainOrder.senderAddress,
            signature: '',
            isPersonalSign: blockchainOrder.isPersonalSign
        }
    }

    public async getTradeHistory(options?: HistoryParams): Promise<TradeOrderV2[]> {
        const url = '/order/history'
        const params = {
            address: this.chain.signer.address,
            ...options
        }

        const data = await handleResponse(this.chain.api.orionAggregator.get(url, { params }));

        return Array.isArray(data) && data.length
            ? data.map(parseTradeOrderV2)
            : []
    }


    public async getOrderById (orderId: number | string, owner = this.chain.signer.address): Promise<TradeOrderV2> {
        const path = `/order?orderId=${orderId}&owner=${owner}`

        const {order} = await handleResponse(this.chain.api.orionAggregator.get(path))
        return parseTradeOrderV2(order)
    }

    public async getApiVersion (): Promise<number> {
        let version = 1
        try {
            const { apiVersion } = await handleResponse(this.chain.api.orionAggregator.get('/version'))
            version = Number(apiVersion)
        } catch (error) {
            version = 1
        }
        return version
    }
}
