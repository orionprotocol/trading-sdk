import { signTypedMessage } from 'eth-sig-util'
import {ethers} from "ethers"
import { BlockchainOrder, CancelOrderRequest, CancelOrderRequestV2, DomainData} from "../utils/Models"
import { DOMAIN_TYPE, ORDER_TYPES, CANCEL_ORDER_TYPES_V2 } from '../utils/Constants'

function getDomainData(chainId: number): DomainData {
    return {
        name: "Orion Exchange",
        version: "1",
        chainId: chainId,
        salt: "0xf2d857f4a3edcb9b78b4d503bfe733db1e3f6cdc2b7971ee739626c97e86a557",
    };
}

export async function signCancelOrder(cancelOrderRequest: CancelOrderRequest | CancelOrderRequestV2, signer: ethers.Wallet, chainId: number): Promise<string> {
    if (signer.privateKey) {

        const data = {
            types: {
                EIP712Domain: DOMAIN_TYPE,
                DeleteOrder: CANCEL_ORDER_TYPES_V2.DeleteOrder,
            },
            domain: getDomainData(chainId),
            primaryType: 'DeleteOrder',
            message: cancelOrderRequest,
        };

        const msgParams = {data};
        const bufferKey = Buffer.from(signer.privateKey.substr(2), 'hex');
        return signTypedMessage(bufferKey, msgParams as any, 'V4');
    } else {
        throw new Error('privateKey is required!')
    }
}

export async function signOrder(order: BlockchainOrder, signer: ethers.Wallet, chainId: number): Promise<string> {

    if (signer.privateKey) {
        const data = {
            types: {
                EIP712Domain: DOMAIN_TYPE,
                Order: ORDER_TYPES.Order,
            },
            domain: getDomainData(chainId),
            primaryType: 'Order',
            message: order,
        };

        const msgParams = {data};
        const bufferKey = Buffer.from((signer).privateKey.substr(2), 'hex');
        return signTypedMessage(bufferKey, msgParams as any, 'V4');
    } else {
        throw new Error('privateKey is required!')
    }
}

export function hashOrder(order: BlockchainOrder): string {
    return ethers.utils.solidityKeccak256(
        [
            'uint8',
            'address',
            'address',
            'address',
            'address',
            'address',
            'uint64',
            'uint64',
            'uint64',
            'uint64',
            'uint64',
            'uint8',
        ],
        [
            "0x03",
            order.senderAddress,
            order.matcherAddress,
            order.baseAsset,
            order.quoteAsset,
            order.matcherFeeAsset,
            order.amount,
            order.price,
            order.matcherFee,
            order.nonce,
            order.expiration,
            order.buySide ? '0x01' : '0x00'
        ]
    )
}
