"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPacketHandler = exports.defaultHandler = exports.readBytesRaw = void 0;
var interfaces_1 = require("../common/interfaces");
var utils_1 = require("../common/utils");
var binaryWriter_1 = require("./binaryWriter");
var binaryReader_1 = require("./binaryReader");
function readBytesRaw(reader) {
    var length = reader.view.byteLength - (reader.view.byteOffset + reader.offset);
    return (0, binaryReader_1.readBytes)(reader, length);
}
exports.readBytesRaw = readBytesRaw;
function createWriteBytesRange() {
    var argumentBuilder = [];
    var writeBytesRangeHandler = function (writer, arg) {
        argumentBuilder.push(arg);
        if (argumentBuilder.length === 3) {
            (0, binaryWriter_1.writeBytesRange)(writer, argumentBuilder[0], argumentBuilder[1], argumentBuilder[2]);
            argumentBuilder.length = 0;
        }
    };
    writeBytesRangeHandler.reset = function () {
        argumentBuilder.length = 0;
    };
    return writeBytesRangeHandler;
}
createWriteBytesRange.allocate = 3;
function createReadBytesRange() {
    var step = 0;
    var array = null;
    var readBytesRangeViewHandler = function (reader) {
        switch (step++) {
            case 0:
                array = (0, binaryReader_1.readUint8Array)(reader);
                return array;
            case 1:
                return 0;
            case 2:
                var result = array ? array.byteLength : 0;
                return result;
            default:
                return null;
        }
    };
    readBytesRangeViewHandler.reset = function () {
        step = 0;
        array = null;
    };
    return readBytesRangeViewHandler;
}
createReadBytesRange.allocate = 3;
function createWriteBytesRangeView() {
    var argumentBuilder = [];
    var writeBytesRangeViewHandler = function (writer, arg) {
        argumentBuilder.push(arg);
        if (argumentBuilder.length === 3) {
            (0, binaryWriter_1.writeBytesRangeView)(writer, argumentBuilder[0], argumentBuilder[1], argumentBuilder[2]);
            argumentBuilder.length = 0;
        }
    };
    writeBytesRangeViewHandler.reset = function () {
        argumentBuilder.length = 0;
    };
    return writeBytesRangeViewHandler;
}
createWriteBytesRangeView.allocate = 3;
function createReadBytesRangeView() {
    var step = 0;
    var view = null;
    var offset = 0;
    var length = 0;
    var readBytesRangeViewHandler = function (reader) {
        switch (step++) {
            case 0:
                var lengthRead = (0, binaryReader_1.readLength)(reader);
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
    readBytesRangeViewHandler.reset = function () {
        view = null;
        offset = 0;
        length = 0;
        step = 0;
    };
    return readBytesRangeViewHandler;
}
createReadBytesRangeView.allocate = 3;
var readerMethodsMapping = (_a = {},
    _a[interfaces_1.Bin.I8] = binaryReader_1.readInt8,
    _a[interfaces_1.Bin.U8] = binaryReader_1.readUint8,
    _a[interfaces_1.Bin.I16] = binaryReader_1.readInt16,
    _a[interfaces_1.Bin.U16] = binaryReader_1.readUint16,
    _a[interfaces_1.Bin.I32] = binaryReader_1.readInt32,
    _a[interfaces_1.Bin.U32] = binaryReader_1.readUint32,
    _a[interfaces_1.Bin.F32] = binaryReader_1.readFloat32,
    _a[interfaces_1.Bin.F64] = binaryReader_1.readFloat64,
    _a[interfaces_1.Bin.Bool] = binaryReader_1.readBoolean,
    _a[interfaces_1.Bin.Str] = binaryReader_1.readString,
    _a[interfaces_1.Bin.Obj] = binaryReader_1.readAny,
    _a[interfaces_1.Bin.Buffer] = binaryReader_1.readArrayBuffer,
    _a[interfaces_1.Bin.U8Array] = binaryReader_1.readUint8Array,
    _a[interfaces_1.Bin.Raw] = readBytesRaw,
    _a[interfaces_1.Bin.U8ArrayOffsetLength] = createReadBytesRange,
    _a[interfaces_1.Bin.DataViewOffsetLength] = createReadBytesRangeView,
    _a);
var writerMethodsMapping = (_b = {},
    _b[interfaces_1.Bin.I8] = binaryWriter_1.writeInt8,
    _b[interfaces_1.Bin.U8] = binaryWriter_1.writeUint8,
    _b[interfaces_1.Bin.I16] = binaryWriter_1.writeInt16,
    _b[interfaces_1.Bin.U16] = binaryWriter_1.writeUint16,
    _b[interfaces_1.Bin.I32] = binaryWriter_1.writeInt32,
    _b[interfaces_1.Bin.U32] = binaryWriter_1.writeUint32,
    _b[interfaces_1.Bin.F32] = binaryWriter_1.writeFloat32,
    _b[interfaces_1.Bin.F64] = binaryWriter_1.writeFloat64,
    _b[interfaces_1.Bin.Bool] = binaryWriter_1.writeBoolean,
    _b[interfaces_1.Bin.Str] = binaryWriter_1.writeString,
    _b[interfaces_1.Bin.Obj] = binaryWriter_1.writeAny,
    _b[interfaces_1.Bin.Buffer] = binaryWriter_1.writeArrayBuffer,
    _b[interfaces_1.Bin.U8Array] = binaryWriter_1.writeUint8Array,
    _b[interfaces_1.Bin.Raw] = binaryWriter_1.writeBytes,
    _b[interfaces_1.Bin.U8ArrayOffsetLength] = createWriteBytesRange,
    _b[interfaces_1.Bin.DataViewOffsetLength] = createWriteBytesRangeView,
    _b);
var defaultHandler = function (_funcId, _funcName, func, funcObj, args) { return func.apply(funcObj, args); };
exports.defaultHandler = defaultHandler;
function createPacketHandler(local, remote, options, log, customHandlers) {
    var _a;
    if (!local || !remote)
        throw new Error('Missing server or client method definitions');
    if (local.length > 250 || remote.length > 250)
        throw new Error('Too many methods');
    var debug = !!options.debug;
    var forceBinaryPackets = !!options.forceBinaryPackets;
    var development = !!options.development;
    var onSend = options.onSend;
    var onRecv = (_a = options.onRecv) !== null && _a !== void 0 ? _a : (function () { });
    var remoteNames = (0, interfaces_1.getNames)(remote);
    var localNames = (0, interfaces_1.getNames)(local);
    var localWithBinary = new Set(local
        .map(function (x) { return typeof x === 'string' ? { name: x, binary: false } : { name: x[0], binary: !!x[1].binary }; })
        .filter(function (x) { return x.binary; })
        .map(function (x) { return x.name; }));
    var ignorePackets = new Set(__spreadArray(__spreadArray([], (0, interfaces_1.getIgnore)(remote), true), (0, interfaces_1.getIgnore)(local), true));
    var createLocalHandlerFn = (customHandlers === null || customHandlers === void 0 ? void 0 : customHandlers.createLocalHandler) || createLocalHandler;
    var recvBinary = createLocalHandlerFn(local, remoteNames, onRecv, options.useBinaryByDefault);
    var createCreateRemoteHandlerFn = (customHandlers === null || customHandlers === void 0 ? void 0 : customHandlers.createRemoteHandler) || createCreateRemoteHandler;
    var createRemoteHandler = createCreateRemoteHandlerFn(remote, options);
    var writer = (0, binaryWriter_1.createBinaryWriter)();
    var strings = new Map();
    function sendString(send, name, id, funcId, messageId, result) {
        try {
            var data = JSON.stringify([id, funcId, messageId, result]);
            send(data);
            if (debug && ignorePackets.has(name)) {
                log("SEND [".concat(data.length, "] (str)"), name, [id, funcId, messageId, result]);
            }
            onSend === null || onSend === void 0 ? void 0 : onSend(id, name, data.length, false);
            return data.length;
        }
        catch (e) {
            if (debug || development)
                throw e;
            return 0;
        }
    }
    function sendBinary(send, name, id, funcId, messageId, result) {
        while (true) {
            try {
                strings.clear();
                writer.offset = 0;
                (0, binaryWriter_1.writeUint8)(writer, id);
                (0, binaryWriter_1.writeUint8)(writer, funcId);
                (0, binaryWriter_1.writeUint32)(writer, messageId);
                (0, binaryWriter_1.writeAny)(writer, result, strings);
                var data = options.useBuffer ?
                    Buffer.from(writer.view.buffer, writer.view.byteOffset, writer.offset) :
                    new Uint8Array(writer.view.buffer, writer.view.byteOffset, writer.offset);
                send(data);
                if (debug && !ignorePackets.has(name)) {
                    log("SEND [".concat(data.length, "] (bin)"), name, [id, funcId, messageId, result]);
                }
                if (onSend)
                    onSend(id, name, data.length, true);
                return data.length;
            }
            catch (e) {
                if ((0, binaryWriter_1.isSizeError)(e)) {
                    (0, binaryWriter_1.resizeWriter)(writer);
                }
                else {
                    if (debug || development)
                        throw e;
                    return 0;
                }
            }
        }
    }
    function createRemote(remote, send, state) {
        createRemoteHandler(remote, send, state, options, writer);
    }
    function recvString(data, funcList, specialFuncList, handleFunction) {
        if (handleFunction === void 0) { handleFunction = exports.defaultHandler; }
        var args = JSON.parse(data);
        var funcId = args.shift() | 0;
        var funcName;
        var funcSpecial = false;
        if (funcId === 255 /* MessageType.Version */) {
            funcName = '*version';
            args.shift(); // skip funcId
            args.shift(); // skip messageId
            funcSpecial = true;
        }
        else if (funcId === 252 /* MessageType.Error */) {
            funcName = '*error';
            args.shift(); // skip funcId
            args.shift(); // skip messageId
            funcSpecial = true;
        }
        else if (funcId === 253 /* MessageType.Rejected */) {
            funcName = '*reject:' + remoteNames[args.shift() | 0];
            funcSpecial = true;
        }
        else if (funcId === 254 /* MessageType.Resolved */) {
            funcName = '*resolve:' + remoteNames[args.shift() | 0];
            funcSpecial = true;
        }
        else {
            funcName = localNames[funcId];
        }
        var funcObj = funcSpecial ? specialFuncList : funcList;
        var func = funcObj[funcName];
        if (debug && !ignorePackets.has(funcName)) {
            log("RECV [".concat(data.length, "] (str)"), funcName, args);
        }
        if (forceBinaryPackets && localWithBinary.has(funcName)) {
            throw new Error("Invalid non-binary packet (".concat(funcName, ")"));
        }
        if (func) {
            handleFunction(funcId, funcName, func, funcObj, args);
        }
        else {
            if (debug)
                log("invalid message: ".concat(funcName), args);
            if (development)
                throw new Error("Invalid packet (".concat(funcName, ")"));
        }
        onRecv(funcId, funcName, data.length, false, undefined, funcList);
    }
    function writerBufferSize() {
        return writer.view.byteLength;
    }
    return { sendString: sendString, createRemote: createRemote, recvString: recvString, recvBinary: recvBinary, writerBufferSize: writerBufferSize, sendBinary: sendBinary };
}
exports.createPacketHandler = createPacketHandler;
function createBinReadFnField(bin) {
    if (Array.isArray(bin)) {
        if (bin.length === 1) {
            var readerFunction_1 = createBinReadFnField(bin[0]);
            var readArrayOneInner = function (reader, strings, cloneTypedArrays) {
                return (0, binaryReader_1.readArray)(reader, function (fnReader) { return readerFunction_1(fnReader, strings, cloneTypedArrays); });
            };
            // (readArrayOneInner as any).debug = readerFunction;
            return readArrayOneInner;
        }
        else {
            var readerFunctions_1 = bin.map(createBinReadFnField);
            var len_1 = readerFunctions_1.length;
            var readArrayInner = function (reader, strings, cloneTypedArrays) {
                var value = (0, binaryReader_1.readArray)(reader, function (fnReader) {
                    var result = [];
                    for (var i = 0; i < len_1; i++) {
                        result.push(readerFunctions_1[i](fnReader, strings, cloneTypedArrays));
                    }
                    return result;
                });
                return value;
            };
            // (readArrayInner as any).debug = readerFunctions;
            return readArrayInner;
        }
    }
    else {
        return readerMethodsMapping[bin];
    }
}
function createLocalHandler(methodsDef, remoteNames, onRecv, useBinaryResultByDefault) {
    //recvBinary(reader: BinaryReader, funcList: FuncList, specialFuncList: FuncList, callsList: number[], messageId: number, handleResult?: HandleResult): void;
    if (useBinaryResultByDefault === void 0) { useBinaryResultByDefault = false; }
    var methodsHandler = [];
    var methods = (0, interfaces_1.getMethodsDefArray)(methodsDef);
    var _loop_1 = function (i) {
        var name_1 = methods[i][0];
        var options = methods[i][1];
        var binaryResult = options.binaryResult || useBinaryResultByDefault;
        var checkRateLimit = function () { };
        if (options.rateLimit || options.serverRateLimit) {
            var _a = options.serverRateLimit ? (0, utils_1.parseRateLimit)(options.serverRateLimit, false) : (0, utils_1.parseRateLimit)(options.rateLimit, true), limit_1 = _a.limit, frame_1 = _a.frame;
            checkRateLimit = function (packetId, callsList, messageId, handleResult) {
                if (!(0, utils_1.checkRateLimit3)(packetId, callsList, limit_1, frame_1)) {
                    if (handleResult && options.promise) {
                        handleResult(packetId, name_1, binaryResult, Promise.reject(new Error('Rate limit exceeded')), messageId);
                    }
                    else {
                        throw new Error("Rate limit exceeded (".concat(name_1, ")"));
                    }
                }
            };
        }
        if (options.binary) {
            var decoders = [];
            var reseters_1 = [];
            var handlers = flattenArgs(options.binary.map(createBinReadFnField), reseters_1);
            for (var _i = 0, handlers_1 = handlers; _i < handlers_1.length; _i++) {
                var handler = handlers_1[_i];
                decoders.push(handler);
            }
            methodsHandler.push({
                name: name_1,
                decoders: decoders,
                promise: !!options.promise,
                checkRateLimit: checkRateLimit,
                binaryResult: binaryResult,
                reset: reseters_1.length ? function () { return reseters_1.forEach(function (f) { return f(); }); } : utils_1.noop
            });
        }
        else {
            methodsHandler.push({
                name: name_1,
                promise: !!options.promise,
                checkRateLimit: checkRateLimit,
                binaryResult: binaryResult,
                reset: utils_1.noop
            });
        }
    };
    for (var i = 0; i < methods.length; i++) {
        _loop_1(i);
    }
    var strings = [];
    var localHandler = function (reader, funcList, specialFuncList, callsList, messageId, handleResult) {
        var _a;
        strings.length = 0;
        reader.offset = 0;
        var packetId = (0, binaryReader_1.readUint8)(reader);
        switch (packetId) {
            case 255 /* MessageType.Version */:
            case 252 /* MessageType.Error */:
            case 254 /* MessageType.Resolved */:
            case 253 /* MessageType.Rejected */: {
                var funcId = (0, binaryReader_1.readUint8)(reader);
                var messageId_1 = (0, binaryReader_1.readUint32)(reader);
                var result = (0, binaryReader_1.readAny)(reader, strings, false);
                if (packetId === 255 /* MessageType.Version */) {
                    specialFuncList['*version'](result);
                }
                else if (packetId === 252 /* MessageType.Error */) {
                    specialFuncList['*error'](result);
                }
                else if (packetId === 254 /* MessageType.Resolved */) {
                    specialFuncList["*resolve:".concat(remoteNames[funcId])](messageId_1, result);
                }
                else if (packetId === 253 /* MessageType.Rejected */) {
                    specialFuncList["*reject:".concat(remoteNames[funcId])](messageId_1, result);
                }
                else {
                    throw new Error('Missing handling for packet ID: ' + packetId); // ureachable?
                }
                break;
            }
            default: {
                var def = methodsHandler[packetId];
                if (def && def.decoders) {
                    var args = [];
                    def.checkRateLimit(packetId, callsList, packetId, handleResult);
                    def.reset();
                    onRecv(packetId, def.name, reader.view.byteLength, true, reader.view, funcList);
                    for (var i = 0; i < def.decoders.length; i++) {
                        args.push(def.decoders[i](reader, strings, false));
                    }
                    var result = (_a = funcList)[def.name].apply(_a, args);
                    if (def.promise && handleResult) {
                        handleResult(packetId, def.name, def.binaryResult, result, messageId);
                    }
                }
                else {
                    throw new Error("Missing binary decoder for: ".concat(def.name, " (").concat(packetId, ")"));
                }
            }
        }
    };
    // (localHandler as any).debug = methodsHandler
    return localHandler;
}
function createBinWriteField(bin) {
    if (Array.isArray(bin)) {
        if (bin.length === 1) {
            var arrayWriter_1 = createBinWriteField(bin[0]);
            var writeArrayOneInner = function (writer, value, strings) {
                if ((0, binaryWriter_1.writeArrayHeader)(writer, value)) {
                    for (var i = 0; i < value.length; i++) {
                        arrayWriter_1(writer, value[i], strings);
                    }
                }
            };
            // (writeArrayOneInner as any).debug = arrayWriter;
            return writeArrayOneInner;
        }
        else {
            var arrayWriters_1 = bin.map(createBinWriteField);
            var writeArrayInner = function (writer, value, strings) {
                if ((0, binaryWriter_1.writeArrayHeader)(writer, value)) {
                    for (var i = 0; i < value.length; i++) {
                        for (var j = 0; j < value[i].length; j++) {
                            arrayWriters_1[j](writer, value[i][j], strings);
                        }
                    }
                }
            };
            // (writeArrayInner as any).debug = arrayWriters;
            return writeArrayInner;
        }
    }
    else {
        return writerMethodsMapping[bin];
    }
}
function flattenArgs(AllocateFnOrOther, reseters) {
    var argsWriter = [];
    for (var _i = 0, AllocateFnOrOther_1 = AllocateFnOrOther; _i < AllocateFnOrOther_1.length; _i++) {
        var afor = AllocateFnOrOther_1[_i];
        if ('allocate' in afor) {
            var writer = afor();
            for (var j = 0; j < afor.allocate; j++) {
                argsWriter.push(writer);
            }
            if (writer.reset) {
                reseters.push(writer.reset);
            }
        }
        else {
            argsWriter.push(afor);
        }
    }
    return argsWriter;
}
function stringWriter(index, name, send, state, onSend) {
    return function () {
        var len = arguments.length;
        try {
            var args = [index];
            for (var j = 0; j < len; j++) {
                args.push(arguments[j]);
            }
            var json = JSON.stringify(args);
            send(json);
            state.sentSize += json.length;
            onSend(index, name, json.length, false);
            return true;
        }
        catch (_) {
            return false;
        }
    };
}
function getBuffer(writer, useBuffer) {
    if (useBuffer) {
        return Buffer.from(writer.view.buffer, writer.view.byteOffset, writer.offset);
    }
    else {
        return new Uint8Array(writer.view.buffer, writer.view.byteOffset, writer.offset);
    }
}
function getBufferLen(buffer, useBuffer) {
    if (useBuffer) {
        return buffer.length;
    }
    else {
        return buffer.byteLength;
    }
}
function createCreateRemoteHandler(methodsDef, handlerOptions) {
    var methods = (0, interfaces_1.getMethodsDefArray)(methodsDef);
    return function (remote, send, state, options, writer) {
        var onSend = options.onSend || function () { };
        var strings = new Map();
        var _loop_2 = function (i) {
            var name_2 = methods[i][0];
            var options_1 = methods[i][1];
            var stringDecoder = stringWriter(i, name_2, send, state, onSend);
            if (options_1.binary) {
                var reseters_2 = [];
                var argsWriter_1 = flattenArgs(options_1.binary.map(createBinWriteField), reseters_2);
                var reset_1 = reseters_2.length ? function () { return reseters_2.forEach(function (f) { return f(); }); } : utils_1.noop;
                var len_2 = argsWriter_1.length;
                remote[name_2] = function () {
                    if (state.supportsBinary) {
                        while (true) {
                            try {
                                reset_1();
                                strings.clear();
                                writer.offset = 0;
                                (0, binaryWriter_1.writeUint8)(writer, i);
                                for (var j = 0; j < len_2; j++) {
                                    argsWriter_1[j](writer, arguments[j], strings);
                                }
                                var buffer = getBuffer(writer, handlerOptions.useBuffer);
                                send(buffer);
                                state.sentSize += getBufferLen(buffer, handlerOptions.useBuffer);
                                onSend(i, name_2, getBufferLen(buffer, handlerOptions.useBuffer), true);
                                return true;
                            }
                            catch (error) {
                                if ((0, binaryWriter_1.isSizeError)(error)) {
                                    (0, binaryWriter_1.resizeWriter)(writer);
                                }
                                else {
                                    return false;
                                }
                            }
                        }
                    }
                    else {
                        return stringDecoder;
                    }
                };
                // remote[name].debug = argsWriter;
            }
            else {
                if (handlerOptions.useBinaryByDefault || handlerOptions.forceBinary || (0, utils_1.isBinaryOnlyPacket)(methodsDef[i])) {
                    remote[name_2] = function () {
                        console.error('Only binary protocol supported');
                        return false;
                    };
                }
                else {
                    remote[name_2] = stringDecoder;
                }
            }
        };
        for (var i = 0; i < methods.length; i++) {
            _loop_2(i);
        }
    };
}
