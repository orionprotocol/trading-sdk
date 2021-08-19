import { ethers } from 'ethers'
import BigNumber from 'bignumber.js'
import { parseTradeOrder } from '../utils/Helpers'
import { BlockchainInfo, TradeOrder, NetworkEntity } from '../utils/Models'
import { Tokens } from '../utils/Tokens'
import { NETWORK } from '../utils/Constants'
import { Api } from './api'

const ETH_CHAINS_ID = [1,3]
export class Chain {
    public readonly provider: ethers.providers.JsonRpcProvider
    public signer: ethers.Wallet
    public api: Api

    private _blockchainInfo!: BlockchainInfo
    private _tokens!: Tokens

    constructor(privateKey: string, network: NetworkEntity = NETWORK.TEST.BSC) {
        this.provider = new ethers.providers.JsonRpcProvider(network.RPC);
        this.api = new Api(network.ORION)
        this.signer = new ethers.Wallet(privateKey).connect(this.provider)
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

    async getBlockchainInfo(): Promise<BlockchainInfo> {
        const { data } = await this.api.blockchain.get('/info');
        data.baseCurrencyName = ETH_CHAINS_ID.includes(Number(data.chainId)) ? 'ETH' : 'BNB';
        return data;
    }

    /**
     * @return {'ETH' -> 1.23}  currency to price in ORN; for order fee calculation
     */
    async getPricesFromBlockchain(): Promise<Record<string, BigNumber>> {
        const { data } = await this.api.blockchain.get('/prices');
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
        const {data}: {data: string} = await this.api.blockchain.get('/gasPrice');
        const gwei: string = ethers.utils.formatUnits(data, 'gwei');
        return new BigNumber(gwei).toFixed(0);
    }

    async getGasPriceWei (): Promise<BigNumber> {
        const gasPriceGwei = await this.getGasPriceFromOrionBlockchain();
        const gasPriceWei = new BigNumber(ethers.utils.parseUnits(gasPriceGwei, 'gwei').toString())
        return gasPriceWei
    }

    async getTradeHistory(fromCurrency?: string, toCurrency?: string): Promise<TradeOrder[]> {
        const url = '/orderHistory?address=' + this.signer.address + (fromCurrency ? '&baseAsset=' + fromCurrency : '') + (toCurrency ? '&quoteAsset=' + toCurrency : '');
        const { data } = await this.api.aggregator.get(url);
        return data.map(parseTradeOrder);
    }

    async getOrderById (orderId: number): Promise<any> {
        const path = `/order?orderId=${orderId}`

        try {
            const { data } = await this.api.aggregator.get(path)
            return data
        } catch (error) {
            return error
        }
    }
}
