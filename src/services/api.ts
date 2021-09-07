import axios, { AxiosInstance } from "axios"

export function getApi (baseUrl: string): {[key: string]: AxiosInstance} {
    return {
        orionBlockchain: axios.create({
            baseURL: `${baseUrl}/api`,
            timeout: 1000
        }),

        orionAggregator: axios.create({
            baseURL: `${baseUrl}/backend/api/v1`,
            timeout: 1000
        })
    }
}
