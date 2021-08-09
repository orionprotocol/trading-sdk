import { ethers } from 'ethers'
import BigNumber from 'bignumber.js'
import fetch from 'node-fetch'
import {ETH_CHAIN_ID} from '../utils/Helpers'
import { BlockchainInfo, BlockchainOrder, PoolsConfig } from '../utils/Models'
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
        data.baseCurrencyName = data.chainId === ETH_CHAIN_ID ? 'ETH' : 'BNB';
        return data;
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

    private async aggregatorApi(url: string, request: any, method: string) {
        const mainUrl = this.aggregatorUrl + '/api/v1' + url;

        try {
            let response;

            if (method === 'GET') {
                response = await fetch(mainUrl);
            } else {
                response = await fetch(mainUrl, {method, body: request});
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
    async getGasPriceFromOrionBlockchain() {
        const dataRaw: string = await this.orionBlockchainApi('/gasPrice');
        const gwei: string = ethers.utils.formatUnits(dataRaw, 'gwei');
        return new BigNumber(gwei).toFixed(0);
    }

    connectWallet(privateKey: string): boolean {
        const signer = new ethers.Wallet(privateKey).connect(this.provider)
        this.signer = signer;
        return !!signer
    }

    disconnectWallet() {
        this.signer = undefined;
    }

    async order(order: BlockchainOrder, isCreateInternalOrder: boolean): Promise<number | string> {
        return (await this.aggregatorApi(isCreateInternalOrder ? '/order/maker' : '/order', order, 'POST')).orderId;
    }

}
