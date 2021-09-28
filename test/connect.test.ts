import 'jest-extended'
import { Chain } from '../src/index'
import { NETWORK, NETWORK_TOKEN_ADDRESS } from '../src/utils/Constants'
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import abiERC20 from '../src/abis/ERC20.json'
dotenv.config()

jest.setTimeout(40000)

describe('Deposit and withdraw', () => {
    let chain: Chain
    let walletFromMnemonic: ethers.Wallet
    const tokenAddress = '0x48edc7317A487ACdA0A96E030786875D727cD5e5'

    // if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY is required for this test!')
    // const wallet = ethers.Wallet.createRandom()
    it('Create wallet', () => {
        walletFromMnemonic = ethers.Wallet.fromMnemonic('announce room limb pattern dry unit scale effort smooth jazz weasel alcohol')
        const walletPrivateKey = new ethers.Wallet(walletFromMnemonic.privateKey)
        console.log(walletFromMnemonic, walletPrivateKey);
        console.log(walletFromMnemonic.privateKey, NETWORK_TOKEN_ADDRESS);
    })

    it('Create chain instance and init', async () => {
        chain = new Chain(walletFromMnemonic.privateKey, NETWORK.TEST.BSC)
        await chain.init()
        expect(chain.blockchainInfo).toHaveProperty('chainName')
        expect(chain.signer).toHaveProperty('address')

        const tokenContract = new ethers.Contract(tokenAddress, abiERC20, chain.signer)
        console.log(`Calling token faucet for ${tokenAddress}...`);
        const tokenFaucetTx = await tokenContract.faucet(chain.signer.address, {
            gasPrice: ethers.utils.parseUnits("1", "gwei")
        });
        console.log(`Dispatched faucet call ${tokenFaucetTx.hash} awaiting mine...`);
        const txResult = await tokenFaucetTx.wait();
        console.log(txResult);
    })


    it('Check wallet balance summary', async() => {
        const balance = await chain.getWalletBalance()
        console.log(balance);
        expect(Object.keys(balance).length).toBeTruthy()
    })

})
