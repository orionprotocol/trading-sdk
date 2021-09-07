import { ethers } from 'ethers'
import BigNumber from 'bignumber.js'
import { parseTradeOrder } from '../utils/Helpers'
import { BlockchainInfo, TradeOrder, NetworkEntity } from '../utils/Models'
import { Tokens } from '../utils/Tokens'
import { NETWORK } from '../utils/Constants'
import { Api } from './api'
import axios from 'axios'

const ETH_CHAINS_ID = [1,3]
export class Chain {
    public readonly provider: ethers.providers.JsonRpcProvider
    public readonly signer: ethers.Wallet
    public readonly api: Api
    public readonly network: NetworkEntity
    public readonly isEthereum: boolean;

    private _blockchainInfo!: BlockchainInfo
    private _tokens!: Tokens

    constructor(privateKey: string, network: NetworkEntity = NETWORK.TEST.BSC) {
        this.provider = new ethers.providers.JsonRpcProvider(network.RPC);
        this.api = new Api(network.ORION)
        this.signer = new ethers.Wallet(privateKey).connect(this.provider)
        this.network = network
        this.isEthereum = ETH_CHAINS_ID.includes(network.CHAIN_ID)
    }

    public async init(): Promise<void> {
        this._blockchainInfo = await this.getBlockchainInfo();
        this._tokens = new Tokens(this._blockchainInfo.assetToAddress);
    }

    get blockchainInfo(): BlockchainInfo {
        return this._blockchainInfo;
    }

    get tokens(): Tokens {
        return this._tokens;
    }

    public getTokenAddress (token: string): string {
        return this.blockchainInfo.assetToAddress[token]
    }

    getBaseCurrency (chainId: number): string {
        return ETH_CHAINS_ID.includes(chainId) ? 'ETH' : 'BNB';
    }

    async getBlockchainInfo(): Promise<BlockchainInfo> {
        try {
            const { data } = await this.api.blockchain.get('/info')
            data.baseCurrencyName = this.getBaseCurrency(this.network.CHAIN_ID)
            return data;
        } catch (error) {
            return Promise.reject(error)
        }
    }

    /**
     * @return {'ETH' -> 1.23}  currency to price in ORN; for order fee calculation
     */
    async getPricesFromBlockchain(): Promise<Record<string, BigNumber>> {
        try {
            const { data } = await this.api.blockchain.get('/prices');
            const result: Record<string, BigNumber> = {};

            for (const key in data) {
                const assetName = this.tokens.addressToName(key);
                if (assetName) {
                    result[assetName] = new BigNumber(data[key]);
                }
            }
            return result;
        } catch (error) {
            return Promise.reject(error)
        }
    }

    /**
     * @return gasPrice current gas price in wei
     */
    async getGasPrice(): Promise<string> {
        if (this.isEthereum) {
            return this.getGasPriceEthereum();
        }
        return this.getGasPriceBinance();
    }

    /**
     * @return gasPrice current gas price in wei
     */
    private async getGasPriceEthereum(): Promise<string> {
        return this.getGasPriceFromOrionBlockchain();
    }

    /**
     * @return gasPrice current gas price in wei
     */
    private async getGasPriceBinance(): Promise<string> {
        const { data }: { data: { jsonrpc: string, id: number, result: string} } = await axios.post(this.network.RPC, {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_gasPrice',
            params: []
        })
        return new BigNumber(data.result).toString()
    }

    /**
     * @return gasPrice current gas price in wei for order fee calculation (updated on backend once a minute)
     */
    private async getGasPriceFromOrionBlockchain(): Promise<string> {
        try {
            const {data}: {data: string} = await this.api.blockchain.get('/gasPrice');
            return data
        } catch (error) {
            return Promise.reject(error)
        }
    }

    async getTradeHistory(fromCurrency?: string, toCurrency?: string): Promise<TradeOrder[]> {
        try {
            const url = '/orderHistory?address=' + this.signer.address + (fromCurrency ? '&baseAsset=' + fromCurrency : '') + (toCurrency ? '&quoteAsset=' + toCurrency : '');
            const { data } = await this.api.aggregator.get(url);
            return data.map(parseTradeOrder);

        } catch (error) {
            return Promise.reject(error)
        }
    }

    async getOrderById (orderId: number): Promise<TradeOrder> {
        const path = `/order?orderId=${orderId}`

        try {
            const { data } = await this.api.aggregator.get(path)
            return data
        } catch (error) {
            return Promise.reject(error)
        }
    }
}
