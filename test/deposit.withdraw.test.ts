import 'jest-extended'
import { Chain, Orion } from '../src/index'
// import BigNumber from 'bignumber.js';
import { NETWORK } from '../src/utils/Constants'
import dotenv from 'dotenv';
// import { ethers } from 'ethers';
dotenv.config()

jest.setTimeout(40000)

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
        const token = 'ORN'
        const balance = await orion.getWalletBalance(token)
        console.log('wallet balance', balance);
    })

    // it('Get allowance', async() => {
    //     const gasPriceWei = await chain.getGasPriceFromOrionBlockchain()
    //     const allowance = await orion.allowanceChecker('ORN', '10', gasPriceWei)
    //     console.log('allowance', allowance);
    //     // console.log('allowance',  ethers.BigNumber.from(allowance));
    // })

    // it('Set approve', async() => {
    //     const gasPriceWei = await chain.getGasPriceFromOrionBlockchain()
    //     const approve = await orion.approve('ORN', gasPriceWei, ethers.constants.Zero.toString())
    //     console.log('approve', approve);
    // })

    // it('Get allowance after', async() => {
    //     const allowance = await orion.getAllowanceERC20('ORN')
    //     console.log('allowance', allowance.toString());
    // })

    // it('Check allowance', async() => {
    //     const gasPriceWei = await chain.getGasPriceFromOrionBlockchain()
    //     await orion.allowanceChecker('ORN', '10', gasPriceWei)
    //     // console.log(allowance.toString());
    // })

    // it('Deposit', async() => {
    //     const deposit = await orion.deposit('ORN', '10')
    //     console.log(deposit);
    // })

})
