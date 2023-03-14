import { FuncList, Logger, MethodDef, OnSend, OnRecv, RemoteOptions } from '../common/interfaces';
import { BinaryWriter } from './binaryWriter';
import { BinaryReader } from './binaryReader';
export declare function readBytesRaw(reader: BinaryReader): Uint8Array;
export interface Send {
    (data: string | Uint8Array): void;
}
export declare const enum MessageType {
    Version = 255,
    Resolved = 254,
    Rejected = 253,
    Error = 252
}
export interface FunctionHandler {
    (funcId: number, funcName: string, func: Function, funcObj: any, args: any[]): void;
}
export declare const defaultHandler: FunctionHandler;
export interface RemoteState {
    supportsBinary: boolean;
    sentSize: number;
}
export declare type HandleResult = (funcId: number, funcName: string, funcBinary: boolean, result: Promise<any>, messageId: number) => void;
export interface HandlerOptions {
    forceBinary?: boolean;
    forceBinaryPackets?: boolean;
    useBinaryByDefault?: boolean;
    useBuffer?: boolean;
    debug?: boolean;
    development?: boolean;
    useBinaryResultByDefault?: boolean;
    onSend?: OnSend;
    onRecv?: OnRecv;
}
export declare type CreateRemoteHandler = (remote: any, send: Send, state: RemoteState, options: RemoteOptions, writer: BinaryWriter) => any;
export interface PacketHandler {
    sendString(send: Send, name: string, id: number, funcId: number, messageId: number, result: any): number;
    sendBinary(send: Send, name: string, id: number, funcId: number, messageId: number, result: any): number;
    createRemote(remote: any, send: Send, state: RemoteState): void;
    recvString(data: string, funcList: FuncList, specialFuncList: FuncList, handleFunction?: FunctionHandler): void;
    recvBinary(reader: BinaryReader, funcList: FuncList, specialFuncList: FuncList, callsList: number[], messageId: number, handleResult?: HandleResult): void;
    writerBufferSize(): number;
}
export interface CustomPacketHandlers {
    createRemoteHandler: (methodsDef: MethodDef[], handlerOptions: HandlerOptions) => CreateRemoteHandler;
    createLocalHandler: (methodsDef: MethodDef[], remoteNames: string[], onRecv: OnRecv, useBinaryResultByDefault?: boolean) => PacketHandler['recvBinary'];
}
export declare function createPacketHandler(local: MethodDef[] | undefined, remote: MethodDef[] | undefined, options: HandlerOptions, log: Logger, customHandlers?: CustomPacketHandlers): PacketHandler;
