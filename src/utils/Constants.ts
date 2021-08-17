import BigNumber from "bignumber.js";

export const MATCHER_FEE_PERCENT: BigNumber = new BigNumber(0.2).dividedBy(100); // 0.2%

export const SWAP_THROUGH_ORION_POOL_GAS_LIMIT = 350000;

export const FILL_ORDERS_AND_WITHDRAW_GAS_LIMIT = 385000;

export const FILL_ORDERS_GAS_LIMIT = 220000;

export const DEPOSIT_ETH_GAS_LIMIT = 220000;

export const DEPOSIT_ERC20_GAS_LIMIT = 220000;

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

export const DOMAIN_TYPE = [
    {name: "name", type: "string"},
    {name: "version", type: "string"},
    {name: "chainId", type: "uint256"},
    {name: "salt", type: "bytes32"},
]
