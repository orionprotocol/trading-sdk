import { ethers } from 'ethers'
import BigNumber from 'bignumber.js'
import { BlockchainInfo, NetworkEntity, Dictionary } from '../utils/Models'
import { Tokens } from '../utils/Tokens'
import { NETWORK, NETWORK_TOKEN_ADDRESS } from '../utils/Constants'
import { handleResponse, getTokenContracts } from '../utils/Helpers'
import { Api } from './api'

export class Chain {
    public readonly provider: ethers.providers.JsonRpcProvider
    public readonly signer: ethers.Wallet
    public readonly api: Api
    public readonly network: NetworkEntity

    public tokensContracts!: Dictionary<ethers.Contract>;
    private _blockchainInfo!: BlockchainInfo
    private _tokens!: Tokens
    private _isEthereum!: boolean
    private _tokensFee!: Dictionary<string>
    private _baseLimits!: Dictionary<number>

    constructor(privateKey: string, network: NetworkEntity = NETWORK.TEST.BSC) {
        this.provider = new ethers.providers.JsonRpcProvider(network.RPC);
        this.api = new Api(network)
        this.signer = new ethers.Wallet(`0x${privateKey}`).connect(this.provider)
        this.network = network
    }

    public async init(): Promise<void> {
        const info = await this.getBlockchainInfo();
        this._tokensFee = await this.getTokensFee()
        this._baseLimits = await this.getBaseLimits()
        info.baseCurrencyName = this.getNetworkAsset(info)
        this._blockchainInfo = info
        this._tokens = new Tokens(this._blockchainInfo.assetToAddress);
        this._isEthereum = this._blockchainInfo.baseCurrencyName === 'ETH'
        this.tokensContracts = getTokenContracts(this)
    }

    get blockchainInfo(): BlockchainInfo {
        return this._blockchainInfo;
    }

    get tokens(): Tokens {
        return this._tokens;
    }

    get baseLimits(): Dictionary<number> {
        return this._baseLimits;
    }

    get tokensFee(): Dictionary<string> {
        return this._tokensFee
    }

    get isEthereum(): boolean {
        return this._isEthereum
    }

    public getTokenAddress(name: string): string {
        return this.blockchainInfo.assetToAddress[name];
    }

    public getTokenSymbolsList(): string[] {
        return Object.keys(this.blockchainInfo.assetToAddress)
    }

    public getTokenAddressesList(): string[] {
        return Object.values(this.blockchainInfo.assetToAddress)
    }

    public tokenAddressToName(address: string): string {
        for (const name in this.blockchainInfo.assetToAddress) {
            if (Object.prototype.hasOwnProperty.call(this.blockchainInfo.assetToAddress, name)) {
                if (this.blockchainInfo.assetToAddress[name] === address.toLowerCase()) return name;
            }
        }
        return '';
    }

    public getNetworkAsset (data: BlockchainInfo): string {
        const networkToken = Object.entries(data.assetToAddress).find(el => el[1] === NETWORK_TOKEN_ADDRESS)
        if (!networkToken || !networkToken[0]) throw new Error('Cannot get network token!')
        return networkToken[0]
    }

    public isNetworkAsset (asset: string): boolean {
        return this.blockchainInfo.baseCurrencyName.toUpperCase() === asset.toUpperCase()
    }

    public async checkNetworkTokens (): Promise<void> {
        const networkAssetBalance = await this.getNetworkBalance()
        if (!networkAssetBalance.gt(0)) throw new Error('A non-zero balance of network tokens is required!')
    }

    getBlockchainInfo(): Promise<BlockchainInfo> {
        return handleResponse(this.api.orionBlockchain.get('/info'))
    }

    getTokensFee(): Promise<Dictionary<string>> {
        return handleResponse(this.api.orionBlockchain.get('/tokensFee'))
    }

    getBaseLimits(): Promise<Dictionary<number>> {
        return handleResponse(this.api.orionBlockchain.get('/baseLimits'))
    }

    async getBlockchainPrices(): Promise<Record<string, BigNumber>> {
        try {
            const data = await handleResponse(this.api.orionBlockchain.get('/prices'));
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
            return this.getGasPriceOB()
        }
        return this.getGasPriceBinance();
    }

    private async getGasPriceOB(): Promise<string> {
        return handleResponse(this.api.orionBlockchain.get('/gasPrice'))
    }

    private async getGasPriceBinance(): Promise<string> {
        try {
            const data: { jsonrpc: string, id: number, result: string} = await handleResponse(this.api.binance.post('', {
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_gasPrice',
                params: []
            }))

            return new BigNumber(data.result).toString()
        } catch (error) {
            return Promise.reject(error)
        }
    }

    async getNetworkBalance (): Promise<BigNumber> {
        try {
            const wei: ethers.BigNumber = await this.provider.getBalance(this.signer.address);
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
                    let tokens = this.getTokenSymbolsList()

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

    async getTokenBalance (token: string): Promise<string[]> {
        try {
            const balance = await this.tokensContracts[token].balanceOf(this.signer.address)
            return [token, balance.toString()]
        } catch (error) {
            return Promise.reject(error)
        }
    }

    public async sendTransaction(unsignedTx: ethers.PopulatedTransaction, gasLimit: number, gasPriceWei: BigNumber): Promise<ethers.providers.TransactionResponse> {
        try {
            if(gasLimit > 0) unsignedTx.gasLimit = ethers.BigNumber.from(gasLimit);
            unsignedTx.gasPrice = ethers.BigNumber.from(gasPriceWei.toString());
            const unsignedRequest: ethers.providers.TransactionRequest = await this.signer.populateTransaction(unsignedTx); // NOTE: validate transaction when estimate gas
            return this.signer.sendTransaction(unsignedRequest);
        } catch (error) {
            return Promise.reject(error)
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
            const unit: ethers.BigNumber = await currentTokenContract.allowance(this.signer.address, toAddress);
            return new BigNumber(unit.toString()).dividedBy(10 ** decimals);
        } catch (error) {
            return Promise.reject(error)
        }
    }

    async allowanceHandler (currency: string, amount: string, gasPriceWei: string): Promise<ethers.providers.TransactionResponse | void> {
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
            this.signer.address,
            ethers.constants.MaxUint256,
        );
        try {
            await this.signer.estimateGas(unsignedTx);
            return false;
        } catch (e) {
            return true;
        }
    }

    async approve(currency: string, amountUnit: string, gasPriceWei?: string): Promise<ethers.providers.TransactionResponse> {
        try {
            await this.checkNetworkTokens()

            const gasPriceWeiLocal = gasPriceWei ? gasPriceWei : await this.getGasPrice()

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
                this.baseLimits.APPROVE_ERC20_GAS_LIMIT,
                new BigNumber(gasPriceWei),
            )
        } catch (error) {
            return Promise.reject(error)
        }
    }
}
