import BigNumber from "bignumber.js"
import { ethers } from "ethers"
import { DEPOSIT_ETH_GAS_LIMIT, DEPOSIT_ERC20_GAS_LIMIT, EXCHANGE_ORDER_PRECISION, CHAIN_TX_TYPES } from '../utils/Constants'
import { BlockchainOrder, Dictionary, BalanceContract } from '../utils/Models'
import { Chain } from './chain'
import exchangeABI from '../abis/Exchange.json'
import { numberToUnit, unitToNumber, handleResponse, waitForTx } from '../utils/Helpers'

export class Exchange {
    public readonly chain: Chain;
    public exchangeContract!: ethers.Contract;

    constructor(chain: Chain) {
        this.chain = chain

        this.exchangeContract = new ethers.Contract(
            this.chain.blockchainInfo.exchangeContractAddress,
            exchangeABI,
            this.chain.signer
        );
    }

    async getContractBalance(tokenSymbol?: string): Promise<Dictionary<BalanceContract>> {
        const token = tokenSymbol ? tokenSymbol.toUpperCase() : ''

        try {
            if (token && !this.chain.getTokenSymbolsList().includes(token)) throw new Error('Invalid token')

            const result: Dictionary<BalanceContract> = {}

            const tokenAddresses = token
                ? [this.chain.getTokenAddress(token)]
                : this.chain.getTokenAddressesList()

            const tokens = token ? [token] : this.chain.getTokenSymbolsList()

            const total: BigNumber[] = await this.exchangeContract.getBalances(tokenAddresses, this.chain.signer.address)
            const locked = await this.checkReservedBalance(this.chain.signer.address)

            total.forEach((totalBalance, i) => {
                const lockedValue = locked[tokens[i]] || 0
                result[tokens[i]] = this.parseContractBalance(totalBalance, lockedValue)
            })

            return result
        } catch (error) {
            return Promise.reject(error)
        }
    }

    public async checkReservedBalance(walletAddress: string, asset = ''): Promise<Dictionary<string>> {
        const path = `/address/balance/reserved/${asset}?address=${walletAddress}`

        return handleResponse(this.chain.api.orionAggregator.get(path))
    }

    private parseContractBalance(total8: BigNumber, locked: string | number): BalanceContract {
        const total = ethers.utils.formatUnits(ethers.BigNumber.from(total8.toString()), EXCHANGE_ORDER_PRECISION)
        const totalBN = new BigNumber(total)
        const lockedBN = new BigNumber(locked)

        const availableBN = totalBN.minus(lockedBN)

        const balanceSummary = {
            total: totalBN,
            locked: lockedBN,
            available: availableBN
        }

        return balanceSummary
    }

    private async depositETH(amountUnit: string, gasPriceWei: BigNumber): Promise<string> {
        const unsignedTx: ethers.PopulatedTransaction = await this.exchangeContract.populateTransaction.deposit();
        unsignedTx.value = ethers.BigNumber.from(amountUnit);
        const txResponse = await this.chain.sendTransaction(
            unsignedTx,
            DEPOSIT_ETH_GAS_LIMIT,
            gasPriceWei
        )

        return waitForTx(txResponse, this.chain.network.TX_TIMEOUT_SEC, CHAIN_TX_TYPES.deposit)
    }

    private async depositERC20(currency: string, amountUnit: string, gasPriceWei: BigNumber): Promise<string> {
        const txResponse = await this.chain.sendTransaction(
            await this.exchangeContract.populateTransaction.depositAsset(this.chain.getTokenAddress(currency), amountUnit),
            DEPOSIT_ERC20_GAS_LIMIT,
            gasPriceWei
        )

        return waitForTx(txResponse, this.chain.network.TX_TIMEOUT_SEC, CHAIN_TX_TYPES.deposit)
    }

    async deposit(currency: string, amount: string, gasPriceWei?: string): Promise<string> {
        try {
            await this.chain.checkNetworkTokens()

            const bignumberAmount = new BigNumber(amount)
            const amountUnit = numberToUnit(currency, bignumberAmount, this.chain.blockchainInfo);

            const walletBalanceUint = await this.chain.getWalletBalance(currency)
            const walletBalance = unitToNumber(currency, new BigNumber(walletBalanceUint[currency]), this.chain.blockchainInfo)

            if (walletBalance.lt(bignumberAmount)) throw new Error(`The wallet balance (${walletBalance}) is lower than the deposit amount (${amount})!`)

            const gasPriceWeiLocal = gasPriceWei ? gasPriceWei : await this.chain.getGasPrice()

            if (this.chain.isNetworkAsset(currency)) {
                return this.depositETH(amountUnit, new BigNumber(gasPriceWeiLocal))
            } else {
                await this.chain.allowanceHandler(currency, amount, gasPriceWeiLocal)
                return this.depositERC20(currency, amountUnit, new BigNumber(gasPriceWeiLocal))
            }
        } catch (error) {
            return Promise.reject(error)
        }
    }

    async withdraw(currency: string, amount: string, gasPriceWei?: string): Promise<string> {
        try {
            await this.chain.checkNetworkTokens()

            const amountUnit = numberToUnit(currency, new BigNumber(amount), this.chain.blockchainInfo);
            const balance = await this.getContractBalance(currency)
            const gasPriceWeiLocal = gasPriceWei ? gasPriceWei : await this.chain.getGasPrice()

            if (balance[currency].available.lt(new BigNumber(amount))) throw new Error(`The available contract balance (${balance[currency].available}) is less than the withdrawal amount (${new BigNumber(amount)})! `)

            const txResponse = await this.chain.sendTransaction(
                await this.exchangeContract.populateTransaction.withdraw(this.chain.getTokenAddress(currency), amountUnit),
                DEPOSIT_ERC20_GAS_LIMIT,
                new BigNumber(gasPriceWeiLocal),
            );

            return waitForTx(txResponse, this.chain.network.TX_TIMEOUT_SEC, CHAIN_TX_TYPES.withdraw)
        } catch (error) {
            return Promise.reject(error)
        }
    }

    async validateOrder(order: BlockchainOrder): Promise<boolean> {
        return this.exchangeContract.validateOrder(order);
    }
}

