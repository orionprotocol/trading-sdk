import { ethers } from 'ethers'
import BigNumber from 'bignumber.js'
import fetch from 'node-fetch'
import {parseTradeOrder} from '../utils/Helpers'
import {ETH_CHAINS_ID} from '../utils/Constants'
import { BlockchainInfo, PoolsConfig, TradeOrder } from '../utils/Models'
import { Tokens } from '../utils/Tokens'
export class ChainApi {
    public readonly provider: ethers.providers.JsonRpcProvider 
    public readonly orionBlockchainUrl: string
    public readonly aggregatorUrl: string
    public signer: ethers.Signer | undefined;

    private _blockchainInfo!: BlockchainInfo;
    private _tokens!: Tokens;
    private _poolsConfig?: PoolsConfig;

    constructor(providerUrl: string, blockchainUrl: string, aggregatorUrl: string) {
        this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
        this.orionBlockchainUrl = blockchainUrl
        this.aggregatorUrl = aggregatorUrl
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

    get poolsConfig() {
        return this._poolsConfig;
    }

    async getBlockchainInfo(): Promise<BlockchainInfo> {
        const data = await this.orionBlockchainApi('/info');
        data.baseCurrencyName = ETH_CHAINS_ID.includes(Number(data.chainId)) ? 'ETH' : 'BNB';
        return data;
    }

    async getTokenAddress (token: string) {
        return this.blockchainInfo.assetToAddress[token]
    }

    public async orionBlockchainApi(url: string): Promise<any> {
        const mainUrl = this.orionBlockchainUrl + '/api' + url;

        try {
            const response = await fetch(mainUrl);
            return response.json();
        } catch (e) {
            console.error(e);
            throw new Error(e.toString());
        }
    }

    public async aggregatorApi(url: string, request: any, method: string) {
        const mainUrl = this.aggregatorUrl + '/api/v1' + url;

        try {
            let response;

            if (method === 'GET') {
                response = await fetch(mainUrl);
            } else {
                response = await fetch(mainUrl, {
                    method, 
                    body: JSON.stringify(request),
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            return response.json();

        } catch (e) {
            console.error(e);
            throw new Error(e.toString());
        }
    }

    /**
     * @return {'ETH' -> 1.23}  currency to price in ORN; for order fee calculation (updated on backend once a minute)
     */
    async getPricesFromBlockchain() {
        const data: Record<string, string> = await this.orionBlockchainApi('/prices');
        const result: Record<string, BigNumber> = {};
        for (const key in data) {
            const assetName = this.tokens.addressToName(key);
            if (assetName) {
                result[assetName] = new BigNumber(data[key]);
            }
        }
        return result;
    }

    /**
     * @return gasPrice current gas price in gwei for order fee calculation (updated on backend once a minute)
     */
    async getGasPriceFromOrionBlockchain(): Promise<string> {
        const dataRaw: string = await this.orionBlockchainApi('/gasPrice');
        const gwei: string = ethers.utils.formatUnits(dataRaw, 'gwei');
        return new BigNumber(gwei).toFixed(0);
    }

    async getTradeHistory(walletAddress: string, fromCurrency?: string, toCurrency?: string): Promise<TradeOrder[]> {
        let url = '/orderHistory?address=' + walletAddress + (fromCurrency ? '&baseAsset=' + fromCurrency : '') + (toCurrency ? '&quoteAsset=' + toCurrency : '');
        if (process.env.REACT_APP_AGG_V2) {
            url = '/order/history?address=' + walletAddress + (fromCurrency ? '&baseAsset=' + fromCurrency : '') + (toCurrency ? '&quoteAsset=' + toCurrency : '');
        }
        const data = await this.aggregatorApi(url, {}, 'GET');
        return data.map(parseTradeOrder);
    }

    async getOrderStatus (walletAddress: string, orderId: number): Promise<string> {
        try {
            const history = await this.getTradeHistory(walletAddress)
            const order = history.find(order => Number(order.id) === orderId)
            return order?.status || ''
        } catch (error) {
            console.log('getOrderStatus error: ', error);
            return error
        }
    }

    connectWallet(privateKey: string): boolean {
        const signer = new ethers.Wallet(privateKey).connect(this.provider)
        this.signer = signer;
        return !!signer
    }

    disconnectWallet(): void {
        this.signer = undefined;
    }
}
