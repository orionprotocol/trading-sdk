import 'jest-extended'
import { Chain, Orion } from '../src/index'
// import { SignOrderModelRaw, BlockchainOrder } from '../src/utils/Models'
import { NETWORK } from '../src/utils/Constants'
import dotenv from 'dotenv';
dotenv.config()

const { PRIVATE_KEY } = process.env

describe.skip('Get balances', () => {
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

    it('Check wallet balance summary', async() => {
        const balance = await orion.getWalletBalance()
        expect(Object.keys(balance).length).toBeTruthy()
    })

    it('Check wallet balance by ticker', async() => {
        const balance = await orion.getWalletBalance('ORN')
        expect(Object.keys(balance).length).toBeTruthy()
    })

    it('Check contract balance summary', async () => {
        const balance = await orion.getContractBalance()
        const firstKey = Object.keys(balance)[0]
        expect(Object.keys(balance)[0]).toBeTruthy()
        expect(balance[firstKey].total && balance[firstKey].locked && balance[firstKey].available).toBeTruthy()
    })

    it('Check contract balance by ticker', async () => {
        const balance = await orion.getContractBalance('ORN')
        const firstKey = Object.keys(balance)[0]
        expect(Object.keys(balance)[0]).toBeTruthy()
        expect(balance[firstKey].total && balance[firstKey].locked && balance[firstKey].available).toBeTruthy()
    })

})
