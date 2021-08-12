import { ChainApi } from '../src/services/ChainApi'

const BSC_RPC_URL = 'https://data-seed-prebsc-2-s1.binance.org:8545/'
const BSC_ORION_BLOCKCHAIN = 'https://dev-exp.orionprotocol.io'

describe('Api connect', () => {
    it('Create instatnce and init', async () => {
        const provider = new ChainApi(BSC_RPC_URL, BSC_ORION_BLOCKCHAIN)
        await provider.init()
    })
})
