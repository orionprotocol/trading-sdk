import BigNumber from "bignumber.js";
import {ethers} from "ethers";
import {signTypedMessage} from 'eth-sig-util';
import {arrayify, joinSignature, splitSignature} from "ethers/lib/utils";
import {BlockchainInfo, Dictionary, BlockchainOrder, SignOrderModel, CancelOrderRequest} from "../utils/Models";
import {getPriceWithDeviation, calculateMatcherFee, calculateNetworkFee, DEPOSIT_ETH_GAS_LIMIT, DEPOSIT_ERC20_GAS_LIMIT} from '../utils/Helpers'
import exchangeABI from '../abis/Exchange.json';
import erc20ABI from '../abis/ERC20.json';
import { ChainApi } from "./ChainApi";

export const DEFAULT_EXPIRATION: number = 29 * 24 * 60 * 60 * 1000; // 29 days

export const FEE_CURRENCY = 'ORN'

export const ORDER_TYPES = {
    Order: [
        {name: "senderAddress", type: "address"},
        {name: "matcherAddress", type: "address"},
        {name: "baseAsset", type: "address"},
        {name: "quoteAsset", type: "address"},
        {name: "matcherFeeAsset", type: "address"},
        {name: "amount", type: "uint64"},
        {name: "price", type: "uint64"},
        {name: "matcherFee", type: "uint64"},
        {name: "nonce", type: "uint64"},
        {name: "expiration", type: "uint64"},
        {name: "buySide", type: "uint8"},
    ],
}

export const DOMAIN_TYPE = [
    {name: "name", type: "string"},
    {name: "version", type: "string"},
    {name: "chainId", type: "uint256"},
    {name: "salt", type: "bytes32"},
]

export function hashOrder(order: BlockchainOrder): string {
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

export class OrionBlockchain {
    private blockchainInfo: BlockchainInfo;
    public readonly provider: ethers.providers.Provider;
    public readonly walletAddress: string;
    public readonly chainApi: ChainApi;
    private usePersonalSign = false;

    private readonly exchangeContract: ethers.Contract;
    private readonly tokensContracts: Dictionary<ethers.Contract>;

    constructor(chainApi: ChainApi, walletAddress: string, walletType: string) {
        this.blockchainInfo = chainApi.blockchainInfo;
        this.provider = chainApi.provider;
        this.walletAddress = walletAddress;
        this.chainApi = chainApi

        this.usePersonalSign = ['LedgerETH', 'LedgerBSC', 'TrezorETH', 'TrezorBSC'].indexOf(walletType) > -1;

        this.exchangeContract = new ethers.Contract(
            this.blockchainInfo.exchangeContractAddress,
            exchangeABI,
            chainApi.signer
        );

        this.tokensContracts = {};
        const tokens = this.blockchainInfo.assetToAddress;
        for (const name in tokens) {
            if (name === this.blockchainInfo.baseCurrencyName) continue;
            const tokenAddress = tokens[name];
            const tokenContract = new ethers.Contract(
                tokenAddress,
                erc20ABI,
                chainApi.signer
            );

            this.tokensContracts[name] = tokenContract;
            this.tokensContracts[tokenAddress] = tokenContract;
        }
    }

    getDomainData() {
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

    tokenAddressToName(address: string): string {
        for (const name in this.blockchainInfo.assetToAddress) {
            if (this.blockchainInfo.assetToAddress.hasOwnProperty(name)) {
                if (this.blockchainInfo.assetToAddress[name] === address.toLowerCase()) return name;
            }
        }
        return '';
    }

    private async validateOrder(order: BlockchainOrder): Promise<boolean> {
        return this.exchangeContract.validateOrder(order);
    }

    async _signOrderPersonal(order: BlockchainOrder): Promise<string> {
        const message = ethers.utils.solidityKeccak256(
            ['string', 'address', 'address', 'address', 'address', 'address', 'uint64', 'uint64', 'uint64', 'uint64', 'uint64', 'uint8'],
            [
                'order',
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
                order.buySide
            ]
        );
        const signature = await this.chainApi.signer!.signMessage(arrayify(message));
        return joinSignature(splitSignature(signature)); // NOTE: metamask broke sig.v value and we fix it in this line
    }

    async _signOrder(order: BlockchainOrder): Promise<string> {
        const s = this.chainApi.signer as any;
        if (!s.privateKey) {
            if (this.usePersonalSign) {
                order.isPersonalSign = true;
                return this._signOrderPersonal(order);
            }

            try {
                const signature = await s._signTypedData(
                    this.getDomainData(),
                    ORDER_TYPES,
                    order,
                );
                return signature;
            } catch (e) {
                if (e.code === -32603) { // MetaMask Message Signature: Error: Not supported on this device
                    order.isPersonalSign = true;
                    this.usePersonalSign = true;
                    return this._signOrderPersonal(order);
                } else {
                    throw e;
                }
            }
        } else {
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
            const bufferKey = Buffer.from((this.chainApi.signer as ethers.Wallet).privateKey.substr(2), 'hex');
            return signTypedMessage(bufferKey, msgParams as any, 'V4');
        }
    }

    async signOrder(params: SignOrderModel): Promise<BlockchainOrder> {

        try {
            const baseAsset: string = this.getTokenAddress(params.fromCurrency);
            const quoteAsset: string = this.getTokenAddress(params.toCurrency);
            const nonce: number = Date.now();
    
            console.log('signOrder params: ', params);
    
            if (!params.price.gt(0)) throw new Error('Invalid price');
            if (!params.amount.gt(0)) throw new Error('Invalid amount');
            if (!params.priceDeviation.gte(0)) throw new Error('Invalid priceDeviation');
    
            if (params.numberFormat.qtyPrecision === undefined || params.numberFormat.qtyPrecision === null) throw new Error('Invalid qtyPrecision');
            if (params.numberFormat.pricePrecision === undefined || params.numberFormat.pricePrecision === null) throw new Error('Invalid pricePrecision');
    
            const gasPriceGwei = await this.chainApi.getGasPriceFromOrionBlockchain();
            const blockchainPrices = await this.chainApi.getPricesFromBlockchain()
    
            const matcherFee = calculateMatcherFee(params.fromCurrency, params.amount, params.price, params.side, blockchainPrices, true);
            const {networkFee} = calculateNetworkFee(this.chainApi, gasPriceGwei, blockchainPrices, 'ORN', false);
            const totalFee = matcherFee.plus(networkFee)
            console.log(`${matcherFee} + ${networkFee} = ${totalFee}`);
    
            const priceWithDeviation = params.priceDeviation.isZero() ? params.price : getPriceWithDeviation(params.price, params.side, params.priceDeviation);
    
            const amountRounded: BigNumber = params.amount.decimalPlaces(params.numberFormat.qtyPrecision, BigNumber.ROUND_DOWN);
            const priceRounded: BigNumber = priceWithDeviation.decimalPlaces(params.numberFormat.pricePrecision, params.side === 'buy' ? BigNumber.ROUND_UP : BigNumber.ROUND_DOWN);
            const matcherFeeAsset: string = this.getTokenAddress(FEE_CURRENCY);
    
            if (totalFee.isZero()) throw new Error('Zero fee');
    
            const order: BlockchainOrder = {
                id: '',
                senderAddress: params.senderAddress,
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

    private numberTo8(n: BigNumber.Value): number {
        return Number(new BigNumber(n).multipliedBy(1e8).toFixed(0)); // todo: можно ли не оборачивать в Number?
    }

    async getBalance(address: string): Promise<BigNumber> {
        const wei: ethers.BigNumber = await this.provider.getBalance(address);
        return new BigNumber(ethers.utils.formatEther(wei));
    }

    private async sendTransaction(unsignedTx: ethers.PopulatedTransaction, gasLimit: number, gasPriceWei: BigNumber): Promise<ethers.providers.TransactionResponse> {
        if(gasLimit > 0) unsignedTx.gasLimit = ethers.BigNumber.from(gasLimit);
        unsignedTx.gasPrice = ethers.BigNumber.from(gasPriceWei.toString());
        const unsignedRequest: ethers.providers.TransactionRequest = await this.chainApi.signer!.populateTransaction(unsignedTx); // NOTE: validate transaction when estimate gas
        return this.chainApi.signer!.sendTransaction(unsignedRequest);
    }

    async swapThroughOrionPool(
        amountSpend: string,
        amountReceive: string,
        path: string[],
        gasLimit = 600000,
    ): Promise<ethers.providers.TransactionResponse> {
        const txRequest = await this.exchangeContract.populateTransaction.swapThroughOrionPool(
            ethers.BigNumber.from(amountSpend),
            ethers.BigNumber.from(amountReceive),
            path,
            true,
        );

        const gasPriceGwei = await this.chainApi.getGasPriceFromOrionBlockchain();
        const gasPriceWei = new BigNumber(ethers.utils.parseUnits(gasPriceGwei, 'gwei').toString())

        return this.sendTransaction(
            txRequest,
            gasLimit,
            gasPriceWei
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

    
    async sendOrder(order: BlockchainOrder, isCreateInternalOrder: boolean): Promise<number | string> {
        try {
            return await this.chainApi.aggregatorApi(isCreateInternalOrder ? '/order/maker' : '/order', order, 'POST')
        } catch (error) {
            console.log('ChainApi order error: ', error);
            return error
        }
    }

    async cancelOrder(order: CancelOrderRequest): Promise<void> {
        return await this.chainApi.aggregatorApi('/order', order, 'DELETE');
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
        console.log('depositERC20', gasPriceWei);
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
            const gasPriceGwei = await this.chainApi.getGasPriceFromOrionBlockchain();
            const gasPriceWei = new BigNumber(ethers.utils.parseUnits(gasPriceGwei, 'gwei').toString())

            if (currency === this.blockchainInfo.baseCurrencyName) {
                return this.depositETH(amountUnit, gasPriceWei)
            } else {
                return this.depositERC20(currency, amountUnit, gasPriceWei)
            }
        } catch (error) {
            console.log('deposit error: ', error);
            return error
        }
    }

    async checkContractBalance(tokenSymbol: string, walletAddress: string) {
        try {
            const tokenAddress = this.getTokenAddress(tokenSymbol)
            const balance = await this.exchangeContract.getBalance(tokenAddress, walletAddress)
            return balance
        } catch (error) {
            console.log(error);
            return error
        }
    }

    async checkReservedBalance(walletAddress: string, asset = '') {
        try {
            const path = `/address/balance/reserved/${asset}?address=${walletAddress}`
            return await this.chainApi.aggregatorApi(path, {}, 'GET')
        } catch (error) {
            console.log(error);
            return error
        }
    }
}