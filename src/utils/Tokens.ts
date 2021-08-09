import {Dictionary} from "./Models";

export class Tokens {
    readonly nameToAddress: Dictionary<string>;

    constructor(nameToAddress: Dictionary<string>) {
        this.nameToAddress = {};
        for (const key in nameToAddress) {
            if (nameToAddress.hasOwnProperty(key)) {
                this.nameToAddress[key] = nameToAddress[key].toLowerCase();
            }
        }
    }

    addressToName(address: string): (string | undefined) {
        for (const name in this.nameToAddress) {
            if (this.nameToAddress.hasOwnProperty(name)) {
                if (this.nameToAddress[name] === address.toLowerCase()) return name;
            }
        }
        return undefined;
    }

    addressToNameSafe(address: string): string {
        const name = this.addressToName(address);
        if (name === undefined) throw new Error('no token name for ' + address);
        return name;
    }

    nameToAddressSafe(name: string): string {
        const address = this.nameToAddress[name];
        if (!address) throw new Error('no address for ' + name);
        return address;
    }

    addressesToSymbol(baseAsset: string, quoteAsset: string): (string | undefined) {
        const base = this.addressToName(baseAsset);
        if (!base) return undefined;
        const quote = this.addressToName(quoteAsset);
        if (!quote) return undefined;
        return base + '-' + quote;
    }

    addressesToSymbolSafe(baseAsset: string, quoteAsset: string): string {
        const symbol = this.addressesToSymbol(baseAsset, quoteAsset);
        if (symbol === undefined) throw new Error('no symbol name for ' + baseAsset + ', ' + quoteAsset);
        return symbol;
    }

    symbolToAddresses(symbol: string): (string[] | undefined) {
        const arr = symbol.split('-');
        if (arr.length !== 2) return undefined;
        const base = this.nameToAddress[arr[0]];
        if (!base) return undefined;
        const quote = this.nameToAddress[arr[1]];
        if (!quote) return undefined;
        return [base, quote];
    }
}

