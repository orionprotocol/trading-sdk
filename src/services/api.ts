import axios, { AxiosInstance } from "axios"

export class Api {
    public readonly blockchain: AxiosInstance
    public readonly aggregator: AxiosInstance

    constructor (baseUrl: string) {
        this.blockchain = axios.create({
            baseURL: `${baseUrl}/api`,
            timeout: 1000
        });

        this.aggregator = axios.create({
            baseURL: `${baseUrl}/backend/api/v1`,
            timeout: 1000
        });

    }

}
