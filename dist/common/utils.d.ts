import { MethodDef, BinaryDef, Bin, RateLimitDef } from './interfaces';
export declare function getLength(message: any): number;
export declare function queryString(params: any): string;
export declare function cloneDeep<T>(value: T): T;
export declare function parseRateLimit(value: string, extended: boolean): {
    limit: number;
    frame: number;
};
export declare function checkRateLimit3(funcId: number, callsList: number[], limit: number, frame: number): boolean;
export declare function checkRateLimit2(funcId: number, callsList: number[], rates: (RateLimitDef | undefined)[]): boolean;
export declare function supportsBinary(): boolean;
export interface Deferred<T> {
    promise: Promise<T>;
    resolve(result: T): void;
    reject(error?: Error): void;
}
export declare function deferred<T>(): Deferred<T>;
export declare function isBinaryOnlyPacket(method: MethodDef): boolean | undefined;
export declare function hasArrayBuffer(def: BinaryDef | Bin): boolean;
