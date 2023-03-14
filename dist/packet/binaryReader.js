"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readAny = exports.readUint8Array = exports.readLength = exports.readObject = exports.readString = exports.readArray = exports.readBoolean = exports.readArrayBuffer = exports.readBytes = exports.readFloat64 = exports.readFloat32 = exports.readUint32 = exports.readInt32 = exports.readUint16 = exports.readInt16 = exports.readUint8 = exports.readInt8 = exports.getBinaryReaderBuffer = exports.createBinaryReaderFromBuffer = exports.createBinaryReader = void 0;
var utf8_1 = require("../common/utf8");
function createBinaryReader(buffer) {
    var view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    var offset = 0;
    return { view: view, offset: offset };
}
exports.createBinaryReader = createBinaryReader;
function createBinaryReaderFromBuffer(buffer, byteOffset, byteLength) {
    var view = new DataView(buffer, byteOffset, byteLength);
    var offset = 0;
    return { view: view, offset: offset };
}
exports.createBinaryReaderFromBuffer = createBinaryReaderFromBuffer;
function getBinaryReaderBuffer(reader) {
    return new Uint8Array(reader.view.buffer, reader.view.byteOffset, reader.view.byteLength);
}
exports.getBinaryReaderBuffer = getBinaryReaderBuffer;
function readInt8(reader) {
    var offset = reader.offset;
    reader.offset += 1;
    return reader.view.getInt8(offset);
}
exports.readInt8 = readInt8;
function readUint8(reader) {
    var offset = reader.offset;
    reader.offset += 1;
    return reader.view.getUint8(offset);
}
exports.readUint8 = readUint8;
function readInt16(reader) {
    var offset = reader.offset;
    reader.offset += 2;
    return reader.view.getInt16(offset, true);
}
exports.readInt16 = readInt16;
function readUint16(reader) {
    var offset = reader.offset;
    reader.offset += 2;
    return reader.view.getUint16(offset, true);
}
exports.readUint16 = readUint16;
function readInt32(reader) {
    var offset = reader.offset;
    reader.offset += 4;
    return reader.view.getInt32(offset, true);
}
exports.readInt32 = readInt32;
function readUint32(reader) {
    var offset = reader.offset;
    reader.offset += 4;
    return reader.view.getUint32(offset, true);
}
exports.readUint32 = readUint32;
function readFloat32(reader) {
    var offset = reader.offset;
    reader.offset += 4;
    return reader.view.getFloat32(offset, true);
}
exports.readFloat32 = readFloat32;
function readFloat64(reader) {
    var offset = reader.offset;
    reader.offset += 8;
    return reader.view.getFloat64(offset, true);
}
exports.readFloat64 = readFloat64;
function readBytes(reader, length) {
    var offset = reader.offset;
    reader.offset += length;
    return new Uint8Array(reader.view.buffer, reader.view.byteOffset + offset, length);
}
exports.readBytes = readBytes;
function readArrayBuffer(reader) {
    var length = readLength(reader);
    if (length === -1)
        return null;
    var offset = reader.offset;
    reader.offset += length;
    return reader.view.buffer.slice(reader.view.byteOffset + offset, offset + length);
}
exports.readArrayBuffer = readArrayBuffer;
function readBoolean(reader) {
    return readUint8(reader) === 1;
}
exports.readBoolean = readBoolean;
function readArray(reader, readOne) {
    var length = readLength(reader);
    if (length === -1)
        return null;
    var result = [];
    for (var i = 0; i < length; i++) {
        result.push(readOne(reader));
    }
    return result;
}
exports.readArray = readArray;
function readString(reader) {
    var length = readLength(reader);
    if (length === -1)
        return null;
    var result = (0, utf8_1.decodeString)(reader.view, reader.offset, length);
    reader.offset += length;
    return result;
}
exports.readString = readString;
function readObject(reader, cloneTypedArrays) {
    if (cloneTypedArrays === void 0) { cloneTypedArrays = false; }
    return readAny(reader, [], cloneTypedArrays);
}
exports.readObject = readObject;
function readLength(reader) {
    var length = 0;
    var shift = 0;
    var b = 0;
    do {
        b = readUint8(reader);
        length = length | ((b & 0x7f) << shift);
        shift += 7;
    } while (b & 0x80);
    return length - 1;
}
exports.readLength = readLength;
function readUint8Array(reader) {
    var length = readLength(reader);
    if (length === -1)
        return null;
    return readBytes(reader, length);
}
exports.readUint8Array = readUint8Array;
function readShortLength(reader, length) {
    return length === 0x1f ? readLength(reader) : length;
}
function readAny(reader, strings, cloneTypedArrays) {
    var byte = readUint8(reader);
    var type = byte & 0xe0;
    var value = byte & 0x1f;
    switch (type) {
        case 0 /* Type.Special */:
            switch (value) {
                case 0 /* Special.Undefined */: return undefined;
                case 1 /* Special.Null */: return null;
                case 2 /* Special.True */: return true;
                case 3 /* Special.False */: return false;
                case 4 /* Special.Uint8Array */: {
                    var value_1 = readUint8Array(reader);
                    if (value_1 && cloneTypedArrays)
                        return value_1.slice();
                    return value_1;
                }
                default: throw new Error("Incorrect value (".concat(value, ", ").concat(byte, ")"));
            }
        case 32 /* Type.Number */:
            switch (value) {
                case 0 /* NumberType.Int8 */: return readInt8(reader);
                case 1 /* NumberType.Uint8 */: return readUint8(reader);
                case 2 /* NumberType.Int16 */: return readInt16(reader);
                case 3 /* NumberType.Uint16 */: return readUint16(reader);
                case 4 /* NumberType.Int32 */: return readInt32(reader);
                case 5 /* NumberType.Uint32 */: return readUint32(reader);
                case 6 /* NumberType.Float32 */: return readFloat32(reader);
                case 7 /* NumberType.Float64 */: return readFloat64(reader);
                default: throw new Error("Incorrect value (".concat(value, ", ").concat(byte, ")"));
            }
        case 160 /* Type.TinyPositiveNumber */:
            return value;
        case 192 /* Type.TinyNegativeNumber */:
            return -(value + 1);
        case 64 /* Type.String */: {
            var length_1 = readShortLength(reader, value);
            var result = (0, utf8_1.decodeString)(reader.view, reader.offset, length_1);
            reader.offset += length_1;
            strings.push(result);
            return result;
        }
        case 224 /* Type.StringRef */: {
            var index = readShortLength(reader, value);
            return strings[index];
        }
        case 96 /* Type.Array */: {
            var length_2 = readShortLength(reader, value);
            var array = [];
            for (var i = 0; i < length_2; i++) {
                array.push(readAny(reader, strings, cloneTypedArrays));
            }
            return array;
        }
        case 128 /* Type.Object */: {
            var length_3 = readShortLength(reader, value);
            var obj = {};
            for (var i = 0; i < length_3; i++) {
                var length_4 = readLength(reader);
                var key = void 0;
                if (length_4) {
                    key = (0, utf8_1.decodeString)(reader.view, reader.offset, length_4);
                    reader.offset += length_4;
                    strings.push(key);
                }
                else {
                    var index = readLength(reader);
                    key = strings[index];
                }
                obj[key] = readAny(reader, strings, cloneTypedArrays);
            }
            return obj;
        }
        default: throw new Error("Incorrect type (".concat(type, ", ").concat(byte, ")"));
    }
}
exports.readAny = readAny;
