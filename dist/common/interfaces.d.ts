export interface Logger {
    (...args: any[]): void;
}
export interface FuncList {
    [name: string]: Function | undefined;
}
export interface SocketServer {
    [name: string]: any;
    connected?(): void;
    disconnected?(code: number, reason: string): void;
}
export interface SocketClient {
    [name: string]: any;
    connected?(): void;
    disconnected?(code: number, reason: string): void;
    invalidVersion?(expected: string, actual: string): void;
}
export interface SocketService<TClient extends SocketClient, TServer extends SocketServer> {
    client: TClient;
    server: TServer;
    sentSize: number;
    receivedSize: number;
    sentPackets: number;
    receivedPackets: number;
    lastPacket: number;
    isConnected: boolean;
    supportsBinary: boolean;
    options: ClientOptions;
    connect(): void;
    disconnect(): void;
    socket(): WebSocket | null;
}
export declare enum Bin {
    I8 = 0,
    U8 = 1,
    I16 = 2,
    U16 = 3,
    I32 = 4,
    U32 = 5,
    F32 = 6,
    F64 = 7,
    Bool = 8,
    Str = 9,
    Obj = 10,
    Buffer = 11,
    U8Array = 12,
    Raw = 13,
    U8ArrayOffsetLength = 14,
    DataViewOffsetLength = 15
}
export declare type BinaryDef = (Bin | (Bin | (Bin | any[]))[])[];
export declare type MethodDef = string | [string, MethodOptions];
export interface MethodOptions {
    /** binary definition of the packet */
    binary?: BinaryDef;
    /** true if promise handling should be generated on client side */
    promise?: boolean;
    /** name of the field to set to true if there is outstanding promise for this method */
    progress?: string;
    /** true if method should be ignored when logging messages in debug mode */
    ignore?: boolean;
    /** rate limit in format of "1/s" or "10/30s" or "20/m" */
    rateLimit?: string;
    /** rate limit for the server */
    serverRateLimit?: string;
}
export interface MethodMetadata {
    name: string;
    options: MethodOptions;
}
export interface CommonOptions {
    id?: string;
    /** host of websocket endpoint, the same host as the site by default */
    host?: string;
    /** path to websocket endpoint, '/ws' by default */
    path?: string;
    /** true to force SSL websockets on non-SSL website */
    ssl?: boolean;
    /** ping interval in milliseconds, ping disabled if not specified or 0 */
    pingInterval?: number;
    /** delay for client to wait before trying to reconnect in milliseconds */
    reconnectTimeout?: number;
    /** log debug information to console */
    debug?: boolean;
    /** log additional errors to console */
    development?: boolean;
    /** version hash */
    hash?: string;
    /** custom request parameters */
    requestParams?: any;
    /** first ID to assign to client */
    clientBaseId?: number;
    /** always send copy of buffer on client side */
    copySendBuffer?: boolean;
    useBinaryByDefault?: boolean;
}
export declare type OnSend = (id: number, name: string, size: number, binary: boolean) => void;
export declare type OnRecv = (id: number, name: string, size: number, binary: boolean, data?: DataView, actions?: any) => void;
export interface Packet {
    id: number;
    name: string;
    args: any[];
    binary?: Uint8Array;
    json?: string;
}
export interface ClientOptions extends CommonOptions {
    client: MethodDef[];
    server: MethodDef[];
    tokenLifetime?: number;
}
export interface RemoteOptions {
    log?: Logger;
    onSend?: OnSend;
    onRecv?: OnRecv;
}
export declare function getNames(methods: MethodDef[]): string[];
export declare function getMethodsDefArray(methods: MethodDef[]): [string, MethodOptions][];
export declare function getIgnore(methods: MethodDef[]): string[];
export interface RateLimitDef {
    promise: boolean;
    limit: number;
    frame: number;
}
export interface RateLimit {
    limit: number;
    frame: number;
    calls: number[];
    promise?: boolean;
}
export declare type RateLimits = (RateLimit | undefined)[];
