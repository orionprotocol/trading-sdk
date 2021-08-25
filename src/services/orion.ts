import BigNumber from "bignumber.js"
import {ethers} from "ethers"
import {signTypedMessage} from 'eth-sig-util'
import {BlockchainInfo, Dictionary, BlockchainOrder, SignOrderModel, SignOrderModelRaw, CancelOrderRequest, DomainData, BalanceContract} from "../utils/Models"
import {getPriceWithDeviation, calculateMatcherFee, calculateNetworkFee, getNumberFormat } from '../utils/Helpers'
import {DEPOSIT_ETH_GAS_LIMIT, DEPOSIT_ERC20_GAS_LIMIT, DOMAIN_TYPE, ORDER_TYPES, FEE_CURRENCY, DEFAULT_EXPIRATION, CANCEL_ORDER_TYPES} from '../utils/Constants'
import exchangeABI from '../abis/Exchange.json'
import erc20ABI from '../abis/ERC20.json'
import { Chain } from './chain'

function hashOrder(order: BlockchainOrder): string {
    return ethers.utils.solidityKeccak256(
        [
            'uint8',
            'address',
            'address',
            'address',
            'address',
            'address',
            'uint64',
            'uint64',
            'uint64',
            'uint64',
            'uint64',
            'uint8',
        ],
        [
            "0x03",
            order.senderAddress,
            order.matcherAddress,
            order.baseAsset,
            order.quoteAsset,
            order.matcherFeeAsset,
            order.amount,
            order.price,
            order.matcherFee,
            order.nonce,
            order.expiration,
            order.buySide ? '0x01' : '0x00'
        ]
    )
}

export class Orion {
    private blockchainInfo: BlockchainInfo;
    public readonly provider: ethers.providers.Provider;
    public readonly walletAddress: string;
    public readonly chain: Chain;

    private readonly exchangeContract: ethers.Contract;
    private readonly tokensContracts: Dictionary<ethers.Contract>;

    constructor(chain: Chain) {
        this.blockchainInfo = chain.blockchainInfo;
        this.provider = chain.provider;
        this.walletAddress = chain.signer.address;
        this.chain = chain

        this.exchangeContract = new ethers.Contract(
            this.blockchainInfo.exchangeContractAddress,
            exchangeABI,
            chain.signer
        );

        this.tokensContracts = {};
        const tokens = this.blockchainInfo.assetToAddress;
        for (const name in tokens) {
            if (name === this.blockchainInfo.baseCurrencyName) continue;
            const tokenAddress = tokens[name];
            const tokenContract = new ethers.Contract(
                tokenAddress,
                erc20ABI,
                chain.signer
            );

            this.tokensContracts[name] = tokenContract;
            this.tokensContracts[tokenAddress] = tokenContract;
        }
    }

    getDomainData(): DomainData {
        return {
            name: "Orion Exchange",
            version: "1",
            chainId: this.blockchainInfo.chainId,
            salt: "0xf2d857f4a3edcb9b78b4d503bfe733db1e3f6cdc2b7971ee739626c97e86a557",
        };
    }

    getTokenAddress(name: string): string {
        return this.blockchainInfo.assetToAddress[name];
    }

    getContractTokens(): string[] {
        return Object.keys(this.blockchainInfo.assetToAddress)
    }

    getContractTokenAddresses(): string[] {
        return Object.values(this.blockchainInfo.assetToAddress)
    }

    tokenAddressToName(address: string): string {
        for (const name in this.blockchainInfo.assetToAddress) {
            if (Object.prototype.hasOwnProperty.call(this.blockchainInfo.assetToAddress, name)) {
                if (this.blockchainInfo.assetToAddress[name] === address.toLowerCase()) return name;
            }
        }
        return '';
    }

    private async validateOrder(order: BlockchainOrder): Promise<boolean> {
        return this.exchangeContract.validateOrder(order);
    }

    private async _signOrder(order: BlockchainOrder): Promise<string> {
        const signer = this.chain.signer as ethers.Wallet;

        if (signer.privateKey) {
            const data = {
                types: {
                    EIP712Domain: DOMAIN_TYPE,
                    Order: ORDER_TYPES.Order,
                },
                domain: this.getDomainData(),
                primaryType: 'Order',
                message: order,
            };

            const msgParams = {data};
            const bufferKey = Buffer.from((this.chain.signer as ethers.Wallet).privateKey.substr(2), 'hex');
            return signTypedMessage(bufferKey, msgParams as any, 'V4');
        } else {
            throw new Error('privateKey is required!')
        }
    }

    private async _signCancelOrder(cancelOrderRequest: CancelOrderRequest): Promise<string> {
        const signer = this.chain.signer as any;

        if (signer.privateKey) {

            const data = {
                types: {
                    EIP712Domain: DOMAIN_TYPE,
                    DeleteOrder: CANCEL_ORDER_TYPES.DeleteOrder,
                },
                domain: this.getDomainData(),
                primaryType: 'DeleteOrder',
                message: cancelOrderRequest,
            };

            const msgParams = {data};
            const bufferKey = Buffer.from((this.chain.signer as ethers.Wallet).privateKey.substr(2), 'hex');
            return signTypedMessage(bufferKey, msgParams as any, 'V4');
        } else {
            throw new Error('privateKey is required!')
        }
    }

    private formatRawOrder (order: SignOrderModelRaw): SignOrderModel {
        const formattedOrder: any = { ...order }
        formattedOrder.numberFormat = getNumberFormat(this.chain.blockchainInfo, formattedOrder.fromCurrency, formattedOrder.toCurrency)
        formattedOrder.price = new BigNumber(order.price)
        formattedOrder.amount = new BigNumber(order.amount)
        formattedOrder.priceDeviation = new BigNumber(order.priceDeviation)

        return formattedOrder
    }

    async signOrder(orderParams: SignOrderModelRaw): Promise<BlockchainOrder> {
        const params = this.formatRawOrder(orderParams)

        try {
            const baseAsset: string = this.getTokenAddress(params.fromCurrency);
            const quoteAsset: string = this.getTokenAddress(params.toCurrency);
            const nonce: number = Date.now();

            if (!params.price.gt(0)) throw new Error('Invalid price');
            if (!params.amount.gt(0)) throw new Error('Invalid amount');
            if (!params.priceDeviation.gte(0)) throw new Error('Invalid priceDeviation');

            if (params.numberFormat.qtyPrecision === undefined || params.numberFormat.qtyPrecision === null) throw new Error('Invalid qtyPrecision');
            if (params.numberFormat.pricePrecision === undefined || params.numberFormat.pricePrecision === null) throw new Error('Invalid pricePrecision');

            let gasPriceWei, blockchainPrices

            if (params.chainPrices) {
                gasPriceWei = params.chainPrices.gasWei

                blockchainPrices = { ORN: new BigNumber(params.chainPrices.orn), [this.blockchainInfo.baseCurrencyName]: new BigNumber(params.chainPrices.baseCurrency) }

                if (!blockchainPrices.ORN.gt(0)) throw new Error('Invalid chainPrices orn')
                if (!blockchainPrices[this.blockchainInfo.baseCurrencyName].gt(0)) throw new Error('Invalid chainPrices baseCurrency')
            } else {
                gasPriceWei = await this.chain.getGasPriceFromOrionBlockchain();
                blockchainPrices = await this.chain.getPricesFromBlockchain()
            }

            const matcherFee = calculateMatcherFee(params.fromCurrency, params.amount, params.price, params.side, blockchainPrices, true);
            const {networkFee} = calculateNetworkFee(this.chain, gasPriceWei, blockchainPrices, 'ORN', false);
            const totalFee = matcherFee.plus(networkFee)

            const priceWithDeviation = params.priceDeviation.isZero() ? params.price : getPriceWithDeviation(params.price, params.side, params.priceDeviation);

            const amountRounded: BigNumber = params.amount.decimalPlaces(params.numberFormat.qtyPrecision, BigNumber.ROUND_DOWN);
            const priceRounded: BigNumber = priceWithDeviation.decimalPlaces(params.numberFormat.pricePrecision, params.side === 'buy' ? BigNumber.ROUND_UP : BigNumber.ROUND_DOWN);
            const matcherFeeAsset: string = this.getTokenAddress(FEE_CURRENCY);

            if (totalFee.isZero()) throw new Error('Zero fee');

            const order: BlockchainOrder = {
                id: '',
                senderAddress: this.walletAddress,
                matcherAddress: this.blockchainInfo.matcherAddress,
                baseAsset: baseAsset,
                quoteAsset: quoteAsset,
                matcherFeeAsset: matcherFeeAsset,
                amount: this.numberTo8(amountRounded),
                price: this.numberTo8(priceRounded),
                matcherFee: this.numberTo8(totalFee),
                nonce: nonce,
                expiration: nonce + DEFAULT_EXPIRATION,
                buySide: params.side === 'buy' ? 1 : 0,
                isPersonalSign: false,
                signature: '',
                needWithdraw: params.needWithdraw || undefined
            }

            order.id = hashOrder(order);
            order.signature = await this._signOrder(order);
            if (!(await this.validateOrder(order))) {
                throw new Error('Order validation failed');
            }
            return order;
        } catch (error) {
            console.log('signOrder error: ', error);
            return error
        }
    }

    numberToUnit(currency: string, n: BigNumber): string {
        if (currency === this.blockchainInfo.baseCurrencyName) {
            return ethers.utils.parseEther(n.toString()).toString();
        } else {
            const decimals = this.blockchainInfo.assetToDecimals[currency];
            if (decimals === undefined) throw new Error('no decimals for ' + currency)
            return n.multipliedBy(Math.pow(10, decimals)).toFixed(0, BigNumber.ROUND_DOWN);
        }
    }

    unitToNumber(currency: string, n: BigNumber, tokenDecimals?: number): BigNumber {
        const decimals = currency === "ETH" || currency === "BNB" ? 18 : tokenDecimals || this.blockchainInfo.assetToDecimals[currency];
        if (decimals === undefined) throw new Error('no decimals for ' + currency)
        return n.dividedBy(Math.pow(10, decimals));
    }

    numberTo8(n: BigNumber.Value): number {
        return Number(new BigNumber(n).multipliedBy(1e8).toFixed(0));
    }

    private async sendTransaction(unsignedTx: ethers.PopulatedTransaction, gasLimit: number, gasPriceWei: BigNumber): Promise<ethers.providers.TransactionResponse> {
        if(gasLimit > 0) unsignedTx.gasLimit = ethers.BigNumber.from(gasLimit);
        unsignedTx.gasPrice = ethers.BigNumber.from(gasPriceWei.toString());
        const unsignedRequest: ethers.providers.TransactionRequest = await this.chain.signer.populateTransaction(unsignedTx); // NOTE: validate transaction when estimate gas
        return this.chain.signer.sendTransaction(unsignedRequest);
    }

    async swapThroughOrionPool(
        amountSpend: string,
        amountReceive: string,
        path: string[],
        gasLimit = 600000,
        gasPriceWei?: BigNumber
    ): Promise<ethers.providers.TransactionResponse> {
        const txRequest = await this.exchangeContract.populateTransaction.swapThroughOrionPool(
            ethers.BigNumber.from(amountSpend),
            ethers.BigNumber.from(amountReceive),
            path,
            true,
        );

        let gasPriceWeiLocal

        if (gasPriceWei) {
            gasPriceWeiLocal = gasPriceWei
        } else {
            const priceWei = await this.chain.getGasPriceFromOrionBlockchain()
            gasPriceWeiLocal = new BigNumber(priceWei)
        }

        return this.sendTransaction(
            txRequest,
            gasLimit,
            gasPriceWeiLocal
        )
    }

    async isTransactionDone(transactionHash: string): Promise<boolean> {
        const transactionReceipt = await this.provider.getTransactionReceipt(transactionHash);
        if (!transactionReceipt) {
            return false;
        } else {
            return !!transactionReceipt.status;
        }
    }

    async sendOrder(order: BlockchainOrder, isCreateInternalOrder: boolean): Promise<{orderId: number}> {
        try {
            const { data } =  await this.chain.api.aggregator.post(isCreateInternalOrder ? '/order/maker' : '/order', order)
            return data
        } catch (error) {
            console.log('sendOrder error: ', error);
            return error
        }
    }

    async cancelOrder(orderId: number): Promise<{orderId: number}> {
        try {
            const order = await this.chain.getOrderById(orderId)

            const cancelationSubject = this.getCancelationSubject(order)

            cancelationSubject.signature = await this._signCancelOrder(cancelationSubject)

            const { data } =  await this.chain.api.aggregator.delete('/order', {
                data: cancelationSubject
            });
            return data
        } catch (error) {
            return error
        }
    }

    private getCancelationSubject (order: any): CancelOrderRequest {
        const { id, blockchainOrder }: {id: number, blockchainOrder: BlockchainOrder} = order
        return {
            id,
            senderAddress: blockchainOrder.senderAddress,
            signature: '',
            isPersonalSign: blockchainOrder.isPersonalSign
        }
    }

    private async depositETH(amountUnit: string, gasPriceWei: BigNumber): Promise<ethers.providers.TransactionResponse> {
        const unsignedTx: ethers.PopulatedTransaction = await this.exchangeContract.populateTransaction.deposit();
        unsignedTx.value = ethers.BigNumber.from(amountUnit);
        return this.sendTransaction(
            unsignedTx,
            DEPOSIT_ETH_GAS_LIMIT,
            gasPriceWei
        )
    }

    private async depositERC20(currency: string, amountUnit: string, gasPriceWei: BigNumber): Promise<ethers.providers.TransactionResponse> {
        return this.sendTransaction(
            await this.exchangeContract.populateTransaction.depositAsset(this.getTokenAddress(currency), amountUnit),
            DEPOSIT_ERC20_GAS_LIMIT,
            gasPriceWei
        )
    }

    async deposit(currency: string, amount: string): Promise<ethers.providers.TransactionResponse> {
        try {
            const bignumberAmount = new BigNumber(amount)
            const amountUnit = this.numberToUnit(currency, bignumberAmount);

            const gasPriceWei = await this.chain.getGasPriceFromOrionBlockchain()

            if (currency === this.blockchainInfo.baseCurrencyName) {
                return this.depositETH(amountUnit, new BigNumber(gasPriceWei))
            } else {
                return this.depositERC20(currency, amountUnit, new BigNumber(gasPriceWei))
            }
        } catch (error) {
            return error
        }
    }

    async getBalance(): Promise<BigNumber> {
        const wei: ethers.BigNumber = await this.provider.getBalance(this.walletAddress);
        return new BigNumber(ethers.utils.formatEther(wei));
    }

    async getTokenBalance (token: string): Promise<Array<[]>> {
        const balance = await this.tokensContracts[token].balanceOf(this.walletAddress)
        return [token, balance.toString()]
    }

    async getWalletBalance (): Promise<Dictionary<string>> {
        return new Promise((resolve, reject) => {
            const promises: Array<Promise<Array<[]>>> = []

            try {
                const tokens = this.getContractTokens()

                tokens.forEach(token => {
                    if (token === this.blockchainInfo.baseCurrencyName) return
                    promises.push(this.getTokenBalance(token))
                })

                Promise.all(promises).then((values) => {
                    const result: Dictionary<string> = {}

                    values.forEach((el: string[]) => {
                        console.log(el);
                        const name = el[0]
                        const value = el[1]
                        result[name] = result[value]
                    })
                    resolve(result)
                })
            } catch (error) {
                reject(error)
            }

        })
    }

    async checkContractBalance(tokenSymbol: string): Promise<BalanceContract> {
        const token = tokenSymbol.toUpperCase()

        if (!this.getContractTokens().includes(token)) throw new Error('Invalid token')

        try {
            const tokenAddress = this.getTokenAddress(tokenSymbol)

            const total: BigNumber = await this.exchangeContract.getBalance(tokenAddress, this.walletAddress)
            const totalBignumber = new BigNumber(total.toString())

            const locked = await this.checkReservedBalance(tokenSymbol)
            const lockedBignumber = new BigNumber(this.numberToUnit(token, new BigNumber(locked[token])))

            const availableBignumber = totalBignumber.minus(lockedBignumber)

            const balanceSummary = {
                total: {
                    bignumber: totalBignumber,
                    decimal: Number(this.unitToNumber(token, totalBignumber).toString())
                },
                locked: {
                    bignumber: lockedBignumber,
                    decimal: Number(locked[token])
                },
                available: {
                    bignumber: availableBignumber,
                    decimal: Number(this.unitToNumber(token, availableBignumber).toString())
                }
            }

            return balanceSummary
        } catch (error) {
            return error
        }
    }

    async checkContractBalances(): Promise<[]> {

        if (!this.getContractTokens()) throw new Error('Invalid token')

        try {
            const tokenAddresses = this.getContractTokenAddresses()

            const total = await this.exchangeContract.getBalances(tokenAddresses, this.walletAddress)
            const locked = await this.checkReservedBalance()

            console.log(total, locked)

            // const totalBignumber = new BigNumber(total.toString())
            // const lockedBignumber = new BigNumber(this.numberToUnit(token, new BigNumber(locked[token])))

            // const availableBignumber = totalBignumber.minus(lockedBignumber)

            // const balanceSummary = {
            //     total: {
            //         bignumber: totalBignumber,
            //         decimal: Number(this.unitToNumber(token, totalBignumber).toString())
            //     },
            //     locked: {
            //         bignumber: lockedBignumber,
            //         decimal: Number(locked[token])
            //     },
            //     available: {
            //         bignumber: availableBignumber,
            //         decimal: Number(this.unitToNumber(token, availableBignumber).toString())
            //     }
            // }

            return []
        } catch (error) {
            return error
        }
    }

    async checkReservedBalance(asset = ''): Promise<Dictionary<string>> {
        try {
            const path = `/address/balance/reserved/${asset}?address=${this.walletAddress}`
            const { data } = await this.chain.api.aggregator.get(path)
            return data
        } catch (error) {
            return error
        }
    }
}
