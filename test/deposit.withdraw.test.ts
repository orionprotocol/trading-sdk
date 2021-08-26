import 'jest-extended'
import { Chain, Orion } from '../src/index'
// import BigNumber from 'bignumber.js';
import { NETWORK } from '../src/utils/Constants'
import dotenv from 'dotenv';
import { ethers } from 'ethers';
dotenv.config()

const { PRIVATE_KEY } = process.env

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

    it('Check wallet balance by ticker', async() => {
        const balance = await orion.getWalletBalance('ORN')
        const balanceBig = ethers.BigNumber.from(balance.ORN)
        console.log(balanceBig.toString(), ethers.utils.formatUnits(balanceBig, 8));
    })

    // it('Check contract balance by ticker', async () => {
    //     const balance = await orion.getContractBalance('ORN')
    //     console.log(balance);
    // })

    it('Check allowance', async() => {
        const allowance = await orion.getAllowanceERC20('ORN')
        console.log(allowance.toString());
    })

})
