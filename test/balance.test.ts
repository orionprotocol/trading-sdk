import 'jest-extended'
import { Chain, Exchange } from '../src/index'
import { NETWORK } from '../src/utils/Constants'
import dotenv from 'dotenv';
dotenv.config()

const { PRIVATE_KEY } = process.env

describe('Get balances', () => {
    let chain: Chain
    let exchange: Exchange

    if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY is required for this test!')

    it('Create chain instance and init', async () => {
        chain = new Chain(PRIVATE_KEY, NETWORK.TEST.BSC)
        await chain.init()
        expect(chain.blockchainInfo).toHaveProperty('chainName')
        expect(chain.signer).toHaveProperty('address')
    })

    it('Create exchange instance', async () => {
        exchange = new Exchange(chain)
        expect(exchange).toHaveProperty('chain')
    })

    it('Check wallet balance summary', async() => {
        const balance = await chain.getWalletBalance()
        expect(Object.keys(balance).length).toBeTruthy()
    })

    it('Check wallet balance by ticker', async() => {
        const balance = await chain.getWalletBalance('ORN')
        expect(Object.keys(balance).length).toBeTruthy()
    })

    it('Check contract balance summary', async () => {
        const balance = await exchange.getContractBalance()
        const firstKey = Object.keys(balance)[0]
        expect(Object.keys(balance)[0]).toBeTruthy()
        expect(balance[firstKey].total && balance[firstKey].locked && balance[firstKey].available).toBeTruthy()
    })

    it('Check contract balance by ticker', async () => {
        const balance = await exchange.getContractBalance('ORN')
        const firstKey = Object.keys(balance)[0]
        expect(Object.keys(balance)[0]).toBeTruthy()
        expect(balance[firstKey].total && balance[firstKey].locked && balance[firstKey].available).toBeTruthy()
    })

})
