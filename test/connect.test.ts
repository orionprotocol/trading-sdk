import { ChainApi } from '../src/services/ChainApi'

const BSC_RPC_URL = 'https://data-seed-prebsc-2-s1.binance.org:8545/'
const BSC_ORION_BLOCKCHAIN = 'https://dev-exp.orionprotocol.io'

describe('Api connect', () => {
    it('Create instance and init', async () => {
        const api = new ChainApi(BSC_RPC_URL, BSC_ORION_BLOCKCHAIN)
        await api.init()
    })
})
