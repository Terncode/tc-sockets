import { FuncList, Logger, getNames, getIgnore, MethodDef, OnSend, OnRecv, Bin, RemoteOptions, getMethodsDefArray } from '../common/interfaces';
import { isBinaryOnlyPacket, parseRateLimit, checkRateLimit3 } from '../common/utils';
import {
	writeUint8, writeInt16, writeUint16, writeUint32, writeInt32, writeFloat64, writeFloat32, writeBoolean,
	writeString, writeArrayBuffer, writeUint8Array, writeInt8, writeArrayHeader,
	writeBytes, resizeWriter, createBinaryWriter, writeBytesRange, writeAny, BinaryWriter, isSizeError, writeBytesRangeView,
} from './binaryWriter';
import {
	readInt8, readUint8, readUint16, readInt16, readUint32, readInt32, readFloat32, readFloat64, readBoolean,
	readString, readArrayBuffer, readUint8Array, readArray, readBytes, BinaryReader, readAny,//, readLength
	readLength
} from './binaryReader';

const noop = () => {};

interface Allocator {
	allocate: number;
}

interface AllocatorFunction extends Allocator {
	(...args: any): any;
}

export function readBytesRaw(reader: BinaryReader) {
	const length = reader.view.byteLength - (reader.view.byteOffset + reader.offset);
	return readBytes(reader, length);
}

function createWriteBytesRange() {
	const argumentBuilder: (Uint8Array | number)[] = [];
	const writeBytesRangeHandler = function (writer: BinaryWriter, arg: Uint8Array | number) {
		argumentBuilder.push(arg);
		if (argumentBuilder.length === 3) {
			writeBytesRange(writer, argumentBuilder[0] as Uint8Array, argumentBuilder[1] as number, argumentBuilder[2] as number);
			argumentBuilder.length = 0;
		}
	};
	writeBytesRangeHandler.reset = () => {
		argumentBuilder.length = 0;
	};
	return writeBytesRangeHandler;
}
createWriteBytesRange.allocate = 3;

function createReadBytesRange() {
	let step = 0;
	let array: Uint8Array | null = null;
	const readBytesRangeViewHandler = function (reader: BinaryReader) {
		switch (step++) {
			case 0:
				array = readUint8Array(reader);
				return array;
			case 1:
				return 0;
			case 2:
				const result = array ? array.byteLength : 0;
				return result;
			default:
				return null;noop;
		}
	};
	readBytesRangeViewHandler.reset = () => {
		step = 0;
		array = null;
	};

	return readBytesRangeViewHandler;
}
createReadBytesRange.allocate = 3;

function createWriteBytesRangeView() {
	const argumentBuilder: (DataView | number)[] = [];
	const writeBytesRangeViewHandler = function (writer: BinaryWriter, arg:  DataView | number) {
		argumentBuilder.push(arg);
		if (argumentBuilder.length === 3) {
			writeBytesRangeView(writer, argumentBuilder[0] as  DataView, argumentBuilder[1] as number, argumentBuilder[2] as number);
			argumentBuilder.length = 0;
		}
	};
	writeBytesRangeViewHandler.reset = () => {
		argumentBuilder.length = 0;
	};
	return writeBytesRangeViewHandler;
}
createWriteBytesRangeView.allocate = 3;

function createReadBytesRangeView() {
	let step = 0;
	let view: (DataView | null) = null;
	let offset = 0;
	let length = 0;

	const readBytesRangeViewHandler = function (reader: BinaryReader) {
		switch (step++) {
			case 0:
				const lengthRead = readLength(reader);
				if (lengthRead !== -1) {
					view = reader.view;
					offset = reader.offset;
					length = lengthRead;
					reader.offset += lengthRead;
				}
				return view;
			case 1:
				return offset;
			case 2:
				return length;
			default:
				return null;
		}
	};
	readBytesRangeViewHandler.reset = () => {
		view = null;
		offset = 0;
		length = 0;
		step = 0;
	};

	return readBytesRangeViewHandler;
}
createReadBytesRangeView.allocate = 3;

type ReaderFunction = (reader: BinaryReader, strings: string[], cloneTypedArrays: boolean) => any;
type WriterFunction = (writer: BinaryWriter, value: any, strings: Map<string, number>) => void;

const readerMethodsMapping: {[key : string]: ReaderFunction} = {
	[Bin.I8]: readInt8,
	[Bin.U8]: readUint8,
	[Bin.I16]: readInt16,
	[Bin.U16]: readUint16,
	[Bin.I32]: readInt32,
	[Bin.U32]: readUint32,
	[Bin.F32]: readFloat32,
	[Bin.F64]: readFloat64,
	[Bin.Bool]: readBoolean,
	[Bin.Str]: readString,
	[Bin.Obj]: readAny,
	[Bin.Buffer]: readArrayBuffer,
	[Bin.U8Array]: readUint8Array,
	[Bin.Raw]: readBytesRaw,
	[Bin.U8ArrayOffsetLength]: createReadBytesRange,
	[Bin.DataViewOffsetLength]: createReadBytesRangeView,
};


const writerMethodsMapping: {[key in Bin]: WriterFunction} = {
	[Bin.I8]: writeInt8,
	[Bin.U8]: writeUint8,
	[Bin.I16]: writeInt16,
	[Bin.U16]: writeUint16,
	[Bin.I32]: writeInt32,
	[Bin.U32]: writeUint32,
	[Bin.F32]: writeFloat32,
	[Bin.F64]: writeFloat64,
	[Bin.Bool]: writeBoolean,
	[Bin.Str]: writeString,
	[Bin.Obj]: writeAny,
	[Bin.Buffer]: writeArrayBuffer,
	[Bin.U8Array]: writeUint8Array,
	[Bin.Raw]: writeBytes,
	[Bin.U8ArrayOffsetLength]: createWriteBytesRange,
	[Bin.DataViewOffsetLength]: createWriteBytesRangeView,
};

export interface Send {
	(data: string | Uint8Array): void; // or Buffer
}

export const enum MessageType {
	Version = 255,
	Resolved = 254,
	Rejected = 253,
	Error = 252,
}

export interface FunctionHandler {
	(funcId: number, funcName: string, func: Function, funcObj: any, args: any[]): void;
}

export const defaultHandler: FunctionHandler =
	(_funcId, _funcName, func, funcObj, args) => func.apply(funcObj, args);

export interface RemoteState {
	supportsBinary: boolean;
	sentSize: number;
}

export type HandleResult = (funcId: number, funcName: string, funcBinary: boolean, result: Promise<any>, messageId: number) => void;

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

export type CreateRemoteHandler = (
	remote: any, send: Send, state: RemoteState, options: RemoteOptions, writer: BinaryWriter,
) => any;

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

export function createPacketHandler(
	local: MethodDef[] | undefined, remote: MethodDef[] | undefined, options: HandlerOptions, log: Logger, customHandlers?: CustomPacketHandlers
): PacketHandler {
	if (!local || !remote) throw new Error('Missing server or client method definitions');
	if (local.length > 250 || remote.length > 250) throw new Error('Too many methods');

	const debug = !!options.debug;
	const forceBinaryPackets = !!options.forceBinaryPackets;
	const development = !!options.development;
	const onSend = options.onSend;
	const onRecv = options.onRecv ?? (() => { });

	const remoteNames = getNames(remote);
	const localNames = getNames(local);
	const localWithBinary = new Set(local
		.map(x => typeof x === 'string' ? { name: x, binary: false } : { name: x[0], binary: !!x[1].binary })
		.filter(x => x.binary)
		.map(x => x.name));
	const ignorePackets = new Set([...getIgnore(remote), ...getIgnore(local)]);
	const createLocalHandlerFn = customHandlers?.createLocalHandler || createLocalHandler;
	const recvBinary = createLocalHandlerFn(local, remoteNames, onRecv, options.useBinaryByDefault);

	const createCreateRemoteHandlerFn = customHandlers?.createRemoteHandler || createCreateRemoteHandler;
	const createRemoteHandler = createCreateRemoteHandlerFn(remote, options);
	const writer = createBinaryWriter();
	const strings = new Map();

	function sendString(send: Send, name: string, id: number, funcId: number, messageId: number, result: any): number {
		try {
			const data = JSON.stringify([id, funcId, messageId, result]);
			send(data);

			if (debug && ignorePackets.has(name)) {
				log(`SEND [${data.length}] (str)`, name, [id, funcId, messageId, result]);
			}

			onSend?.(id, name, data.length, false);
			return data.length;
		} catch (e) {
			if (debug || development) throw e;
			return 0;
		}
	}

	function sendBinary(send: Send, name: string, id: number, funcId: number, messageId: number, result: any): number {
		while (true) {
			try {
				strings.clear();
				writer.offset = 0;
				writeUint8(writer, id);
				writeUint8(writer, funcId);
				writeUint32(writer, messageId);
				writeAny(writer, result, strings);

				const data = options.useBuffer ?
					Buffer.from(writer.view.buffer, writer.view.byteOffset, writer.offset) :
					new Uint8Array(writer.view.buffer, writer.view.byteOffset, writer.offset);

				send(data);

				if (debug && !ignorePackets.has(name)) {
					log(`SEND [${data.length}] (bin)`, name, [id, funcId, messageId, result]);
				}

				if (onSend) onSend(id, name, data.length, true);
				return data.length;
			} catch (e) {
				if (isSizeError(e)) {
					resizeWriter(writer);
				} else {
					if (debug || development) throw e;
					return 0;
				}
			}
		}
	}

	function createRemote(remote: any, send: Send, state: RemoteState) {
		createRemoteHandler(remote, send, state, options, writer);
	}

	function recvString(data: string, funcList: FuncList, specialFuncList: FuncList, handleFunction = defaultHandler) {
		const args = JSON.parse(data) as any[];
		const funcId = args.shift() | 0;
		let funcName: string | undefined;
		let funcSpecial = false;

		if (funcId === MessageType.Version) {
			funcName = '*version';
			args.shift(); // skip funcId
			args.shift(); // skip messageId
			funcSpecial = true;
		} else if (funcId === MessageType.Error) {
			funcName = '*error';
			args.shift(); // skip funcId
			args.shift(); // skip messageId
			funcSpecial = true;
		} else if (funcId === MessageType.Rejected) {
			funcName = '*reject:' + remoteNames[args.shift() | 0];
			funcSpecial = true;
		} else if (funcId === MessageType.Resolved) {
			funcName = '*resolve:' + remoteNames[args.shift() | 0];
			funcSpecial = true;
		} else {
			funcName = localNames[funcId];
		}

		const funcObj = funcSpecial ? specialFuncList : funcList;
		const func = funcObj[funcName];

		if (debug && !ignorePackets.has(funcName)) {
			log(`RECV [${data.length}] (str)`, funcName, args);
		}

		if (forceBinaryPackets && localWithBinary.has(funcName)) {
			throw new Error(`Invalid non-binary packet (${funcName})`);
		}

		if (func) {
			handleFunction(funcId, funcName, func, funcObj, args);
		} else {
			if (debug) log(`invalid message: ${funcName}`, args);
			if (development) throw new Error(`Invalid packet (${funcName})`);
		}

		onRecv(funcId, funcName, data.length, false, undefined, funcList);
	}

	function writerBufferSize() {
		return writer.view.byteLength;
	}

	return { sendString, createRemote, recvString, recvBinary, writerBufferSize, sendBinary };
}
type ResetFunction = () => void;

type RateLimitChecker = (packetId: number, callsList: number[], messageId: number, handleResult?: HandleResult) => void
interface LocalHandlerDef {
	name: string;
	promise: boolean;
	decoders?: ReaderFunction[];
	binaryResult: boolean,
	checkRateLimit: RateLimitChecker;
	reset: ResetFunction;
}

function createBinReadFnField(bin: Bin | any[]): ReaderFunction {
	if (Array.isArray(bin)) {
		if(bin.length === 1) {
			const readerFunction = createBinReadFnField(bin[0]);

			const readArrayOneInner: ReaderFunction = function (reader, strings, cloneTypedArrays) {
				return readArray(reader, fnReader => readerFunction(fnReader, strings, cloneTypedArrays));
			};
			// (readArrayOneInner as any).debug = readerFunction;
			return readArrayOneInner;
		} else {
			const readerFunctions = bin.map(createBinReadFnField);
			const len = readerFunctions.length;
			const readArrayInner: ReaderFunction = function (reader, strings, cloneTypedArrays) {
				const value = readArray(reader, fnReader => {
					const result: any[] = [];
					for (let i = 0; i < len; i++) {
						result.push(readerFunctions[i](fnReader, strings, cloneTypedArrays));
					}
					return result;
				});

				return value;
			};
			// (readArrayInner as any).debug = readerFunctions;
			return readArrayInner;
		}

	} else {
		return readerMethodsMapping[bin];
	}
}


function createLocalHandler(methodsDef: MethodDef[], remoteNames: string[], onRecv: OnRecv, useBinaryResultByDefault = false) {
	//recvBinary(reader: BinaryReader, funcList: FuncList, specialFuncList: FuncList, callsList: number[], messageId: number, handleResult?: HandleResult): void;

	const methodsHandler: (LocalHandlerDef | undefined)[] = [];
	const methods = getMethodsDefArray(methodsDef);
	for (let i = 0; i < methods.length; i++) {
		const name = methods[i][0];
		const options = methods[i][1];
		const binaryResult = options.binaryResult || useBinaryResultByDefault;
		let checkRateLimit: RateLimitChecker = () => {};
		if (options.rateLimit || options.serverRateLimit) {
			const { limit, frame } = options.serverRateLimit ? parseRateLimit(options.serverRateLimit, false) : parseRateLimit(options.rateLimit!, true);
			checkRateLimit = (packetId, callsList, messageId, handleResult) => {
				if (!checkRateLimit3(packetId, callsList, limit, frame)) {
					if (handleResult && options.promise) {
						handleResult(packetId, name, binaryResult, Promise.reject(new Error('Rate limit exceeded')), messageId);
					} else {
						throw new Error(`Rate limit exceeded (${name})`);
					}
				}
			};
		}
		if (options.binary) {
			const decoders: LocalHandlerDef['decoders'] = [];
			const reseters: ResetFunction[] = [];
			const handlers =  flattenArgs(options.binary.map(createBinReadFnField), reseters);
			for (const handler of handlers) {
				decoders.push(handler);
			}
			methodsHandler.push({
				name,
				decoders,
				promise: !!options.promise,
				checkRateLimit,
				binaryResult,
				reset: reseters.length ? () => reseters.forEach(f => f()) : noop
			});
		} else {
			methodsHandler.push({
				name,
				promise: !!options.promise,
				checkRateLimit,
				binaryResult,
				reset: noop
			});
		}
	}

	const strings: string[] = [];
	const localHandler: PacketHandler['recvBinary'] = (reader: BinaryReader, funcList: FuncList, specialFuncList: FuncList, callsList: number[], messageId: number, handleResult?: HandleResult) => {
		strings.length = 0;
		reader.offset = 0;
		const packetId = readUint8(reader);
		switch (packetId) {
			case MessageType.Version:
			case MessageType.Error:
			case MessageType.Resolved:
			case MessageType.Rejected: {
				const funcId = readUint8(reader);
				const messageId = readUint32(reader);
				const result = readAny(reader, strings, false);
				if (packetId === MessageType.Version) {
					specialFuncList!['*version']!(result);
				} else if (packetId === MessageType.Error) {
					specialFuncList!['*error']!(result);
				} else if (packetId === MessageType.Resolved) {
					specialFuncList![`*resolve:${remoteNames[funcId]}`]!(messageId, result);
				} else if (packetId === MessageType.Rejected) {
					specialFuncList![`*reject:${remoteNames[funcId]}`]!(messageId, result);
				} else {
				  throw new Error('Missing handling for packet ID: ' + packetId); // ureachable?
				}
				break;
			}
			default: {
				const def = methodsHandler[packetId]!;
				if (def && def.decoders) {
					const args: any[] = [];
					def.checkRateLimit(packetId, callsList, packetId, handleResult);
					def.reset();
					onRecv(packetId, def.name, reader.view.byteLength, true, reader.view, funcList);
					for (let i = 0; i < def.decoders.length; i++) {
						args.push(def.decoders[i](reader, strings as any, false));
					}

					const result = funcList![def.name]!(...args);
					if (def.promise && handleResult) {
						handleResult(packetId, def.name, def.binaryResult,result, messageId);
					}
				} else {
					throw new Error(`Missing binary decoder for: ${def.name} (${packetId})`);
				}
			}
		}
	};
	// (localHandler as any).debug = methodsHandler
	return localHandler;
}
function createBinWriteField(bin: Bin | any[]): WriterFunction {
	if (Array.isArray(bin)) {
		if (bin.length === 1) {
			const arrayWriter = createBinWriteField(bin[0]);
			const writeArrayOneInner: WriterFunction = function (writer, value: any[], strings) {
				if (writeArrayHeader(writer, value)) {
					for (let i = 0; i < value.length; i++) {
						arrayWriter(writer, value[i], strings);
					}
				}
			};
			// (writeArrayOneInner as any).debug = arrayWriter;
			return writeArrayOneInner;
		} else {
			const arrayWriters = bin.map(createBinWriteField);
			const writeArrayInner: WriterFunction = function (writer, value: any[], strings) {
				if (writeArrayHeader(writer, value)) {
					for (let i = 0; i < value.length; i++) {
						for (let j = 0; j < value[i].length; j++) {
							arrayWriters[j](writer, value[i][j], strings);
						}
					}
				}
			};
			// (writeArrayInner as any).debug = arrayWriters;
			return writeArrayInner;
		}
	} else {
		return writerMethodsMapping[bin];
	}
}

function flattenArgs<T extends AllocatorFunction | {}>(AllocateFnOrOther: (T | AllocatorFunction)[], reseters: ResetFunction[]) {
	const argsWriter: T[] = [];
	for (const afor of AllocateFnOrOther) {
		if ('allocate' in afor) {
			const writer = afor();
			for (let j = 0; j < afor.allocate; j++) {
				argsWriter.push(writer);
			}
			if (writer.reset) {
				reseters.push(writer.reset);
			}
		} else {
			argsWriter.push(afor);
		}
	}
	return argsWriter;
}

function stringWriter(index: number, name: string, send: Send, state: RemoteState, onSend: OnSend) {
	return function() {
		const len = arguments.length;
		try {
			const args = [index];
			for (let j = 0; j < len; j++) {
				args.push(arguments[j]);
			}
			const json = JSON.stringify(args);
			send(json);
			state.sentSize += json.length;
			onSend(index, name, json.length, false);
			return true;
		} catch(_) {
			return false;
		}
	};
}

function getBuffer(writer: BinaryWriter, useBuffer: true): Buffer;
function getBuffer(writer: BinaryWriter, useBuffer: false | undefined): Uint8Array;
function getBuffer(writer: BinaryWriter, useBuffer: true | false | undefined) {
	if (useBuffer) {
		return Buffer.from(writer.view.buffer, writer.view.byteOffset, writer.offset);
	} else {
		return new Uint8Array(writer.view.buffer, writer.view.byteOffset, writer.offset);
	}
}
function getBufferLen(buffer: Uint8Array, useBuffer: false | undefined): number;
function getBufferLen(buffer: Buffer, useBuffer: true): number;
function getBufferLen(buffer: Buffer | Uint8Array, useBuffer: true | false | undefined) {
	if(useBuffer) {
		return (buffer as Buffer).length;
	} else {
		return (buffer as Uint8Array).byteLength;
	}
}

function createCreateRemoteHandler(methodsDef: MethodDef[], handlerOptions: HandlerOptions): CreateRemoteHandler {
	const methods = getMethodsDefArray(methodsDef);
	return (remote, send, state, options, writer) => {
		const onSend = options.onSend || function () {};
		const strings = new Map<string, number>();
		for (let i = 0; i < methods.length; i++) {
			const name = methods[i][0];
			const options = methods[i][1];
			const stringDecoder = stringWriter(i, name, send, state, onSend);
			if (options.binary) {
				const reseters: (() => void)[] = [];
				const argsWriter = flattenArgs(options.binary.map(createBinWriteField), reseters);
				const reset = reseters.length ? () => reseters.forEach(f => f()) : noop;
				const len = argsWriter.length;
				remote[name] = function() {
					if (state.supportsBinary) {
						while (true) {
							try {
								reset();
								strings.clear();
								writer.offset = 0;
								writeUint8(writer, i);
								for (let j = 0; j < len; j++) {
									argsWriter[j](writer, arguments[j], strings);
								}
								const buffer = getBuffer(writer, handlerOptions.useBuffer as any);
								send(buffer);
								state.sentSize += getBufferLen(buffer, handlerOptions.useBuffer as any);
								onSend(i, name, getBufferLen(buffer, handlerOptions.useBuffer as any), true);
								return true;
							} catch (error) {
								if (isSizeError(error)) {
									resizeWriter(writer);
								} else {
									return false;
								}
							}
						}
					} else {
						return stringDecoder;
					}
				};
				// remote[name].debug = argsWriter;
			} else {
				if (handlerOptions.useBinaryByDefault || handlerOptions.forceBinary || isBinaryOnlyPacket(methodsDef[i])) {
					remote[name] = function() {
						console.error('Only binary protocol supported');
						return false;
					};
				} else {
					remote[name] = stringDecoder;
				}
			}
		}
	};
}
