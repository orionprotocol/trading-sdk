import BigNumber from "bignumber.js"
import {ethers} from "ethers"
import {signTypedMessage} from 'eth-sig-util'
import {BlockchainInfo, Dictionary, BlockchainOrder, SignOrderModel, SignOrderModelRaw,
    CancelOrderRequest, DomainData, BalanceContract, TradeOrder} from "../utils/Models"
import {getPriceWithDeviation, calculateMatcherFee, calculateNetworkFee, getNumberFormat, parseTradeOrder } from '../utils/Helpers'
import {DEPOSIT_ETH_GAS_LIMIT, DEPOSIT_ERC20_GAS_LIMIT, DOMAIN_TYPE, ORDER_TYPES, FEE_CURRENCY,
    DEFAULT_EXPIRATION, CANCEL_ORDER_TYPES, APPROVE_ERC20_GAS_LIMIT} from '../utils/Constants'
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

    isNetworkAsset (asset: string): boolean {
        return this.blockchainInfo.baseCurrencyName.toUpperCase() === asset.toUpperCase()
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

    async checkNetworkTokens (): Promise<void> {
        const networkAssetBalance = await this.getNetworkBalance()
        if (!networkAssetBalance.gt(0)) throw new Error('A non-zero balance of network tokens is required!')
    }

    async checkBalanceForOrder (order: SignOrderModel, feeAsset: string, feeAmount: BigNumber): Promise<void> {
        try {
            const asset = order.side === 'buy' ? order.toCurrency.toUpperCase() : order.fromCurrency.toUpperCase()
            const amount = order.side === 'buy' ? order.amount.multipliedBy(order.price) : order.amount
            const balance = await this.getContractBalance()

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
        const signer = this.chain.signer as ethers.Wallet;

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

                blockchainPrices = {
                    [this.blockchainInfo.baseCurrencyName]: new BigNumber(params.chainPrices.networkAsset),
                    [params.fromCurrency]: new BigNumber(params.chainPrices.baseAsset)
                }

                if (!blockchainPrices[this.blockchainInfo.baseCurrencyName].gt(0)) throw new Error('Invalid chainPrices networkAsset')
                if (!blockchainPrices[params.fromCurrency].gt(0)) throw new Error('Invalid chainPrices baseAsset')
            } else {
                gasPriceWei = await this.chain.getGasPrice();
                blockchainPrices = await this.chain.getPricesFromBlockchain()
            }

            const matcherFee = calculateMatcherFee(params.fromCurrency, params.amount, blockchainPrices);
            const {networkFee} = calculateNetworkFee(this.chain, gasPriceWei, blockchainPrices, params.needWithdraw);
            const totalFee = matcherFee.plus(networkFee)

            const priceWithDeviation = params.priceDeviation.isZero() ? params.price : getPriceWithDeviation(params.price, params.side, params.priceDeviation);

            const amountRounded: BigNumber = params.amount.decimalPlaces(params.numberFormat.qtyPrecision, BigNumber.ROUND_DOWN);
            const priceRounded: BigNumber = priceWithDeviation.decimalPlaces(params.numberFormat.pricePrecision, params.side === 'buy' ? BigNumber.ROUND_UP : BigNumber.ROUND_DOWN);
            const matcherFeeAsset: string = this.getTokenAddress(FEE_CURRENCY);

            if (totalFee.isZero()) throw new Error('Zero fee');

            await this.checkNetworkTokens()

            await this.checkBalanceForOrder(params, FEE_CURRENCY, totalFee)

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
            return Promise.reject(error)
        }
    }

    private async sendTransaction(unsignedTx: ethers.PopulatedTransaction, gasLimit: number, gasPriceWei: BigNumber): Promise<ethers.providers.TransactionResponse> {
        try {
            if(gasLimit > 0) unsignedTx.gasLimit = ethers.BigNumber.from(gasLimit);
            unsignedTx.gasPrice = ethers.BigNumber.from(gasPriceWei.toString());
            const unsignedRequest: ethers.providers.TransactionRequest = await this.chain.signer.populateTransaction(unsignedTx); // NOTE: validate transaction when estimate gas
            return this.chain.signer.sendTransaction(unsignedRequest);
        } catch (error) {
            return Promise.reject(error)
        }
    }

    async sendOrder(order: BlockchainOrder, isCreateInternalOrder: boolean): Promise<{orderId: number}> {
        try {
            const { data } =  await this.chain.api.aggregator.post(isCreateInternalOrder ? '/order/maker' : '/order', order)
            return data
        } catch (error) {
            return Promise.reject(error)
        }
    }

    async cancelOrder(orderId: number): Promise<{orderId: number}> {
        try {
            const order = await this.getOrderById(orderId)

            const cancelationSubject = this.getCancelationSubject(order)

            cancelationSubject.signature = await this._signCancelOrder(cancelationSubject)

            const { data } =  await this.chain.api.aggregator.delete('/order', {
                data: cancelationSubject
            });
            return data
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

    async deposit(currency: string, amount: string, gasPriceWei?: string): Promise<ethers.providers.TransactionResponse> {
        try {
            await this.checkNetworkTokens()

            const bignumberAmount = new BigNumber(amount)
            const amountUnit = this.numberToUnit(currency, bignumberAmount);

            const walletBalanceUint = await this.getWalletBalance(currency)
            const walletBalance = this.unitToNumber(currency, new BigNumber(walletBalanceUint[currency]))

            if (walletBalance.lt(bignumberAmount)) throw new Error(`The wallet balance (${walletBalance}) is lower than the deposit amount (${amount})!`)

            const gasPriceWeiLocal = gasPriceWei ? gasPriceWei : await this.chain.getGasPrice()

            if (this.isNetworkAsset(currency)) {
                return this.depositETH(amountUnit, new BigNumber(gasPriceWeiLocal))
            } else {
                await this.allowanceHandler(currency, amount, gasPriceWeiLocal)
                return this.depositERC20(currency, amountUnit, new BigNumber(gasPriceWeiLocal))
            }
        } catch (error) {
            return Promise.reject(error)
        }
    }

    async withdraw(currency: string, amount: string, gasPriceWei?: string): Promise<ethers.providers.TransactionResponse> {
        try {
            await this.checkNetworkTokens()

            const amountUnit = this.numberToUnit(currency, new BigNumber(amount));
            const balance = await this.getContractBalance(currency)
            const gasPriceWeiLocal = gasPriceWei ? gasPriceWei : await this.chain.getGasPrice()

            if (balance[currency].available.lt(new BigNumber(amount))) throw new Error(`The available contract balance (${balance[currency].available}) is less than the withdrawal amount (${new BigNumber(amount)})! `)

            return this.sendTransaction(
                await this.exchangeContract.populateTransaction.withdraw(this.getTokenAddress(currency), amountUnit),
                DEPOSIT_ERC20_GAS_LIMIT,
                new BigNumber(gasPriceWeiLocal),
            );
        } catch (error) {
            return Promise.reject(error)
        }
    }

    private async allowanceHandler (currency: string, amount: string, gasPriceWei: string): Promise<ethers.providers.TransactionResponse | void> {
        if (this.isNetworkAsset(currency)) return

        try {
            const bignumberAmount = new BigNumber(amount)
            const tokenContract = this.tokensContracts[currency]

            const allowance = await this.getAllowance(currency)

            if (allowance.lt(bignumberAmount)) {
                const needReset = await this.checkNeedZeroReset(tokenContract)

                if (needReset) {
                    await this.approve(currency, ethers.constants.Zero.toString(), gasPriceWei)
                    return this.approve(currency, ethers.constants.MaxUint256.toString(), gasPriceWei)
                } else {
                    return this.approve(currency, ethers.constants.MaxUint256.toString(), gasPriceWei)
                }
            }
        } catch (error) {
            return Promise.reject(error)
        }
    }

    private async checkNeedZeroReset (contract: ethers.Contract): Promise<boolean> {
        const unsignedTx = await contract.populateTransaction.approve(
            this.walletAddress,
            ethers.constants.MaxUint256,
        );
        try {
            await this.chain.signer.estimateGas(unsignedTx);
            return false;
        } catch (e) {
            return true;
        }
    }

    async getAllowance( currency: string, toAddress?: string ): Promise<BigNumber> {
        try {
            const decimals = this.blockchainInfo.assetToDecimals[currency]
            const currentTokenContract = this.tokensContracts[currency]

            if(!decimals || !currentTokenContract) throw new Error('Currency is invaild!')

            if (!toAddress) {
                toAddress = this.blockchainInfo.exchangeContractAddress;
            }
            const unit: ethers.BigNumber = await currentTokenContract.allowance(this.walletAddress, toAddress);
            return new BigNumber(unit.toString()).dividedBy(10 ** decimals);
        } catch (error) {
            return Promise.reject(error)
        }
    }

    async approve(currency: string, amountUnit: string, gasPriceWei?: string): Promise<ethers.providers.TransactionResponse> {
        try {
            await this.checkNetworkTokens()

            const gasPriceWeiLocal = gasPriceWei ? gasPriceWei : await this.chain.getGasPrice()

            const tokenContract = this.tokensContracts[currency]

            const toAddress = this.blockchainInfo.exchangeContractAddress;

            return this.approveERC20({
                amountUnit,
                gasPriceWei: gasPriceWeiLocal,
                toAddress,
                tokenContract,
            });
        } catch (error) {
            return Promise.reject(error)
        }
    }

    private async approveERC20({amountUnit, gasPriceWei, toAddress, tokenContract}: {
        amountUnit: string,
        gasPriceWei: string,
        toAddress: string,
        tokenContract: ethers.Contract
    }): Promise<ethers.providers.TransactionResponse> {
        try {
            const unsignedTx = await tokenContract.populateTransaction.approve(toAddress, amountUnit);
            return this.sendTransaction(
                unsignedTx,
                APPROVE_ERC20_GAS_LIMIT,
                new BigNumber(gasPriceWei),
            )
        } catch (error) {
            return Promise.reject(error)
        }
    }

    async getTokenBalance (token: string): Promise<string[]> {
        try {
            const balance = await this.tokensContracts[token].balanceOf(this.walletAddress)
            return [token, balance.toString()]
        } catch (error) {
            return Promise.reject(error)
        }
    }

    async getNetworkBalance (): Promise<BigNumber> {
        try {
            const wei: ethers.BigNumber = await this.chain.provider.getBalance(this.walletAddress);
            return new BigNumber(ethers.utils.formatEther(wei));
        } catch (error) {
            return Promise.reject(error)
        }
    }

    async getWalletBalance (ticker?: string): Promise<Dictionary<string>> {
        return new Promise((resolve, reject) => {
            if (ticker === this.blockchainInfo.baseCurrencyName) {
                this.getNetworkBalance()
                    .then((balance) => {
                        resolve({ [this.blockchainInfo.baseCurrencyName]: balance.toString() })
                    })
                    .catch(error => reject(error))
            } else {
                const promises: Array<Promise<string[]>> = []

                try {
                    let tokens = this.getContractTokens()

                    if (ticker) {
                        tokens = tokens.filter(el => el === ticker.toUpperCase())
                    }

                    tokens.forEach(token => {
                        if (token === this.blockchainInfo.baseCurrencyName) return
                        promises.push(this.getTokenBalance(token))
                    })

                    Promise.all(promises).then((values) => {
                        const result: Dictionary<string> = {}

                        values.forEach((el: string[]) => {
                            const name = el[0].toString()
                            const value = el[1].toString()
                            result[name] = value
                        })
                        resolve(result)
                    })
                } catch (error) {
                    reject(error)
                }
            }
        })
    }

    async getContractBalance(tokenSymbol?: string): Promise<Dictionary<BalanceContract>> {
        const token = tokenSymbol ? tokenSymbol.toUpperCase() : ''

        try {
            if (token && !this.getContractTokens().includes(token)) throw new Error('Invalid token')

            const result: Dictionary<BalanceContract> = {}

            const tokenAddresses = token
                ? [this.getTokenAddress(token)]
                : this.getContractTokenAddresses()

            const tokens = token ? [token] : this.getContractTokens()

            const total: BigNumber[] = await this.exchangeContract.getBalances(tokenAddresses, this.walletAddress)
            const locked = await this.checkReservedBalance()

            total.forEach((totalBalance, i) => {
                const lockedValue = locked[tokens[i]] || 0
                result[tokens[i]] = this.parseContractBalance(tokens[i], totalBalance, lockedValue)
            })

            return result
        } catch (error) {
            return Promise.reject(error)
        }
    }

    private async checkReservedBalance(asset = ''): Promise<Dictionary<string>> {
        try {
            const path = `/address/balance/reserved/${asset}?address=${this.walletAddress}`
            const { data } = await this.chain.api.aggregator.get(path)
            return data
        } catch (error) {
            return Promise.reject(error)
        }
    }

    private parseContractBalance(token: string, totalWei: BigNumber, locked: string | number): BalanceContract {
        const totalBignumberWei = new BigNumber(totalWei.toString())
        const lockedBignumberWei = new BigNumber(this.numberToUnit(token, new BigNumber(locked)))

        const availableBignumberWei = totalBignumberWei.minus(lockedBignumberWei)

        const balanceSummary = {
            total: this.unitToNumber(token, totalBignumberWei),
            locked: this.unitToNumber(token, lockedBignumberWei),
            available: this.unitToNumber(token, availableBignumberWei)
        }

        return balanceSummary
    }

    async getTradeHistory(fromCurrency?: string, toCurrency?: string): Promise<TradeOrder[]> {
        const url = '/orderHistory?address=' + this.chain.signer.address + (fromCurrency ? '&baseAsset=' + fromCurrency : '') + (toCurrency ? '&quoteAsset=' + toCurrency : '');
        const { data } = await this.chain.api.aggregator.get(url);
        return data.map(parseTradeOrder);
    }

    async getOrderById (orderId: number): Promise<any> {
        const path = `/order?orderId=${orderId}`

        try {
            const { data } = await this.chain.api.aggregator.get(path)
            return data
        } catch (error) {
            return error
        }
    }
}
