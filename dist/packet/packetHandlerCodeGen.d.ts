import { MethodDef, OnRecv, RemoteOptions } from '../common/interfaces';
import { writeUint8, writeInt16, writeUint16, writeUint32, writeInt32, writeFloat64, writeFloat32, writeBoolean, writeString, writeArrayBuffer, writeUint8Array, writeInt8, writeArray, writeArrayHeader, writeBytes, resizeWriter, createBinaryWriter, writeBytesRange, writeAny, isSizeError, writeBytesRangeView, BinaryWriter } from './binaryWriter';
import { BinaryReader } from './binaryReader';
import { HandleResult, HandlerOptions, RemoteState, Send } from './packetHandler';
export declare const writerMethods: {
    createWriter: typeof createBinaryWriter;
    resizeWriter: typeof resizeWriter;
    writeUint8: typeof writeUint8;
    writeInt8: typeof writeInt8;
    writeUint16: typeof writeUint16;
    writeInt16: typeof writeInt16;
    writeUint32: typeof writeUint32;
    writeInt32: typeof writeInt32;
    writeFloat32: typeof writeFloat32;
    writeFloat64: typeof writeFloat64;
    writeBoolean: typeof writeBoolean;
    writeString: typeof writeString;
    writeAny: typeof writeAny;
    writeArrayBuffer: typeof writeArrayBuffer;
    writeUint8Array: typeof writeUint8Array;
    writeArrayHeader: typeof writeArrayHeader;
    writeArray: typeof writeArray;
    writeBytes: typeof writeBytes;
    writeBytesRange: typeof writeBytesRange;
    writeBytesRangeView: typeof writeBytesRangeView;
    isSizeError: typeof isSizeError;
};
export interface CodeGenOptions {
    printGeneratedCode?: boolean;
}
interface HandlerOptionsCodeGen extends HandlerOptions, CodeGenOptions {
}
declare type CreateRemoteHandler = (remote: any, send: Send, state: RemoteState, options: RemoteOptions, writerMethods: any, writer: BinaryWriter) => any;
declare type LocalHandler = (reader: BinaryReader, actions: any, specialActions: any, callsList: number[], messageId: number, handleResult?: HandleResult) => void;
export declare function generateLocalHandlerCode(methods: MethodDef[], remoteNames: string[], { debug, printGeneratedCode, useBinaryByDefault, useBinaryResultByDefault }: HandlerOptionsCodeGen, onRecv: OnRecv): LocalHandler;
export declare function generateRemoteHandlerCode(methods: MethodDef[], handlerOptions: HandlerOptionsCodeGen): CreateRemoteHandler;
export {};
