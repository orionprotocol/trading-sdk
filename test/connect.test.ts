import 'jest-extended'
import { Chain, OrionAggregator } from '../src/index'
import { NETWORK, TEST_WALLET } from '../src/utils/Constants'
import { ethers } from 'ethers';

jest.setTimeout(40000)

describe('Connection and initializing', () => {
    let chain: Chain
    const walletFromMnemonic = ethers.Wallet.fromMnemonic(TEST_WALLET.mnemonicPhrase)

    it('Create chain instance and init', async () => {
        chain = new Chain(walletFromMnemonic.privateKey, NETWORK.MAIN.BSC)
        await chain.init()
        expect(chain).toHaveProperty('tokensFee')
        expect(chain).toHaveProperty('tokens')
        expect(chain.blockchainInfo).toHaveProperty('chainName')
        expect(chain.signer).toHaveProperty('address')
    })

    it('Create orionAggregator instance and init', async () => {
        const orionAggregator = new OrionAggregator(chain)
        expect(orionAggregator).toHaveProperty('chain')
    })

})
