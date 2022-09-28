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
exports.createPacketHandler = exports.defaultHandler = void 0;
var interfaces_1 = require("../common/interfaces");
var utils_1 = require("../common/utils");
var binaryWriter_1 = require("./binaryWriter");
var binaryReader_1 = require("./binaryReader");
function readBytesRaw(reader) {
    var length = reader.view.byteLength - (reader.view.byteOffset + reader.offset);
    return (0, binaryReader_1.readBytes)(reader, length);
}
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
function createPacketHandler(local, remote, options, log) {
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
    var recvBinary = createLocalHandler(local, onRecv);
    var createRemoteHandler = createCreateRemoteHandler(remote, options);
    var writer = (0, binaryWriter_1.createBinaryWriter)();
    function sendString(send, name, id, args) {
        try {
            var data = JSON.stringify(__spreadArray([id], args, true));
            send(data);
            if (debug && ignorePackets.has(name)) {
                log("SEND [".concat(data.length, "] (str)"), name, __spreadArray([id], args, true));
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
    function createRemote(remote, send, state) {
        globalThis.remote = remote;
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
        if (debug && ignorePackets.has(funcName)) {
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
    return { sendString: sendString, createRemote: createRemote, recvString: recvString, recvBinary: recvBinary, writerBufferSize: writerBufferSize };
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
function createLocalHandler(methodsDef, onRecv) {
    var methodsHandler = [];
    var methods = (0, interfaces_1.getMethodsDefArray)(methodsDef);
    var _loop_1 = function (i) {
        var name_1 = methods[i][0];
        var options = methods[i][1];
        var checkRateLimit = function () { };
        if (options.rateLimit || options.serverRateLimit) {
            var _a = options.serverRateLimit ? (0, utils_1.parseRateLimit)(options.serverRateLimit, false) : (0, utils_1.parseRateLimit)(options.rateLimit, true), limit_1 = _a.limit, frame_1 = _a.frame;
            checkRateLimit = function (packetId, callsList, messageId, handleResult) {
                if (!(0, utils_1.checkRateLimit3)(packetId, callsList, limit_1, frame_1)) {
                    if (handleResult && options.promise) {
                        handleResult(packetId, name_1, Promise.reject(new Error('Rate limit exceeded')), messageId);
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
                reset: reseters_1.length ? function () { return reseters_1.forEach(function (f) { return f(); }); } : utils_1.noop
            });
        }
        else {
            methodsHandler.push({
                name: name_1,
                promise: !!options.promise,
                checkRateLimit: checkRateLimit,
                reset: utils_1.noop
            });
        }
    };
    for (var i = 0; i < methods.length; i++) {
        _loop_1(i);
    }
    var strings = [];
    var localHandler = function (actions, reader, callsList, messageId, handleResult) {
        strings.length = 0;
        reader.offset = 0;
        var packetId = (0, binaryReader_1.readUint8)(reader);
        var def = methodsHandler[packetId];
        if (def && def.decoders) {
            var args = [];
            def.checkRateLimit(packetId, callsList, packetId, handleResult);
            def.reset();
            onRecv(packetId, def.name, reader.view.byteLength, true, reader.view, actions);
            for (var i = 0; i < def.decoders.length; i++) {
                args.push(def.decoders[i](reader, strings, false));
            }
            var result = actions[def.name].apply(actions, args);
            if (def.promise && handleResult) {
                handleResult(packetId, def.name, result, messageId);
            }
        }
        else {
            throw new Error("Missing binary decoder for: ".concat(def.name, " (").concat(packetId, ")"));
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
                                var bufLen = getBufferLen(buffer, handlerOptions.useBuffer);
                                state.sentSize += bufLen;
                                onSend(i, name_2, bufLen, true);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9wYWNrZXQvcGFja2V0SGFuZGxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBQUEsbURBQWdKO0FBQ2hKLHlDQUE0RjtBQUM1RiwrQ0FJd0I7QUFDeEIsK0NBSXdCO0FBT3hCLFNBQVMsWUFBWSxDQUFDLE1BQW9CO0lBQ3pDLElBQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2pGLE9BQU8sSUFBQSx3QkFBUyxFQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNsQyxDQUFDO0FBRUQsU0FBUyxxQkFBcUI7SUFDN0IsSUFBTSxlQUFlLEdBQTRCLEVBQUUsQ0FBQztJQUNwRCxJQUFNLHNCQUFzQixHQUFHLFVBQVUsTUFBb0IsRUFBRSxHQUF3QjtRQUN0RixlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzFCLElBQUksZUFBZSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDakMsSUFBQSw4QkFBZSxFQUFDLE1BQU0sRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFlLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBVyxFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQVcsQ0FBQyxDQUFDO1lBQ3RILGVBQWUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1NBQzNCO0lBQ0YsQ0FBQyxDQUFDO0lBQ0Ysc0JBQXNCLENBQUMsS0FBSyxHQUFHO1FBQzlCLGVBQWUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQzVCLENBQUMsQ0FBQztJQUNGLE9BQU8sc0JBQXNCLENBQUM7QUFDL0IsQ0FBQztBQUNELHFCQUFxQixDQUFDLFFBQVEsR0FBRyxDQUFDLENBQUM7QUFFbkMsU0FBUyxvQkFBb0I7SUFDNUIsSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDO0lBQ2IsSUFBSSxL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QUMsR0FBRzt3QkFDZCxPQUFPLENBQUMsS0FBSyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7d0JBQ2hELE9BQU8sS0FBSyxDQUFDO29CQUNkLENBQUMsQ0FBQztpQkFDRjtxQkFBTTtvQkFDTixNQUFNLENBQUMsTUFBSSxDQUFDLEdBQUcsYUFBYSxDQUFDO2lCQUM3QjthQUNEOztRQWhERixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUU7b0JBQTlCLENBQUM7U0FpRFQ7SUFDRixDQUFDLENBQUM7QUFDSCxDQUFDIiwiZmlsZSI6InBhY2tldC9wYWNrZXRIYW5kbGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRnVuY0xpc3QsIExvZ2dlciwgZ2V0TmFtZXMsIGdldElnbm9yZSwgTWV0aG9kRGVmLCBPblNlbmQsIE9uUmVjdiwgQmluLCBSZW1vdGVPcHRpb25zLCBnZXRNZXRob2RzRGVmQXJyYXkgfSBmcm9tICcuLi9jb21tb24vaW50ZXJmYWNlcyc7XG5pbXBvcnQgeyBpc0JpbmFyeU9ubHlQYWNrZXQsIHBhcnNlUmF0ZUxpbWl0LCBjaGVja1JhdGVMaW1pdDMsIG5vb3AgfSBmcm9tICcuLi9jb21tb24vdXRpbHMnO1xuaW1wb3J0IHtcblx0d3JpdGVVaW50OCwgd3JpdGVJbnQxNiwgd3JpdGVVaW50MTYsIHdyaXRlVWludDMyLCB3cml0ZUludDMyLCB3cml0ZUZsb2F0NjQsIHdyaXRlRmxvYXQzMiwgd3JpdGVCb29sZWFuLFxuXHR3cml0ZVN0cmluZywgd3JpdGVBcnJheUJ1ZmZlciwgd3JpdGVVaW50OEFycmF5LCB3cml0ZUludDgsIHdyaXRlQXJyYXlIZWFkZXIsXG5cdHdyaXRlQnl0ZXMsIHJlc2l6ZVdyaXRlciwgY3JlYXRlQmluYXJ5V3JpdGVyLCB3cml0ZUJ5dGVzUmFuZ2UsIHdyaXRlQW55LCBCaW5hcnlXcml0ZXIsIGlzU2l6ZUVycm9yLCB3cml0ZUJ5dGVzUmFuZ2VWaWV3LFxufSBmcm9tICcuL2JpbmFyeVdyaXRlcic7XG5pbXBvcnQge1xuXHRyZWFkSW50OCwgcmVhZFVpbnQ4LCByZWFkVWludDE2LCByZWFkSW50MTYsIHJlYWRVaW50MzIsIHJlYWRJbnQzMiwgcmVhZEZsb2F0MzIsIHJlYWRGbG9hdDY0LCByZWFkQm9vbGVhbixcblx0cmVhZFN0cmluZywgcmVhZEFycmF5QnVmZmVyLCByZWFkVWludDhBcnJheSwgcmVhZEFycmF5LCByZWFkQnl0ZXMsIEJpbmFyeVJlYWRlciwgcmVhZEFueSwvLywgcmVhZExlbmd0aFxuXHRyZWFkTGVuZ3RoXG59IGZyb20gJy4vYmluYXJ5UmVhZGVyJztcblxuaW50ZXJmYWNlIEFsbG9jYXRvckZ1bmN0aW9uIHtcblx0KC4uLmFyZ3M6IGFueSk6IGFueTtcblx0YWxsb2NhdGU6IG51bWJlcjtcbn1cblxuZnVuY3Rpb24gcmVhZEJ5dGVzUmF3KHJlYWRlcjogQmluYXJ5UmVhZGVyKSB7XG5cdGNvbnN0IGxlbmd0aCA9IHJlYWRlci52aWV3LmJ5dGVMZW5ndGggLSAocmVhZGVyLnZpZXcuYnl0ZU9mZnNldCArIHJlYWRlci5vZmZzZXQpO1xuXHRyZXR1cm4gcmVhZEJ5dGVzKHJlYWRlciwgbGVuZ3RoKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlV3JpdGVCeXRlc1JhbmdlKCkge1xuXHRjb25zdCBhcmd1bWVudEJ1aWxkZXI6IChVaW50OEFycmF5IHwgbnVtYmVyKVtdID0gW107XG5cdGNvbnN0IHdyaXRlQnl0ZXNSYW5nZUhhbmRsZXIgPSBmdW5jdGlvbiAod3JpdGVyOiBCaW5hcnlXcml0ZXIsIGFyZzogVWludDhBcnJheSB8IG51bWJlcikge1xuXHRcdGFyZ3VtZW50QnVpbGRlci5wdXNoKGFyZyk7XG5cdFx0aWYgKGFyZ3VtZW50QnVpbGRlci5sZW5ndGggPT09IDMpIHtcblx0XHRcdHdyaXRlQnl0ZXNSYW5nZSh3cml0ZXIsIGFyZ3VtZW50QnVpbGRlclswXSBhcyBVaW50OEFycmF5LCBhcmd1bWVudEJ1aWxkZXJbMV0gYXMgbnVtYmVyLCBhcmd1bWVudEJ1aWxkZXJbMl0gYXMgbnVtYmVyKTtcblx0XHRcdGFyZ3VtZW50QnVpbGRlci5sZW5ndGggPSAwO1xuXHRcdH1cblx0fTtcblx0d3JpdGVCeXRlc1JhbmdlSGFuZGxlci5yZXNldCA9ICgpID0+IHtcblx0XHRhcmd1bWVudEJ1aWxkZXIubGVuZ3RoID0gMDtcblx0fTtcblx0cmV0dXJuIHdyaXRlQnl0ZXNSYW5nZUhhbmRsZXI7XG59XG5jcmVhdGVXcml0ZUJ5dGVzUmFuZ2UuYWxsb2NhdGUgPSAzO1xuXG5mdW5jdGlvbiBjcmVhdGVSZWFkQnl0ZXNSYW5nZSgpIHtcblx0bGV0IHN0ZXAgPSAwO1xuXHRsZXQgYXJyYXk6IFVpbnQ4QXJyYXkgfCBudWxsID0gbnVsbDtcblx0Y29uc3QgcmVhZEJ5dGVzUmFuZ2VWaWV3SGFuZGxlciA9IGZ1bmN0aW9uIChyZWFkZXI6IEJpbmFyeVJlYWRlcikge1xuXHRcdHN3aXRjaCAoc3RlcCsrKSB7XG5cdFx0XHRjYXNlIDA6XG5cdFx0XHRcdGFycmF5ID0gcmVhZFVpbnQ4QXJyYXkocmVhZGVyKTtcblx0XHRcdFx0cmV0dXJuIGFycmF5O1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHRyZXR1cm4gMDtcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXJyYXkgPyBhcnJheS5ieXRlTGVuZ3RoIDogMDtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0fTtcblx0cmVhZEJ5dGVzUmFuZ2VWaWV3SGFuZGxlci5yZXNldCA9ICgpID0+IHtcblx0XHRzdGVwID0gMDtcblx0XHRhcnJheSA9IG51bGw7XG5cdH07XG5cblx0cmV0dXJuIHJlYWRCeXRlc1JhbmdlVmlld0hhbmRsZXI7XG59XG5jcmVhdGVSZWFkQnl0ZXNSYW5nZS5hbGxvY2F0ZSA9IDM7XG5cbmZ1bmN0aW9uIGNyZWF0ZVdyaXRlQnl0ZXNSYW5nZVZpZXcoKSB7XG5cdGNvbnN0IGFyZ3VtZW50QnVpbGRlcjogKERhdGFWaWV3IHwgbnVtYmVyKVtdID0gW107XG5cdGNvbnN0IHdyaXRlQnl0ZXNSYW5nZVZpZXdIYW5kbGVyID0gZnVuY3Rpb24gKHdyaXRlcjogQmluYXJ5V3JpdGVyLCBhcmc6ICBEYXRhVmlldyB8IG51bWJlcikge1xuXHRcdGFyZ3VtZW50QnVpbGRlci5wdXNoKGFyZyk7XG5cdFx0aWYgKGFyZ3VtZW50QnVpbGRlci5sZW5ndGggPT09IDMpIHtcblx0XHRcdHdyaXRlQnl0ZXNSYW5nZVZpZXcod3JpdGVyLCBhcmd1bWVudEJ1aWxkZXJbMF0gYXMgIERhdGFWaWV3LCBhcmd1bWVudEJ1aWxkZXJbMV0gYXMgbnVtYmVyLCBhcmd1bWVudEJ1aWxkZXJbMl0gYXMgbnVtYmVyKTtcblx0XHRcdGFyZ3VtZW50QnVpbGRlci5sZW5ndGggPSAwO1xuXHRcdH1cblx0fTtcblx0d3JpdGVCeXRlc1JhbmdlVmlld0hhbmRsZXIucmVzZXQgPSAoKSA9PiB7XG5cdFx0YXJndW1lbnRCdWlsZGVyLmxlbmd0aCA9IDA7XG5cdH07XG5cdHJldHVybiB3cml0ZUJ5dGVzUmFuZ2VWaWV3SGFuZGxlcjtcbn1cbmNyZWF0ZVdyaXRlQnl0ZXNSYW5nZVZpZXcuYWxsb2NhdGUgPSAzO1xuXG5mdW5jdGlvbiBjcmVhdGVSZWFkQnl0ZXNSYW5nZVZpZXcoKSB7XG5cdGxldCBzdGVwID0gMDtcblx0bGV0IHZpZXc6IChEYXRhVmlldyB8IG51bGwpID0gbnVsbDtcblx0bGV0IG9mZnNldCA9IDA7XG5cdGxldCBsZW5ndGggPSAwO1xuXG5cdGNvbnN0IHJlYWRCeXRlc1JhbmdlVmlld0hhbmRsZXIgPSBmdW5jdGlvbiAocmVhZGVyOiBCaW5hcnlSZWFkZXIpIHtcblx0XHRzd2l0Y2ggKHN0ZXArKykge1xuXHRcdFx0Y2FzZSAwOlxuXHRcdFx0XHRjb25zdCBsZW5ndGhSZWFkID0gcmVhZExlbmd0aChyZWFkZXIpO1xuXHRcdFx0XHRpZiAobGVuZ3RoUmVhZCAhPT0gLTEpIHtcblx0XHRcdFx0XHR2aWV3ID0gcmVhZGVyLnZpZXc7XG5cdFx0XHRcdFx0b2Zmc2V0ID0gcmVhZGVyLm9mZnNldDtcblx0XHRcdFx0XHRsZW5ndGggPSBsZW5ndGhSZWFkO1xuXHRcdFx0XHRcdHJlYWRlci5vZmZzZXQgKz0gbGVuZ3RoUmVhZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdmlldztcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0cmV0dXJuIG9mZnNldDtcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0cmV0dXJuIGxlbmd0aDtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0fTtcblx0cmVhZEJ5dGVzUmFuZ2VWaWV3SGFuZGxlci5yZXNldCA9ICgpID0+IHtcblx0XHR2aWV3ID0gbnVsbDtcblx0XHRvZmZzZXQgPSAwO1xuXHRcdGxlbmd0aCA9IDA7XG5cdFx0c3RlcCA9IDA7XG5cdH07XG5cblx0cmV0dXJuIHJlYWRCeXRlc1JhbmdlVmlld0hhbmRsZXI7XG59XG5jcmVhdGVSZWFkQnl0ZXNSYW5nZVZpZXcuYWxsb2NhdGUgPSAzO1xuXG50eXBlIFJlYWRlckZ1bmN0aW9uID0gKHJlYWRlcjogQmluYXJ5UmVhZGVyLCBzdHJpbmdzOiBzdHJpbmdbXSwgY2xvbmVUeXBlZEFycmF5czogYm9vbGVhbikgPT4gYW55O1xudHlwZSBXcml0ZXJGdW5jdGlvbiA9ICh3cml0ZXI6IEJpbmFyeVdyaXRlciwgdmFsdWU6IGFueSwgc3RyaW5nczogTWFwPHN0cmluZywgbnVtYmVyPikgPT4gdm9pZDtcblxuY29uc3QgcmVhZGVyTWV0aG9kc01hcHBpbmc6IHtba2V5IDogc3RyaW5nXTogUmVhZGVyRnVuY3Rpb259ID0ge1xuXHRbQmluLkk4XTogcmVhZEludDgsXG5cdFtCaW4uVThdOiByZWFkVWludDgsXG5cdFtCaW4uSTE2XTogcmVhZEludDE2LFxuXHRbQmluLlUxNl06IHJlYWRVaW50MTYsXG5cdFtCaW4uSTMyXTogcmVhZEludDMyLFxuXHRbQmluLlUzMl06IHJlYWRVaW50MzIsXG5cdFtCaW4uRjMyXTogcmVhZEZsb2F0MzIsXG5cdFtCaW4uRjY0XTogcmVhZEZsb2F0NjQsXG5cdFtCaW4uQm9vbF06IHJlYWRCb29sZWFuLFxuXHRbQmluLlN0cl06IHJlYWRTdHJpbmcsXG5cdFtCaW4uT2JqXTogcmVhZEFueSxcblx0W0Jpbi5CdWZmZXJdOiByZWFkQXJyYXlCdWZmZXIsXG5cdFtCaW4uVThBcnJheV06IHJlYWRVaW50OEFycmF5LFxuXHRbQmluLlJhd106IHJlYWRCeXRlc1Jhdyxcblx0W0Jpbi5VOEFycmF5T2Zmc2V0TGVuZ3RoXTogY3JlYXRlUmVhZEJ5dGVzUmFuZ2UsXG5cdFtCaW4uRGF0YVZpZXdPZmZzZXRMZW5ndGhdOiBjcmVhdGVSZWFkQnl0ZXNSYW5nZVZpZXcsXG59O1xuXG5cbmNvbnN0IHdyaXRlck1ldGhvZHNNYXBwaW5nOiB7W2tleSBpbiBCaW5dOiBXcml0ZXJGdW5jdGlvbn0gPSB7XG5cdFtCaW4uSThdOiB3cml0ZUludDgsXG5cdFtCaW4uVThdOiB3cml0ZVVpbnQ4LFxuXHRbQmluLkkxNl06IHdyaXRlSW50MTYsXG5cdFtCaW4uVTE2XTogd3JpdGVVaW50MTYsXG5cdFtCaW4uSTMyXTogd3JpdGVJbnQzMixcblx0W0Jpbi5VMzJdOiB3cml0ZVVpbnQzMixcblx0W0Jpbi5GMzJdOiB3cml0ZUZsb2F0MzIsXG5cdFtCaW4uRjY0XTogd3JpdGVGbG9hdDY0LFxuXHRbQmluLkJvb2xdOiB3cml0ZUJvb2xlYW4sXG5cdFtCaW4uU3RyXTogd3JpdGVTdHJpbmcsXG5cdFtCaW4uT2JqXTogd3JpdGVBbnksXG5cdFtCaW4uQnVmZmVyXTogd3JpdGVBcnJheUJ1ZmZlcixcblx0W0Jpbi5VOEFycmF5XTogd3JpdGVVaW50OEFycmF5LFxuXHRbQmluLlJhd106IHdyaXRlQnl0ZXMsXG5cdFtCaW4uVThBcnJheU9mZnNldExlbmd0aF06IGNyZWF0ZVdyaXRlQnl0ZXNSYW5nZSxcblx0W0Jpbi5EYXRhVmlld09mZnNldExlbmd0aF06IGNyZWF0ZVdyaXRlQnl0ZXNSYW5nZVZpZXcsXG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIFNlbmQge1xuXHQoZGF0YTogc3RyaW5nIHwgVWludDhBcnJheSk6IHZvaWQ7IC8vIG9yIEJ1ZmZlclxufVxuXG5leHBvcnQgY29uc3QgZW51bSBNZXNzYWdlVHlwZSB7XG5cdFZlcnNpb24gPSAyNTUsXG5cdFJlc29sdmVkID0gMjU0LFxuXHRSZWplY3RlZCA9IDI1Myxcbn1cblxuZXhwb3J0IGludGVyZmFjZSBGdW5jdGlvbkhhbmRsZXIge1xuXHQoZnVuY0lkOiBudW1iZXIsIGZ1bmNOYW1lOiBzdHJpbmcsIGZ1bmM6IEZ1bmN0aW9uLCBmdW5jT2JqOiBhbnksIGFyZ3M6IGFueVtdKTogdm9pZDtcbn1cblxuZXhwb3J0IGNvbnN0IGRlZmF1bHRIYW5kbGVyOiBGdW5jdGlvbkhhbmRsZXIgPVxuXHQoX2Z1bmNJZCwgX2Z1bmNOYW1lLCBmdW5jLCBmdW5jT2JqLCBhcmdzKSA9PiBmdW5jLmFwcGx5KGZ1bmNPYmosIGFyZ3MpO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlbW90ZVN0YXRlIHtcblx0c3VwcG9ydHNCaW5hcnk6IGJvb2xlYW47XG5cdHNlbnRTaXplOiBudW1iZXI7XG59XG5cbmV4cG9ydCB0eXBlIEhhbmRsZVJlc3VsdCA9IChmdW5jSWQ6IG51bWJlciwgZnVuY05hbWU6IHN0cmluZywgcmVzdWx0OiBQcm9taXNlPGFueT4sIG1lc3NhZ2VJZDogbnVtYmVyKSA9PiB2b2lkO1xuXG5leHBvcnQgaW50ZXJmYWNlIEhhbmRsZXJPcHRpb25zIHtcblx0Zm9yY2VCaW5hcnk/OiBib29sZWFuO1xuXHRmb3JjZUJpbmFyeVBhY2tldHM/OiBib29sZWFuO1xuXHR1c2VCaW5hcnlCeURlZmF1bHQ/OiBib29sZWFuO1xuXHR1c2VCdWZmZXI/OiBib29sZWFuO1xuXHRkZWJ1Zz86IGJvb2xlYW47XG5cdGRldmVsb3BtZW50PzogYm9vbGVhbjtcblx0b25TZW5kPzogT25TZW5kO1xuXHRvblJlY3Y/OiBPblJlY3Y7XG59XG5cbnR5cGUgQ3JlYXRlUmVtb3RlSGFuZGxlciA9IChcblx0cmVtb3RlOiBhbnksIHNlbmQ6IFNlbmQsIHN0YXRlOiBSZW1vdGVTdGF0ZSwgb3B0aW9uczogUmVtb3RlT3B0aW9ucywgd3JpdGVyOiBCaW5hcnlXcml0ZXIsXG4pID0+IGFueTtcblxudHlwZSBMb2NhbEhhbmRsZXIgPSAoXG5cdGFjdGlvbnM6IGFueSwgcmVhZGVyOiBCaW5hcnlSZWFkZXIsIGNhbGxzTGlzdDogbnVtYmVyW10sIG1lc3NhZ2VJZDogbnVtYmVyLCBoYW5kbGVSZXN1bHQ/OiBIYW5kbGVSZXN1bHRcbikgPT4gdm9pZDtcblxuZXhwb3J0IGludGVyZmFjZSBQYWNrZXRIYW5kbGVyIHtcblx0c2VuZFN0cmluZyhzZW5kOiBTZW5kLCBuYW1lOiBzdHJpbmcsIGlkOiBudW1iZXIsIGFyZ3M6IGFueVtdKTogbnVtYmVyO1xuXHRjcmVhdGVSZW1vdGUocmVtb3RlOiBhbnksIHNlbmQ6IFNlbmQsIHN0YXRlOiBSZW1vdGVTdGF0ZSk6IHZvaWQ7XG5cdHJlY3ZTdHJpbmcoZGF0YTogc3RyaW5nLCBmdW5jTGlzdDogRnVuY0xpc3QsIHNwZWNpYWxGdW5jTGlzdDogRnVuY0xpc3QsIGhhbmRsZUZ1bmN0aW9uPzogRnVuY3Rpb25IYW5kbGVyKTogdm9pZDtcblx0cmVjdkJpbmFyeShhY3Rpb25zOiBhbnksIHJlYWRlcjogQmluYXJ5UmVhZGVyLCBjYWxsc0xpc3Q6IG51bWJlcltdLCBtZXNzYWdlSWQ6IG51bWJlciwgaGFuZGxlUmVzdWx0PzogSGFuZGxlUmVzdWx0KTogdm9pZDtcblx0d3JpdGVyQnVmZmVyU2l6ZSgpOiBudW1iZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQYWNrZXRIYW5kbGVyKFxuXHRsb2NhbDogTWV0aG9kRGVmW10gfCB1bmRlZmluZWQsIHJlbW90ZTogTWV0aG9kRGVmW10gfCB1bmRlZmluZWQsIG9wdGlvbnM6IEhhbmRsZXJPcHRpb25zLCBsb2c6IExvZ2dlclxuKTogUGFja2V0SGFuZGxlciB7XG5cdGlmICghbG9jYWwgfHwgIXJlbW90ZSkgdGhyb3cgbmV3IEVycm9yKCdNaXNzaW5nIHNlcnZlciBvciBjbGllbnQgbWV0aG9kIGRlZmluaXRpb25zJyk7XG5cdGlmIChsb2NhbC5sZW5ndGggPiAyNTAgfHwgcmVtb3RlLmxlbmd0aCA+IDI1MCkgdGhyb3cgbmV3IEVycm9yKCdUb28gbWFueSBtZXRob2RzJyk7XG5cblx0Y29uc3QgZGVidWcgPSAhIW9wdGlvbnMuZGVidWc7XG5cdGNvbnN0IGZvcmNlQmluYXJ5UGFja2V0cyA9ICEhb3B0aW9ucy5mb3JjZUJpbmFyeVBhY2tldHM7XG5cdGNvbnN0IGRldmVsb3BtZW50ID0gISFvcHRpb25zLmRldmVsb3BtZW50O1xuXHRjb25zdCBvblNlbmQgPSBvcHRpb25zLm9uU2VuZDtcblx0Y29uc3Qgb25SZWN2ID0gb3B0aW9ucy5vblJlY3YgPz8gKCgpID0+IHsgfSk7XG5cblx0Y29uc3QgcmVtb3RlTmFtZXMgPSBnZXROYW1lcyhyZW1vdGUpO1xuXHRjb25zdCBsb2NhbE5hbWVzID0gZ2V0TmFtZXMobG9jYWwpO1xuXHRjb25zdCBsb2NhbFdpdGhCaW5hcnkgPSBuZXcgU2V0KGxvY2FsXG5cdFx0Lm1hcCh4ID0+IHR5cGVvZiB4ID09PSAnc3RyaW5nJyA/IHsgbmFtZTogeCwgYmluYXJ5OiBmYWxzZSB9IDogeyBuYW1lOiB4WzBdLCBiaW5hcnk6ICEheFsxXS5iaW5hcnkgfSlcblx0XHQuZmlsdGVyKHggPT4geC5iaW5hcnkpXG5cdFx0Lm1hcCh4ID0+IHgubmFtZSkpO1xuXHRjb25zdCBpZ25vcmVQYWNrZXRzID0gbmV3IFNldChbLi4uZ2V0SWdub3JlKHJlbW90ZSksIC4uLmdldElnbm9yZShsb2NhbCldKTtcblx0Y29uc3QgcmVjdkJpbmFyeSA9IGNyZWF0ZUxvY2FsSGFuZGxlcihsb2NhbCwgb25SZWN2KTtcblx0Y29uc3QgY3JlYXRlUmVtb3RlSGFuZGxlciA9IGNyZWF0ZUNyZWF0ZVJlbW90ZUhhbmRsZXIocmVtb3RlLCBvcHRpb25zKTtcblx0Y29uc3Qgd3JpdGVyID0gY3JlYXRlQmluYXJ5V3JpdGVyKCk7XG5cblx0ZnVuY3Rpb24gc2VuZFN0cmluZyhzZW5kOiBTZW5kLCBuYW1lOiBzdHJpbmcsIGlkOiBudW1iZXIsIGFyZ3M6IGFueVtdKTogbnVtYmVyIHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZGF0YSA9IEpTT04uc3RyaW5naWZ5KFtpZCwgLi4uYXJnc10pO1xuXHRcdFx0c2VuZChkYXRhKTtcblxuXHRcdFx0aWYgKGRlYnVnICYmIGlnbm9yZVBhY2tldHMuaGFzKG5hbWUpKSB7XG5cdFx0XHRcdGxvZyhgU0VORCBbJHtkYXRhLmxlbmd0aH1dIChzdHIpYCwgbmFtZSwgW2lkLCAuLi5hcmdzXSk7XG5cdFx0XHR9XG5cblx0XHRcdG9uU2VuZD8uKGlkLCBuYW1lLCBkYXRhLmxlbmd0aCwgZmFsc2UpO1xuXHRcdFx0cmV0dXJuIGRhdGEubGVuZ3RoO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGlmIChkZWJ1ZyB8fCBkZXZlbG9wbWVudCkgdGhyb3cgZTtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGNyZWF0ZVJlbW90ZShyZW1vdGU6IGFueSwgc2VuZDogU2VuZCwgc3RhdGU6IFJlbW90ZVN0YXRlKSB7XG5cdFx0KGdsb2JhbFRoaXMgYXMgYW55KS5yZW1vdGUgPSByZW1vdGU7XG5cdFx0Y3JlYXRlUmVtb3RlSGFuZGxlcihyZW1vdGUsIHNlbmQsIHN0YXRlLCBvcHRpb25zLCB3cml0ZXIpO1xuXHR9XG5cblx0ZnVuY3Rpb24gcmVjdlN0cmluZyhkYXRhOiBzdHJpbmcsIGZ1bmNMaXN0OiBGdW5jTGlzdCwgc3BlY2lhbEZ1bmNMaXN0OiBGdW5jTGlzdCwgaGFuZGxlRnVuY3Rpb24gPSBkZWZhdWx0SGFuZGxlcikge1xuXHRcdGNvbnN0IGFyZ3MgPSBKU09OLnBhcnNlKGRhdGEpO1xuXHRcdGNvbnN0IGZ1bmNJZCA9IGFyZ3Muc2hpZnQoKSB8IDA7XG5cdFx0bGV0IGZ1bmNOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGZ1bmNTcGVjaWFsID0gZmFsc2U7XG5cblx0XHRpZiAoZnVuY0lkID09PSBNZXNzYWdlVHlwZS5WZXJzaW9uKSB7XG5cdFx0XHRmdW5jTmFtZSA9ICcqdmVyc2lvbic7XG5cdFx0XHRmdW5jU3BlY2lhbCA9IHRydWU7XG5cdFx0fSBlbHNlIGlmIChmdW5jSWQgPT09IE1lc3NhZ2VUeXBlLlJlamVjdGVkKSB7XG5cdFx0XHRmdW5jTmFtZSA9ICcqcmVqZWN0OicgKyByZW1vdGVOYW1lc1thcmdzLnNoaWZ0KCkgfCAwXTtcblx0XHRcdGZ1bmNTcGVjaWFsID0gdHJ1ZTtcblx0XHR9IGVsc2UgaWYgKGZ1bmNJZCA9PT0gTWVzc2FnZVR5cGUuUmVzb2x2ZWQpIHtcblx0XHRcdGZ1bmNOYW1lID0gJypyZXNvbHZlOicgKyByZW1vdGVOYW1lc1thcmdzLnNoaWZ0KCkgfCAwXTtcblx0XHRcdGZ1bmNTcGVjaWFsID0gdHJ1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZnVuY05hbWUgPSBsb2NhbE5hbWVzW2Z1bmNJZF07XG5cdFx0fVxuXG5cdFx0Y29uc3QgZnVuY09iaiA9IGZ1bmNTcGVjaWFsID8gc3BlY2lhbEZ1bmNMaXN0IDogZnVuY0xpc3Q7XG5cdFx0Y29uc3QgZnVuYyA9IGZ1bmNPYmpbZnVuY05hbWUhXTtcblxuXHRcdGlmIChkZWJ1ZyAmJiBpZ25vcmVQYWNrZXRzLmhhcyhmdW5jTmFtZSkpIHtcblx0XHRcdGxvZyhgUkVDViBbJHtkYXRhLmxlbmd0aH1dIChzdHIpYCwgZnVuY05hbWUsIGFyZ3MpO1xuXHRcdH1cblxuXHRcdGlmIChmb3JjZUJpbmFyeVBhY2tldHMgJiYgbG9jYWxXaXRoQmluYXJ5LmhhcyhmdW5jTmFtZSkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBub24tYmluYXJ5IHBhY2tldCAoJHtmdW5jTmFtZX0pYCk7XG5cdFx0fVxuXG5cdFx0aWYgKGZ1bmMpIHtcblx0XHRcdGhhbmRsZUZ1bmN0aW9uKGZ1bmNJZCwgZnVuY05hbWUhLCBmdW5jLCBmdW5jT2JqLCBhcmdzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKGRlYnVnKSBsb2coYGludmFsaWQgbWVzc2FnZTogJHtmdW5jTmFtZX1gLCBhcmdzKTtcblx0XHRcdGlmIChkZXZlbG9wbWVudCkgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHBhY2tldCAoJHtmdW5jTmFtZX0pYCk7XG5cdFx0fVxuXG5cdFx0b25SZWN2KGZ1bmNJZCwgZnVuY05hbWUsIGRhdGEubGVuZ3RoLCBmYWxzZSwgdW5kZWZpbmVkLCBmdW5jTGlzdCk7XG5cdH1cblxuXHRmdW5jdGlvbiB3cml0ZXJCdWZmZXJTaXplKCkge1xuXHRcdHJldHVybiB3cml0ZXIudmlldy5ieXRlTGVuZ3RoO1xuXHR9XG5cblx0cmV0dXJuIHsgc2VuZFN0cmluZywgY3JlYXRlUmVtb3RlLCByZWN2U3RyaW5nLCByZWN2QmluYXJ5LCB3cml0ZXJCdWZmZXJTaXplIH07XG59XG50eXBlIFJlc2V0RnVuY3Rpb24gPSAoKSA9PiB2b2lkO1xuXG50eXBlIFJhdGVMaW1pdENoZWNrZXIgPSAocGFja2V0SWQ6IG51bWJlciwgY2FsbHNMaXN0OiBudW1iZXJbXSwgbWVzc2FnZUlkOiBudW1iZXIsIGhhbmRsZVJlc3VsdD86IEhhbmRsZVJlc3VsdCkgPT4gdm9pZFxuaW50ZXJmYWNlIExvY2FsSGFuZGxlckRlZiB7XG5cdG5hbWU6IHN0cmluZztcblx0cHJvbWlzZTogYm9vbGVhbjtcblx0ZGVjb2RlcnM/OiBSZWFkZXJGdW5jdGlvbltdO1xuXHRjaGVja1JhdGVMaW1pdDogUmF0ZUxpbWl0Q2hlY2tlcjtcblx0cmVzZXQ6IFJlc2V0RnVuY3Rpb247XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUJpblJlYWRGbkZpZWxkKGJpbjogQmluIHwgYW55W10pOiBSZWFkZXJGdW5jdGlvbiB7XG5cdGlmIChBcnJheS5pc0FycmF5KGJpbikpIHtcblx0XHRpZihiaW4ubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRjb25zdCByZWFkZXJGdW5jdGlvbiA9IGNyZWF0ZUJpblJlYWRGbkZpZWxkKGJpblswXSk7XG5cblx0XHRcdGNvbnN0IHJlYWRBcnJheU9uZUlubmVyOiBSZWFkZXJGdW5jdGlvbiA9IGZ1bmN0aW9uIChyZWFkZXIsIHN0cmluZ3MsIGNsb25lVHlwZWRBcnJheXMpIHtcblx0XHRcdFx0cmV0dXJuIHJlYWRBcnJheShyZWFkZXIsIGZuUmVhZGVyID0+IHJlYWRlckZ1bmN0aW9uKGZuUmVhZGVyLCBzdHJpbmdzLCBjbG9uZVR5cGVkQXJyYXlzKSk7XG5cdFx0XHR9O1xuXHRcdFx0Ly8gKHJlYWRBcnJheU9uZUlubmVyIGFzIGFueSkuZGVidWcgPSByZWFkZXJGdW5jdGlvbjtcblx0XHRcdHJldHVybiByZWFkQXJyYXlPbmVJbm5lcjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgcmVhZGVyRnVuY3Rpb25zID0gYmluLm1hcChjcmVhdGVCaW5SZWFkRm5GaWVsZCk7XG5cdFx0XHRjb25zdCBsZW4gPSByZWFkZXJGdW5jdGlvbnMubGVuZ3RoO1xuXHRcdFx0Y29uc3QgcmVhZEFycmF5SW5uZXI6IFJlYWRlckZ1bmN0aW9uID0gZnVuY3Rpb24gKHJlYWRlciwgc3RyaW5ncywgY2xvbmVUeXBlZEFycmF5cykge1xuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IHJlYWRBcnJheShyZWFkZXIsIGZuUmVhZGVyID0+IHtcblx0XHRcdFx0XHRjb25zdCByZXN1bHQ6IGFueVtdID0gW107XG5cdFx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRcdFx0cmVzdWx0LnB1c2gocmVhZGVyRnVuY3Rpb25zW2ldKGZuUmVhZGVyLCBzdHJpbmdzLCBjbG9uZVR5cGVkQXJyYXlzKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdH07XG5cdFx0XHQvLyAocmVhZEFycmF5SW5uZXIgYXMgYW55KS5kZWJ1ZyA9IHJlYWRlckZ1bmN0aW9ucztcblx0XHRcdHJldHVybiByZWFkQXJyYXlJbm5lcjtcblx0XHR9XG5cblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gcmVhZGVyTWV0aG9kc01hcHBpbmdbYmluXTtcblx0fVxufVxuXG5cbmZ1bmN0aW9uIGNyZWF0ZUxvY2FsSGFuZGxlcihtZXRob2RzRGVmOiBNZXRob2REZWZbXSwgb25SZWN2OiBPblJlY3YpOiBMb2NhbEhhbmRsZXIge1xuXHRjb25zdCBtZXRob2RzSGFuZGxlcjogKExvY2FsSGFuZGxlckRlZiB8IHVuZGVmaW5lZClbXSA9IFtdO1xuXHRjb25zdCBtZXRob2RzID0gZ2V0TWV0aG9kc0RlZkFycmF5KG1ldGhvZHNEZWYpO1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IG1ldGhvZHMubGVuZ3RoOyBpKyspIHtcblx0XHRjb25zdCBuYW1lID0gbWV0aG9kc1tpXVswXTtcblx0XHRjb25zdCBvcHRpb25zID0gbWV0aG9kc1tpXVsxXTtcblx0XHRsZXQgY2hlY2tSYXRlTGltaXQ6IFJhdGVMaW1pdENoZWNrZXIgPSAoKSA9PiB7fTtcblx0XHRpZiAob3B0aW9ucy5yYXRlTGltaXQgfHwgb3B0aW9ucy5zZXJ2ZXJSYXRlTGltaXQpIHtcblx0XHRcdGNvbnN0IHsgbGltaXQsIGZyYW1lIH0gPSBvcHRpb25zLnNlcnZlclJhdGVMaW1pdCA/IHBhcnNlUmF0ZUxpbWl0KG9wdGlvbnMuc2VydmVyUmF0ZUxpbWl0LCBmYWxzZSkgOiBwYXJzZVJhdGVMaW1pdChvcHRpb25zLnJhdGVMaW1pdCEsIHRydWUpO1xuXG5cdFx0XHRjaGVja1JhdGVMaW1pdCA9IChwYWNrZXRJZCwgY2FsbHNMaXN0LCBtZXNzYWdlSWQsIGhhbmRsZVJlc3VsdCkgPT4ge1xuXHRcdFx0XHRpZiAoIWNoZWNrUmF0ZUxpbWl0MyhwYWNrZXRJZCwgY2FsbHNMaXN0LCBsaW1pdCwgZnJhbWUpKSB7XG5cdFx0XHRcdFx0aWYgKGhhbmRsZVJlc3VsdCAmJiBvcHRpb25zLnByb21pc2UpIHtcblx0XHRcdFx0XHRcdGhhbmRsZVJlc3VsdChwYWNrZXRJZCxuYW1lLCBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ1JhdGUgbGltaXQgZXhjZWVkZWQnKSksIG1lc3NhZ2VJZCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihgUmF0ZSBsaW1pdCBleGNlZWRlZCAoJHtuYW1lfSlgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLmJpbmFyeSkge1xuXHRcdFx0Y29uc3QgZGVjb2RlcnM6IExvY2FsSGFuZGxlckRlZlsnZGVjb2RlcnMnXSA9IFtdO1xuXHRcdFx0Y29uc3QgcmVzZXRlcnM6IFJlc2V0RnVuY3Rpb25bXSA9IFtdO1xuXHRcdFx0Y29uc3QgaGFuZGxlcnMgPSAgZmxhdHRlbkFyZ3Mob3B0aW9ucy5iaW5hcnkubWFwKGNyZWF0ZUJpblJlYWRGbkZpZWxkKSwgcmVzZXRlcnMpO1xuXHRcdFx0Zm9yIChjb25zdCBoYW5kbGVyIG9mIGhhbmRsZXJzKSB7XG5cdFx0XHRcdGRlY29kZXJzLnB1c2goaGFuZGxlcik7XG5cdFx0XHR9XG5cdFx0XHRtZXRob2RzSGFuZGxlci5wdXNoKHtcblx0XHRcdFx0bmFtZSxcblx0XHRcdFx0ZGVjb2RlcnMsXG5cdFx0XHRcdHByb21pc2U6ICEhb3B0aW9ucy5wcm9taXNlLFxuXHRcdFx0XHRjaGVja1JhdGVMaW1pdCxcblx0XHRcdFx0cmVzZXQ6IHJlc2V0ZXJzLmxlbmd0aCA/ICgpID0+IHJlc2V0ZXJzLmZvckVhY2goZiA9PiBmKCkpIDogbm9vcFxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1ldGhvZHNIYW5kbGVyLnB1c2goe1xuXHRcdFx0XHRuYW1lLFxuXHRcdFx0XHRwcm9taXNlOiAhIW9wdGlvbnMucHJvbWlzZSxcblx0XHRcdFx0Y2hlY2tSYXRlTGltaXQsXG5cdFx0XHRcdHJlc2V0OiBub29wXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0fVxuXG5cblx0Y29uc3Qgc3RyaW5nczogc3RyaW5nW10gPSBbXTtcblx0Y29uc3QgbG9jYWxIYW5kbGVyOiBMb2NhbEhhbmRsZXIgPSBmdW5jdGlvbiAoYWN0aW9uczogYW55LCByZWFkZXI6IEJpbmFyeVJlYWRlciwgY2FsbHNMaXN0OiBudW1iZXJbXSwgbWVzc2FnZUlkOiBudW1iZXIsIGhhbmRsZVJlc3VsdD86IEhhbmRsZVJlc3VsdCB8IHVuZGVmaW5lZCkge1xuXHRcdHN0cmluZ3MubGVuZ3RoID0gMDtcblx0XHRyZWFkZXIub2Zmc2V0ID0gMDtcblx0XHRjb25zdCBwYWNrZXRJZCA9IHJlYWRVaW50OChyZWFkZXIpO1xuXHRcdGNvbnN0IGRlZiA9IG1ldGhvZHNIYW5kbGVyW3BhY2tldElkXSE7XG5cdFx0aWYgKGRlZiAmJiBkZWYuZGVjb2RlcnMpIHtcblx0XHRcdGNvbnN0IGFyZ3M6IGFueVtdID0gW107XG5cdFx0XHRkZWYuY2hlY2tSYXRlTGltaXQocGFja2V0SWQsIGNhbGxzTGlzdCwgcGFja2V0SWQsIGhhbmRsZVJlc3VsdCk7XG5cdFx0XHRkZWYucmVzZXQoKTtcblx0XHRcdG9uUmVjdihwYWNrZXRJZCwgZGVmLm5hbWUsIHJlYWRlci52aWV3LmJ5dGVMZW5ndGgsIHRydWUsIHJlYWRlci52aWV3LCBhY3Rpb25zKTtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZGVmLmRlY29kZXJzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGFyZ3MucHVzaChkZWYuZGVjb2RlcnNbaV0ocmVhZGVyLCBzdHJpbmdzIGFzIGFueSwgZmFsc2UpKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHJlc3VsdCA9IGFjdGlvbnNbZGVmLm5hbWVdKC4uLmFyZ3MpO1xuXHRcdFx0aWYgKGRlZi5wcm9taXNlICYmIGhhbmRsZVJlc3VsdCkge1xuXHRcdFx0XHRoYW5kbGVSZXN1bHQocGFja2V0SWQsIGRlZi5uYW1lLCByZXN1bHQsIG1lc3NhZ2VJZCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgTWlzc2luZyBiaW5hcnkgZGVjb2RlciBmb3I6ICR7ZGVmLm5hbWV9ICgke3BhY2tldElkfSlgKTtcblx0XHR9XG5cdH07XG5cdC8vIChsb2NhbEhhbmRsZXIgYXMgYW55KS5kZWJ1ZyA9IG1ldGhvZHNIYW5kbGVyXG5cdHJldHVybiBsb2NhbEhhbmRsZXI7XG59XG5mdW5jdGlvbiBjcmVhdGVCaW5Xcml0ZUZpZWxkKGJpbjogQmluIHwgYW55W10pOiBXcml0ZXJGdW5jdGlvbiB7XG5cdGlmIChBcnJheS5pc0FycmF5KGJpbikpIHtcblx0XHRpZiAoYmluLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0Y29uc3QgYXJyYXlXcml0ZXIgPSBjcmVhdGVCaW5Xcml0ZUZpZWxkKGJpblswXSk7XG5cdFx0XHRjb25zdCB3cml0ZUFycmF5T25lSW5uZXI6IFdyaXRlckZ1bmN0aW9uID0gZnVuY3Rpb24gKHdyaXRlciwgdmFsdWU6IGFueVtdLCBzdHJpbmdzKSB7XG5cdFx0XHRcdGlmICh3cml0ZUFycmF5SGVhZGVyKHdyaXRlciwgdmFsdWUpKSB7XG5cdFx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0YXJyYXlXcml0ZXIod3JpdGVyLCB2YWx1ZVtpXSwgc3RyaW5ncyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0Ly8gKHdyaXRlQXJyYXlPbmVJbm5lciBhcyBhbnkpLmRlYnVnID0gYXJyYXlXcml0ZXI7XG5cdFx0XHRyZXR1cm4gd3JpdGVBcnJheU9uZUlubmVyO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBhcnJheVdyaXRlcnMgPSBiaW4ubWFwKGNyZWF0ZUJpbldyaXRlRmllbGQpO1xuXHRcdFx0Y29uc3Qgd3JpdGVBcnJheUlubmVyOiBXcml0ZXJGdW5jdGlvbiA9IGZ1bmN0aW9uICh3cml0ZXIsIHZhbHVlOiBhbnlbXSwgc3RyaW5ncykge1xuXHRcdFx0XHRpZiAod3JpdGVBcnJheUhlYWRlcih3cml0ZXIsIHZhbHVlKSkge1xuXHRcdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdGZvciAobGV0IGogPSAwOyBqIDwgdmFsdWVbaV0ubGVuZ3RoOyBqKyspIHtcblx0XHRcdFx0XHRcdFx0YXJyYXlXcml0ZXJzW2pdKHdyaXRlciwgdmFsdWVbaV1bal0sIHN0cmluZ3MpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdC8vICh3cml0ZUFycmF5SW5uZXIgYXMgYW55KS5kZWJ1ZyA9IGFycmF5V3JpdGVycztcblx0XHRcdHJldHVybiB3cml0ZUFycmF5SW5uZXI7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdHJldHVybiB3cml0ZXJNZXRob2RzTWFwcGluZ1tiaW5dO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGZsYXR0ZW5BcmdzPFQ+KEFsbG9jYXRlRm5Pck90aGVyOiAoVCB8IEFsbG9jYXRvckZ1bmN0aW9uKVtdLCByZXNldGVyczogUmVzZXRGdW5jdGlvbltdKSB7XG5cdGNvbnN0IGFyZ3NXcml0ZXI6IFRbXSA9IFtdO1xuXHRmb3IgKGNvbnN0IGFmb3Igb2YgQWxsb2NhdGVGbk9yT3RoZXIpIHtcblx0XHRpZiAoJ2FsbG9jYXRlJyBpbiBhZm9yKSB7XG5cdFx0XHRjb25zdCB3cml0ZXIgPSBhZm9yKCk7XG5cdFx0XHRmb3IgKGxldCBqID0gMDsgaiA8IGFmb3IuYWxsb2NhdGU7IGorKykge1xuXHRcdFx0XHRhcmdzV3JpdGVyLnB1c2god3JpdGVyKTtcblx0XHRcdH1cblx0XHRcdGlmICh3cml0ZXIucmVzZXQpIHtcblx0XHRcdFx0cmVzZXRlcnMucHVzaCh3cml0ZXIucmVzZXQpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRhcmdzV3JpdGVyLnB1c2goYWZvcik7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBhcmdzV3JpdGVyO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdXcml0ZXIoaW5kZXg6IG51bWJlciwgbmFtZTogc3RyaW5nLCBzZW5kOiBTZW5kLCBzdGF0ZTogUmVtb3RlU3RhdGUsIG9uU2VuZDogT25TZW5kKSB7XG5cdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRjb25zdCBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBhcmdzID0gW2luZGV4XTtcblx0XHRcdGZvciAobGV0IGogPSAwOyBqIDwgbGVuOyBqKyspIHtcblx0XHRcdFx0YXJncy5wdXNoKGFyZ3VtZW50c1tqXSk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBqc29uID0gSlNPTi5zdHJpbmdpZnkoYXJncyk7XG5cdFx0XHRzZW5kKGpzb24pO1xuXHRcdFx0c3RhdGUuc2VudFNpemUgKz0ganNvbi5sZW5ndGg7XG5cdFx0XHRvblNlbmQoaW5kZXgsIG5hbWUsIGpzb24ubGVuZ3RoLCBmYWxzZSk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGNhdGNoKF8pIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH07XG59XG5cbmZ1bmN0aW9uIGdldEJ1ZmZlcih3cml0ZXI6IEJpbmFyeVdyaXRlciwgdXNlQnVmZmVyOiB0cnVlKTogQnVmZmVyO1xuZnVuY3Rpb24gZ2V0QnVmZmVyKHdyaXRlcjogQmluYXJ5V3JpdGVyLCB1c2VCdWZmZXI6IGZhbHNlIHwgdW5kZWZpbmVkKTogVWludDhBcnJheTtcbmZ1bmN0aW9uIGdldEJ1ZmZlcih3cml0ZXI6IEJpbmFyeVdyaXRlciwgdXNlQnVmZmVyOiB0cnVlIHwgZmFsc2UgfCB1bmRlZmluZWQpIHtcblx0aWYgKHVzZUJ1ZmZlcikge1xuXHRcdHJldHVybiBCdWZmZXIuZnJvbSh3cml0ZXIudmlldy5idWZmZXIsIHdyaXRlci52aWV3LmJ5dGVPZmZzZXQsIHdyaXRlci5vZmZzZXQpO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBuZXcgVWludDhBcnJheSh3cml0ZXIudmlldy5idWZmZXIsIHdyaXRlci52aWV3LmJ5dGVPZmZzZXQsIHdyaXRlci5vZmZzZXQpO1xuXHR9XG59XG5mdW5jdGlvbiBnZXRCdWZmZXJMZW4oYnVmZmVyOiBVaW50OEFycmF5LCB1c2VCdWZmZXI6IGZhbHNlIHwgdW5kZWZpbmVkKTogbnVtYmVyO1xuZnVuY3Rpb24gZ2V0QnVmZmVyTGVuKGJ1ZmZlcjogQnVmZmVyLCB1c2VCdWZmZXI6IHRydWUpOiBudW1iZXI7XG5mdW5jdGlvbiBnZXRCdWZmZXJMZW4oYnVmZmVyOiBCdWZmZXIgfCBVaW50OEFycmF5LCB1c2VCdWZmZXI6IHRydWUgfCBmYWxzZSB8IHVuZGVmaW5lZCkge1xuXHRpZih1c2VCdWZmZXIpIHtcblx0XHRyZXR1cm4gKGJ1ZmZlciBhcyBCdWZmZXIpLmxlbmd0aDtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gKGJ1ZmZlciBhcyBVaW50OEFycmF5KS5ieXRlTGVuZ3RoO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNyZWF0ZVJlbW90ZUhhbmRsZXIobWV0aG9kc0RlZjogTWV0aG9kRGVmW10sIGhhbmRsZXJPcHRpb25zOiBIYW5kbGVyT3B0aW9ucyk6IENyZWF0ZVJlbW90ZUhhbmRsZXIge1xuXHRjb25zdCBtZXRob2RzID0gZ2V0TWV0aG9kc0RlZkFycmF5KG1ldGhvZHNEZWYpO1xuXHRyZXR1cm4gKHJlbW90ZSwgc2VuZCwgc3RhdGUsIG9wdGlvbnMsIHdyaXRlcikgPT4ge1xuXHRcdGNvbnN0IG9uU2VuZCA9IG9wdGlvbnMub25TZW5kIHx8IGZ1bmN0aW9uICgpIHt9O1xuXHRcdGNvbnN0IHN0cmluZ3MgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbWV0aG9kcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgbmFtZSA9IG1ldGhvZHNbaV1bMF07XG5cdFx0XHRjb25zdCBvcHRpb25zID0gbWV0aG9kc1tpXVsxXTtcblx0XHRcdGNvbnN0IHN0cmluZ0RlY29kZXIgPSBzdHJpbmdXcml0ZXIoaSwgbmFtZSwgc2VuZCwgc3RhdGUsIG9uU2VuZCk7XG5cdFx0XHRpZiAob3B0aW9ucy5iaW5hcnkpIHtcblx0XHRcdFx0Y29uc3QgcmVzZXRlcnM6ICgoKSA9PiB2b2lkKVtdID0gW107XG5cdFx0XHRcdGNvbnN0IGFyZ3NXcml0ZXIgPSBmbGF0dGVuQXJncyhvcHRpb25zLmJpbmFyeS5tYXAoY3JlYXRlQmluV3JpdGVGaWVsZCksIHJlc2V0ZXJzKTtcblx0XHRcdFx0Y29uc3QgcmVzZXQgPSByZXNldGVycy5sZW5ndGggPyAoKSA9PiByZXNldGVycy5mb3JFYWNoKGYgPT4gZigpKSA6IG5vb3A7XG5cdFx0XHRcdGNvbnN0IGxlbiA9IGFyZ3NXcml0ZXIubGVuZ3RoO1xuXHRcdFx0XHRyZW1vdGVbbmFtZV0gPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRpZiAoc3RhdGUuc3VwcG9ydHNCaW5hcnkpIHtcblx0XHRcdFx0XHRcdHdoaWxlICh0cnVlKSB7XG5cdFx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdFx0cmVzZXQoKTtcblx0XHRcdFx0XHRcdFx0XHRzdHJpbmdzLmNsZWFyKCk7XG5cdFx0XHRcdFx0XHRcdFx0d3JpdGVyLm9mZnNldCA9IDA7XG5cdFx0XHRcdFx0XHRcdFx0d3JpdGVVaW50OCh3cml0ZXIsIGkpO1xuXHRcdFx0XHRcdFx0XHRcdGZvciAobGV0IGogPSAwOyBqIDwgbGVuOyBqKyspIHtcblx0XHRcdFx0XHRcdFx0XHRcdGFyZ3NXcml0ZXJbal0od3JpdGVyLCBhcmd1bWVudHNbal0sIHN0cmluZ3MpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRjb25zdCBidWZmZXIgPSBnZXRCdWZmZXIod3JpdGVyLCBoYW5kbGVyT3B0aW9ucy51c2VCdWZmZXIgYXMgYW55KTtcblx0XHRcdFx0XHRcdFx0XHRzZW5kKGJ1ZmZlcik7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgYnVmTGVuID0gZ2V0QnVmZmVyTGVuKGJ1ZmZlciwgaGFuZGxlck9wdGlvbnMudXNlQnVmZmVyIGFzIGFueSk7XG5cdFx0XHRcdFx0XHRcdFx0c3RhdGUuc2VudFNpemUgKz0gYnVmTGVuO1xuXHRcdFx0XHRcdFx0XHRcdG9uU2VuZChpLCBuYW1lLCBidWZMZW4sIHRydWUpO1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChpc1NpemVFcnJvcihlcnJvcikpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHJlc2l6ZVdyaXRlcih3cml0ZXIpO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiBzdHJpbmdEZWNvZGVyO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblx0XHRcdFx0Ly8gcmVtb3RlW25hbWVdLmRlYnVnID0gYXJnc1dyaXRlcjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmIChoYW5kbGVyT3B0aW9ucy51c2VCaW5hcnlCeURlZmF1bHQgfHwgaGFuZGxlck9wdGlvbnMuZm9yY2VCaW5hcnkgfHwgaXNCaW5hcnlPbmx5UGFja2V0KG1ldGhvZHNEZWZbaV0pKSB7XG5cdFx0XHRcdFx0cmVtb3RlW25hbWVdID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCdPbmx5IGJpbmFyeSBwcm90b2NvbCBzdXBwb3J0ZWQnKTtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlbW90ZVtuYW1lXSA9IHN0cmluZ0RlY29kZXI7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH07XG59XG5cbiJdLCJzb3VyY2VSb290IjoiL2hvbWUvYWxwaGEvRGVza3RvcC9kZXYvdGMtc29ja2V0cy9zcmMifQ==
