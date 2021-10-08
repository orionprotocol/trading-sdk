import { TxType } from './Models'

export class TxError extends Error {
    public txHash: string
    public txCode: number
    public txName: string

    constructor(txHash: string, type: TxType, message: string) {
        super(message)
        this.txHash = txHash
        this.txCode = type.code
        this.txName = type.name
        this.name = 'Transaction error'
    }
}
