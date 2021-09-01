import 'jest-extended'
import { Chain, Orion } from '../src/index'
import { NETWORK } from '../src/utils/Constants'
import dotenv from 'dotenv';
dotenv.config()

jest.setTimeout(40000)

const { PRIVATE_KEY } = process.env

// For this test, network tokens are required to pay for transactions, as well as tokens for deposit / withdrawal / approve.
describe('Deposit and withdraw', () => {
    let chain: Chain
    let orion: Orion

    if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY is required for this test!')

    it('Create chain instance and init', async () => {
        chain = new Chain(PRIVATE_KEY, NETWORK.TEST.BSC)
        await chain.init()
        expect(chain.blockchainInfo).toHaveProperty('chainName')
        expect(chain.signer).toHaveProperty('address')
    })

    it('Create orion instance', async () => {
        orion = new Orion(chain)
        expect(orion).toHaveProperty('chain')
    })

    it('Deposit token', async() => {
        const deposit = await orion.deposit('ORN', '10')
        expect(deposit.nonce).toBeTruthy()
    })

    it('Withdraw token', async() => {
        const withdraw = await orion.withdraw('ORN', '10')
        expect(withdraw.nonce).toBeTruthy()
    })

})