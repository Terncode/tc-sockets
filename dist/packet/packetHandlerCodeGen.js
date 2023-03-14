"use strict";
// code generation
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRemoteHandlerCode = exports.generateLocalHandlerCode = exports.writerMethods = void 0;
var interfaces_1 = require("../common/interfaces");
var utils_1 = require("../common/utils");
var binaryWriter_1 = require("./binaryWriter");
var binaryReader_1 = require("./binaryReader");
var packetHandler_1 = require("./packetHandler");
var binaryNames = [];
binaryNames[interfaces_1.Bin.I8] = 'Int8';
binaryNames[interfaces_1.Bin.U8] = 'Uint8';
binaryNames[interfaces_1.Bin.I16] = 'Int16';
binaryNames[interfaces_1.Bin.U16] = 'Uint16';
binaryNames[interfaces_1.Bin.I32] = 'Int32';
binaryNames[interfaces_1.Bin.U32] = 'Uint32';
binaryNames[interfaces_1.Bin.F32] = 'Float32';
binaryNames[interfaces_1.Bin.F64] = 'Float64';
binaryNames[interfaces_1.Bin.Bool] = 'Boolean';
binaryNames[interfaces_1.Bin.Str] = 'String';
binaryNames[interfaces_1.Bin.Obj] = 'Any';
binaryNames[interfaces_1.Bin.Buffer] = 'ArrayBuffer';
binaryNames[interfaces_1.Bin.U8Array] = 'Uint8Array';
binaryNames[interfaces_1.Bin.Raw] = 'Bytes';
var readerMethods = {
    readUint8: binaryReader_1.readUint8,
    readInt8: binaryReader_1.readInt8,
    readUint16: binaryReader_1.readUint16,
    readInt16: binaryReader_1.readInt16,
    readUint32: binaryReader_1.readUint32,
    readInt32: binaryReader_1.readInt32,
    readFloat32: binaryReader_1.readFloat32,
    readFloat64: binaryReader_1.readFloat64,
    readBoolean: binaryReader_1.readBoolean,
    readString: binaryReader_1.readString,
    readAny: binaryReader_1.readAny,
    readArrayBuffer: binaryReader_1.readArrayBuffer,
    readUint8Array: binaryReader_1.readUint8Array,
    readArray: binaryReader_1.readArray,
    readBytes: packetHandler_1.readBytesRaw,
    readLength: binaryReader_1.readLength,
};
exports.writerMethods = {
    createWriter: binaryWriter_1.createBinaryWriter,
    resizeWriter: binaryWriter_1.resizeWriter,
    writeUint8: binaryWriter_1.writeUint8,
    writeInt8: binaryWriter_1.writeInt8,
    writeUint16: binaryWriter_1.writeUint16,
    writeInt16: binaryWriter_1.writeInt16,
    writeUint32: binaryWriter_1.writeUint32,
    writeInt32: binaryWriter_1.writeInt32,
    writeFloat32: binaryWriter_1.writeFloat32,
    writeFloat64: binaryWriter_1.writeFloat64,
    writeBoolean: binaryWriter_1.writeBoolean,
    writeString: binaryWriter_1.writeString,
    writeAny: binaryWriter_1.writeAny,
    writeArrayBuffer: binaryWriter_1.writeArrayBuffer,
    writeUint8Array: binaryWriter_1.writeUint8Array,
    writeArrayHeader: binaryWriter_1.writeArrayHeader,
    writeArray: binaryWriter_1.writeArray,
    writeBytes: binaryWriter_1.writeBytes,
    writeBytesRange: binaryWriter_1.writeBytesRange,
    writeBytesRangeView: binaryWriter_1.writeBytesRangeView,
    isSizeError: binaryWriter_1.isSizeError,
};
function generateLocalHandlerCode(methods, remoteNames, _a, onRecv) {
    var debug = _a.debug, printGeneratedCode = _a.printGeneratedCode, useBinaryByDefault = _a.useBinaryByDefault, useBinaryResultByDefault = _a.useBinaryResultByDefault;
    var code = "";
    code += "var strings = [];\n";
    code += "".concat(Object.keys(readerMethods).map(function (key) { return "  var ".concat(key, " = methods.").concat(key, ";"); }).join('\n'), "\n\n");
    code += "  return function (reader, actions, special, callsList, messageId, handleResult) {\n";
    code += "    strings.length = 0;\n";
    code += "    var packetId = readUint8(reader);\n";
    code += "    switch (packetId) {\n";
    var packetId = 0;
    for (var _i = 0, methods_1 = methods; _i < methods_1.length; _i++) {
        var method = methods_1[_i];
        var name_1 = typeof method === 'string' ? method : method[0];
        var options = typeof method === 'string' ? {} : method[1];
        var binaryResult = options.binaryResult || useBinaryResultByDefault;
        var args = [];
        code += "      case ".concat(packetId, ": {\n");
        if (options.binary || useBinaryByDefault) {
            if (options.rateLimit || options.serverRateLimit) {
                var _b = options.serverRateLimit ? (0, utils_1.parseRateLimit)(options.serverRateLimit, false) : (0, utils_1.parseRateLimit)(options.rateLimit, true), limit = _b.limit, frame = _b.frame;
                code += "        if (!checkRateLimit(".concat(packetId, ", callsList, ").concat(limit, ", ").concat(frame, ")) ");
                if (options.promise) {
                    code += "handleResult(".concat(packetId, ", '").concat(name_1, "', ").concat(binaryResult ? 'true' : 'false', ", Promise.reject(new Error('Rate limit exceeded')), messageId);\n");
                }
                else {
                    code += "throw new Error('Rate limit exceeded (".concat(name_1, ")');\n");
                }
            }
            if (options.binary) {
                code += createReadFunction(options.binary, '        ');
                for (var i = 0, j = 0; i < options.binary.length; i++, j++) {
                    if (options.binary[i] === interfaces_1.Bin.U8ArrayOffsetLength || options.binary[i] === interfaces_1.Bin.DataViewOffsetLength) {
                        args.push(j++, j++);
                    }
                    args.push(j);
                }
            }
            else {
                code += createReadFunction([interfaces_1.Bin.Obj], '        ');
                args.push(0);
            }
            var argList = args.map(function (i) { return "a".concat(i); }).join(', ');
            if (debug) {
                code += "        console.log('RECV [' + reader.view.byteLength + '] (bin)', '".concat(name_1, "', [").concat(argList, "]);\n");
            }
            code += "        onRecv(".concat(packetId, ", '").concat(name_1, "', reader.view.byteLength, true, reader.view, actions);\n");
            var call = options.binary ? "actions.".concat(name_1, "(").concat(argList, ")") : "actions.".concat(name_1, ".apply(actions, ").concat(argList, ")");
            if (options.promise) {
                code += "        var result = ".concat(call, ";\n");
                code += "        handleResult(".concat(packetId, ", '").concat(name_1, "', ").concat(binaryResult ? 'true' : 'false', ", result, messageId);\n");
            }
            else {
                code += "        ".concat(call, ";\n");
            }
            code += "        break;\n";
        }
        else {
            code += "        throw new Error('Missing binary decoder for: ".concat(name_1, " (").concat(packetId, ")');\n");
        }
        code += "      }\n";
        packetId++;
    }
    code += "      case ".concat(255 /* MessageType.Version */, ":\n");
    code += "      case ".concat(252 /* MessageType.Error */, ":\n");
    code += "      case ".concat(254 /* MessageType.Resolved */, ":\n");
    code += "      case ".concat(253 /* MessageType.Rejected */, ": {\n");
    code += "        const funcId = readUint8(reader);\n";
    code += "        const messageId = readUint32(reader);\n";
    code += "        const result = readAny(reader, strings);\n";
    code += "        if (packetId === ".concat(255 /* MessageType.Version */, ") {\n");
    code += "          special['*version'](result);\n";
    code += "        } else if (packetId === ".concat(252 /* MessageType.Error */, ") {\n");
    code += "          special['*error'](result);\n";
    code += "        } else if (packetId === ".concat(254 /* MessageType.Resolved */, ") {\n");
    code += "          special['*resolve:' + remoteNames[funcId]](messageId, result);\n";
    code += "        } else if (packetId === ".concat(253 /* MessageType.Rejected */, ") {\n");
    code += "          special['*reject:' + remoteNames[funcId]](messageId, result);\n";
    code += "        } else {\n";
    code += "          throw new Error('Missing handling for packet ID: ' + packetId);\n";
    code += "        }\n";
    code += "        break;\n";
    code += "      }\n";
    code += "      default:\n";
    code += "        throw new Error('Invalid packet ID: ' + packetId);\n";
    code += "    };\n";
    code += "  };\n";
    if (printGeneratedCode) {
        console.log("\n\nfunction createRecvHandler(methods, checkRateLimit, onRecv) {\n".concat(code, "}\n"));
    }
    return new Function('methods', 'remoteNames', 'checkRateLimit', 'onRecv', code)(readerMethods, remoteNames, utils_1.checkRateLimit3, onRecv);
}
exports.generateLocalHandlerCode = generateLocalHandlerCode;
function generateRemoteHandlerCode(methods, handlerOptions) {
    var _a;
    var code = "";
    code += "".concat(Object.keys(exports.writerMethods).map(function (key) { return "  var ".concat(key, " = methods.").concat(key, ";"); }).join('\n'), "\n");
    code += "  var log = remoteOptions.log || function () {};\n";
    code += "  var onSend = remoteOptions.onSend || function () {};\n";
    code += "  var strings = new Map();\n\n";
    var packetId = 0;
    var bufferCtor = handlerOptions.useBuffer ? 'Buffer.from' : 'new Uint8Array';
    var bufferLength = handlerOptions.useBuffer ? 'length' : 'byteLength';
    for (var _i = 0, methods_2 = methods; _i < methods_2.length; _i++) {
        var method = methods_2[_i];
        var name_2 = typeof method === 'string' ? method : method[0];
        var options = typeof method === 'string' ? {} : method[1];
        var args = [];
        if (options.binary) {
            for (var i = 0, j = 0; i < options.binary.length; i++) {
                if (options.binary[i] === interfaces_1.Bin.U8ArrayOffsetLength || options.binary[i] === interfaces_1.Bin.DataViewOffsetLength) {
                    args.push("a".concat(j++), "a".concat(j++));
                }
                args.push("a".concat(j++));
            }
        }
        code += "  remote.".concat(name_2, " = function (").concat(args.join(', '), ") {\n");
        var catchError = !(handlerOptions.debug || handlerOptions.development);
        if (catchError) {
            code += "    try {\n";
        }
        var space = handlerOptions.debug ? '  ' : '  ';
        var indent = options.binary ? space.repeat(3) : space;
        if (options.binary || handlerOptions.useBinaryByDefault) {
            code += "".concat(indent, "if (remoteState.supportsBinary) {\n");
            code += "".concat(indent, "  while (true) {\n");
            code += "".concat(indent, "    try {\n");
            code += "".concat(indent, "      strings.clear();\n");
            code += "".concat(indent, "      writer.offset = 0;\n");
            if (!options.binary) {
                code += "".concat(indent, "      var a0 = [];\n");
                code += "".concat(indent, "      for (var i = 0; i < arguments.length; i++) a0.push(arguments[i]);\n");
            }
            code += createWriteFunction(packetId, (_a = options.binary) !== null && _a !== void 0 ? _a : [interfaces_1.Bin.Obj], "".concat(indent, "      "));
            code += "".concat(indent, "      var buffer = ").concat(bufferCtor, "(writer.view.buffer, writer.view.byteOffset, writer.offset);\n");
            code += "".concat(indent, "      send(buffer);\n");
            code += "".concat(indent, "      remoteState.sentSize += buffer.").concat(bufferLength, ";\n"); // TODO: move from here, just count in send function
            code += "".concat(indent, "      onSend(").concat(packetId, ", '").concat(name_2, "', buffer.").concat(bufferLength, ", true);\n");
            if (handlerOptions.debug && !options.ignore) {
                code += "".concat(indent, "      log('SEND [' + buffer.").concat(bufferLength, " + '] (bin) \"").concat(name_2, "\"', arguments);\n");
            }
            code += "".concat(indent, "      break;\n");
            code += "".concat(indent, "    } catch (e) {\n");
            code += "".concat(indent, "      if (isSizeError(e)) {\n");
            code += "".concat(indent, "        resizeWriter(writer);\n");
            code += "".concat(indent, "      } else {\n");
            if (catchError) {
                code += "".concat(indent, "        return false;\n");
            }
            else {
                code += "".concat(indent, "        throw e;\n");
            }
            code += "".concat(indent, "      }\n");
            code += "".concat(indent, "    }\n");
            code += "".concat(indent, "  }\n");
            code += "".concat(indent, "} else {\n");
        }
        if (handlerOptions.useBinaryByDefault || handlerOptions.forceBinary || (0, utils_1.isBinaryOnlyPacket)(method)) {
            code += "".concat(indent, "  console.error('Only binary protocol supported');\n");
            code += "".concat(indent, "  return false;\n");
        }
        else {
            code += "".concat(indent, "  var args = [").concat(packetId, "];\n");
            code += "".concat(indent, "  for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);\n");
            code += "".concat(indent, "  var json = JSON.stringify(args);\n");
            code += "".concat(indent, "  send(json);\n");
            code += "".concat(indent, "  remoteState.sentSize += json.length;\n"); // TODO: move from here, just count in send function
            code += "".concat(indent, "  onSend(").concat(packetId, ", '").concat(name_2, "', json.length, false);\n");
            if (handlerOptions.debug && !options.ignore) {
                code += "".concat(indent, "  log('SEND [' + json.length + '] (json) \"").concat(name_2, "\"', arguments);\n");
            }
        }
        if (options.binary || handlerOptions.useBinaryByDefault) {
            code += "".concat(indent, "}\n");
        }
        if (catchError) {
            code += "    } catch (e) {\n";
            code += "      return false;\n";
            code += "    }\n";
        }
        code += "    return true;\n";
        code += "  };\n";
        packetId++;
    }
    if (handlerOptions.printGeneratedCode) {
        console.log("\n\nfunction createSendHandler(remote, send, removeState, remoteOptions, methods, writer) {\n".concat(code, "}\n"));
    }
    return new Function('remote', 'send', 'remoteState', 'remoteOptions', 'methods', 'writer', code);
}
exports.generateRemoteHandlerCode = generateRemoteHandlerCode;
var id = 0;
function writeField(f, n, indent) {
    if (Array.isArray(f)) {
        var thisId = ++id;
        var it_1 = "i".concat(thisId);
        var array = "array".concat(thisId);
        var item = "item".concat(thisId);
        var code = '';
        code += "".concat(indent, "var ").concat(array, " = ").concat(n, ";\n");
        code += "".concat(indent, "if (writeArrayHeader(writer, ").concat(array, ")) {\n");
        code += "".concat(indent, "  for(var ").concat(it_1, " = 0; ").concat(it_1, " < ").concat(array, ".length; ").concat(it_1, "++) {\n");
        code += "".concat(indent, "    var ").concat(item, " = ").concat(array, "[").concat(it_1, "];\n");
        if (f.length === 1) {
            code += writeField(f[0], item, indent + '    ');
        }
        else {
            for (var i = 0; i < f.length; i++) {
                code += writeField(f[i], "".concat(item, "[").concat(i, "]"), indent + '    ');
            }
        }
        code += "".concat(indent, "  }\n");
        code += "".concat(indent, "}\n");
        return code;
    }
    else {
        return "".concat(indent, "write").concat(binaryNames[f], "(writer, ").concat(n).concat(f === interfaces_1.Bin.Obj ? ', strings' : '', ");\n");
    }
}
function createWriteFunction(id, fields, indent) {
    var code = "".concat(indent, "writeUint8(writer, ").concat(id, ");\n");
    for (var i = 0, j = 0; i < fields.length; i++, j++) {
        if (fields[i] === interfaces_1.Bin.U8ArrayOffsetLength) {
            code += "".concat(indent, "writeBytesRange(writer, a").concat(j, ", a").concat(j + 1, ", a").concat(j + 2, ");\n");
            j += 2;
        }
        else if (fields[i] === interfaces_1.Bin.DataViewOffsetLength) {
            code += "".concat(indent, "writeBytesRangeView(writer, a").concat(j, ", a").concat(j + 1, ", a").concat(j + 2, ");\n");
            j += 2;
        }
        else {
            code += writeField(fields[i], "a".concat(j), indent);
        }
    }
    return code;
}
function readField(f, indent) {
    if (f instanceof Array) {
        var code = '';
        if (f.length === 1) {
            code += "\n".concat(indent, "  ").concat(readField(f[0], indent + '  '), "\n").concat(indent);
        }
        else {
            code += '[\n';
            for (var i = 0; i < f.length; i++) {
                code += "".concat(indent, "  ").concat(readField(f[i], indent + '  '), ",\n");
            }
            code += "".concat(indent, "]");
        }
        return "readArray(reader, function (reader) { return ".concat(code.trim(), "; })");
    }
    else {
        return "read".concat(binaryNames[f], "(reader").concat(f === interfaces_1.Bin.Obj ? ', strings, false' : '', ")");
    }
}
function createReadFunction(fields, indent) {
    var code = '';
    for (var i = 0, j = 0; i < fields.length; i++, j++) {
        if (fields[i] === interfaces_1.Bin.U8ArrayOffsetLength) {
            code += "".concat(indent, "var a").concat(j, " = readUint8Array(reader);\n");
            code += "".concat(indent, "var a").concat(j + 1, " = 0;\n");
            code += "".concat(indent, "var a").concat(j + 2, " = a").concat(j, ".byteLength;\n");
            j += 2;
        }
        else if (fields[i] === interfaces_1.Bin.DataViewOffsetLength) {
            code += "".concat(indent, "var a").concat(j, " = null, a").concat(j + 1, " = 0, a").concat(j + 2, " = 0;\n");
            code += "".concat(indent, "var a").concat(j, "_len = readLength(reader);\n");
            code += "".concat(indent, "if (a").concat(j, "_len !== -1) {\n");
            code += "".concat(indent, "  a").concat(j, " = reader.view;\n");
            code += "".concat(indent, "  a").concat(j + 1, " = reader.offset;\n");
            code += "".concat(indent, "  a").concat(j + 2, " = a").concat(j, "_len;\n");
            code += "".concat(indent, "  reader.offset += a").concat(j, "_len;\n");
            code += "".concat(indent, "};\n");
            j += 2;
        }
        else {
            code += "".concat(indent, "var a").concat(j, " = ").concat(readField(fields[i], indent), ";\n");
        }
    }
    return code;
}
