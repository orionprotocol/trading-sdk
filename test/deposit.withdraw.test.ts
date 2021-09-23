import 'jest-extended'
import { Chain, Exchange } from '../src/index'
import { NETWORK } from '../src/utils/Constants'
import dotenv from 'dotenv'
import { ethers } from 'ethers'
dotenv.config()

jest.setTimeout(40000)

const { PRIVATE_KEY } = process.env

// For this test, network tokens are required to pay for transactions, as well as tokens for deposit / withdrawal / approve.
describe.skip('Deposit and withdraw', () => {
    let chain: Chain
    let exchange: Exchange

    if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY is required for this test!')

    it('Create chain instance and init', async () => {
        chain = new Chain(PRIVATE_KEY, NETWORK.TEST.BSC)
        await chain.init()
        expect(chain.blockchainInfo).toHaveProperty('chainName')
        expect(chain.signer).toHaveProperty('address')
    })

    it.skip('Create exchange instance', async () => {
        exchange = new Exchange(chain)
        expect(exchange).toHaveProperty('chain')
    })

    it('Approve test', async() => {
        const max = ethers.constants.MaxUint256.toString()
        const zero = ethers.constants.Zero.toString()
        console.log(max, zero);
        const aproveResult = await chain.approve('ORN', max)
        console.log(aproveResult);
    })

    it.skip('Deposit token', async() => {
        const deposit = await exchange.deposit('ORN', '10')
        expect(deposit.nonce).toBeTruthy()
    })

    it.skip('Withdraw token', async() => {
        const withdraw = await exchange.withdraw('ORN', '10')
        expect(withdraw.nonce).toBeTruthy()
    })

})
