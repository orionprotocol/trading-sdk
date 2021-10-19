import BigNumber from "bignumber.js";
import { TxType } from "./Models";

export const NETWORK = {
    TEST: {
        BSC: {
            RPC: 'https://data-seed-prebsc-2-s1.binance.org:8545',
            ORION: 'https://dev-exp.orionprotocol.io',
            CHAIN_ID: 97,
            TX_TIMEOUT_SEC: 60
        },
        BSCV2: {
            RPC: 'https://data-seed-prebsc-2-s1.binance.org:8545',
            ORION: 'https://dn-bsc.orionprotocol.io',
            CHAIN_ID: 97,
            TX_TIMEOUT_SEC: 60
        },
        ETH: {
            RPC: 'https://staging.orionprotocol.io/rpc',
            ORION: 'https://staging.orionprotocol.io',
            CHAIN_ID: 3,
            TX_TIMEOUT_SEC: 60
        }
    },
    MAIN: {
        BSC: {
            RPC: 'https://bsc-dataseed.binance.org',
            ORION: 'https://trade-exp.orionprotocol.io',
            CHAIN_ID: 56,
            TX_TIMEOUT_SEC: 120
        },
        ETH: {
            RPC: 'https://trade.orionprotocol.io/rpc',
            ORION: 'https://trade.orionprotocol.io',
            CHAIN_ID: 1,
            TX_TIMEOUT_SEC: 120
        }
    }
}

export const ORION_WS = {
    TEST: {
        BSC: 'wss://dev-exp.orionprotocol.io',
        BSCV2: 'wss://dn-bsc.orionprotocol.io',
        ETH: 'wss://staging.orionprotocol.io',
    },
    MAIN: {
        BSC: 'wss://trade-exp.orionprotocol.io',
        ETH: 'wss://trade.orionprotocol.io',
    }
}

export const MATCHER_FEE_PERCENT: BigNumber = new BigNumber(0.2).dividedBy(100); // 0.2%

export const SWAP_THROUGH_ORION_POOL_GAS_LIMIT = 350000;

export const FILL_ORDERS_AND_WITHDRAW_GAS_LIMIT = 385000;

export const FILL_ORDERS_GAS_LIMIT = 220000;

export const DEPOSIT_ETH_GAS_LIMIT = 220000;

export const DEPOSIT_ERC20_GAS_LIMIT = 220000;

export const APPROVE_ERC20_GAS_LIMIT = 70000;

export const DEFAULT_EXPIRATION: number = 29 * 24 * 60 * 60 * 1000; // 29 days

export const FEE_CURRENCY = 'ORN'

export const ORDER_TYPES = {
    Order: [
        {name: "senderAddress", type: "address"},
        {name: "matcherAddress", type: "address"},
        {name: "baseAsset", type: "address"},
        {name: "quoteAsset", type: "address"},
        {name: "matcherFeeAsset", type: "address"},
        {name: "amount", type: "uint64"},
        {name: "price", type: "uint64"},
        {name: "matcherFee", type: "uint64"},
        {name: "nonce", type: "uint64"},
        {name: "expiration", type: "uint64"},
        {name: "buySide", type: "uint8"},
    ],
}

export const CANCEL_ORDER_TYPES_V2 = {
    DeleteOrder: [
        {name: "sender", type: "address"},
        {name: "id", type: "string"},
    ],
};

export const CANCEL_ORDER_TYPES = {
    DeleteOrder: [
        {name: "senderAddress", type: "address"},
        {name: "id", type: "uint64"},
    ],
};

export const DOMAIN_TYPE = [
    {name: "name", type: "string"},
    {name: "version", type: "string"},
    {name: "chainId", type: "uint256"},
    {name: "salt", type: "bytes32"},
]

export const ORDER_STATUSES = [
    "NEW",
    "ACCEPTED",
    "DIRECT_SWAP_PENDING",
    "ROUTING",
    "PARTIALLY_FILLED",
    "FILLED",
    "TX_PENDING",
    "REJECTED",
    "SETTLED",
    "CANCELED",
    "FAILED"
]

export const NETWORK_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'

export const PRICE_DEVIATIONS = {
    MIN: 0,
    MAX: 50
}

export const EXCHANGE_ORDER_PRECISION = 8

export const CHAIN_TX_TYPES: Record<string, TxType> = {
    approve: {
        code: 1,
        name: 'APPROVE'
    },
    deposit: {
        code: 2,
        name: 'DEPOSIT'
    },
    withdraw: {
        code: 3,
        name: 'WITHDRAW'
    },
}

export const TEST_WALLET = {
    mnemonicPhrase: 'announce room limb pattern dry unit scale effort smooth jazz weasel alcohol'
}
