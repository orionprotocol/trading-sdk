import 'jest-extended'
import { Chain, OrionAggregator } from '../src/index'
import { NETWORK, TEST_WALLET } from '../src/utils/Constants'
import { ethers } from 'ethers';

jest.setTimeout(40000)

describe.skip('Connecting, creating instances', () => {
    let chain: Chain
    const walletFromMnemonic = ethers.Wallet.fromMnemonic(TEST_WALLET.mnemonicPhrase)

    it('Create chain instance and init', async () => {
        chain = new Chain(walletFromMnemonic.privateKey, NETWORK.TEST.BSC)
        await chain.init()
        expect(chain).toHaveProperty('tokensFee')
        expect(chain).toHaveProperty('tokens')
        expect(chain.blockchainInfo).toHaveProperty('chainName')
        expect(chain.signer).toHaveProperty('address')
    })

    it('Create orionAggregator instance and init', async () => {
        const orionAggregator = new OrionAggregator(chain)
        await orionAggregator.init()
        expect(orionAggregator).toHaveProperty('chain')
        expect(orionAggregator).toHaveProperty('pairs')
        expect(orionAggregator).toHaveProperty('version')
    })

})
