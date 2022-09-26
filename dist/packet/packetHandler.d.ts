import { FuncList, Logger, MethodDef, OnSend, OnRecv } from '../common/interfaces';
import { BinaryReader } from './binaryReader';
export interface Send {
    (data: string | Uint8Array): void;
}
export declare const enum MessageType {
    Version = 255,
    Resolved = 254,
    Rejected = 253
}
export interface FunctionHandler {
    (funcId: number, funcName: string, func: Function, funcObj: any, args: any[]): void;
}
export declare const defaultHandler: FunctionHandler;
export interface RemoteState {
    supportsBinary: boolean;
    sentSize: number;
}
export declare type HandleResult = (funcId: number, funcName: string, result: Promise<any>, messageId: number) => void;
export interface HandlerOptions {
    forceBinary?: boolean;
    forceBinaryPackets?: boolean;
    useBinaryByDefault?: boolean;
    useBuffer?: boolean;
    debug?: boolean;
    development?: boolean;
    onSend?: OnSend;
    onRecv?: OnRecv;
}
export interface PacketHandler {
    sendString(send: Send, name: string, id: number, args: any[]): number;
    createRemote(remote: any, send: Send, state: RemoteState): void;
    recvString(data: string, funcList: FuncList, specialFuncList: FuncList, handleFunction?: FunctionHandler): void;
    recvBinary(actions: any, reader: BinaryReader, callsList: number[], messageId: number, handleResult?: HandleResult): void;
    writerBufferSize(): number;
}
export declare function createPacketHandler(local: MethodDef[] | undefined, remote: MethodDef[] | undefined, options: HandlerOptions, log: Logger): PacketHandler;
