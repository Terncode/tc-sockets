export interface BinaryReader {
    view: DataView;
    offset: number;
}
export declare function createBinaryReader(buffer: Uint8Array): BinaryReader;
export declare function createBinaryReaderFromBuffer(buffer: ArrayBuffer, byteOffset: number, byteLength: number): BinaryReader;
export declare function getBinaryReaderBuffer(reader: BinaryReader): Uint8Array;
export declare function readInt8(reader: BinaryReader): number;
export declare function readUint8(reader: BinaryReader): number;
export declare function readInt16(reader: BinaryReader): number;
export declare function readUint16(reader: BinaryReader): number;
export declare function readInt32(reader: BinaryReader): number;
export declare function readUint32(reader: BinaryReader): number;
export declare function readFloat32(reader: BinaryReader): number;
export declare function readFloat64(reader: BinaryReader): number;
export declare function readBytes(reader: BinaryReader, length: number): Uint8Array;
export declare function readArrayBuffer(reader: BinaryReader): ArrayBuffer | null;
export declare function readBoolean(reader: BinaryReader): boolean;
export declare function readArray<T>(reader: BinaryReader, readOne: (reader: BinaryReader) => T): T[] | null;
export declare function readString(reader: BinaryReader): string | null;
export declare function readObject(reader: BinaryReader, cloneTypedArrays?: boolean): any;
export declare function readLength(reader: BinaryReader): number;
export declare function readUint8Array(reader: BinaryReader): Uint8Array | null;
export declare function readAny(reader: BinaryReader, strings: string[], cloneTypedArrays: boolean): any;
