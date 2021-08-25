import 'jest-extended'
import { Chain, Orion } from '../src/index'
// import { SignOrderModelRaw, BlockchainOrder } from '../src/utils/Models'
import { NETWORK } from '../src/utils/Constants'
import dotenv from 'dotenv';
dotenv.config()

const { PRIVATE_KEY } = process.env

describe('Send order', () => {
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

    it('Check wallet balance', async(done) => {
        const balance = await orion.getWalletBalance()
        console.log('wallet balance', balance);
        done()
    })

    it('Check contract balance', async (done) => {
        const balance = await orion.checkContractBalance('ORN')
        console.log('contract balance', balance);
        done()
    })

})
