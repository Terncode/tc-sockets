"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeWithResize = exports.isSizeError = exports.writeAny = exports.writeStringValue = exports.writeBytes = exports.writeBytesRangeView = exports.writeBytesRange = exports.writeFloat64 = exports.writeFloat32 = exports.writeUint32 = exports.writeInt32 = exports.writeUint16 = exports.writeInt16 = exports.writeUint8 = exports.writeInt8 = exports.resizeWriter = exports.resetWriter = exports.getWriterBuffer = exports.writeLength = exports.writeArray = exports.writeArrayHeader = exports.writeArrayBuffer = exports.writeUint8Array = exports.writeObject = exports.writeString = exports.writeBoolean = exports.createBinaryWriter = void 0;
var utf8_1 = require("../common/utf8");
function createBinaryWriter(bufferOrSize) {
    if (bufferOrSize === void 0) { bufferOrSize = 32; }
    var buf = typeof bufferOrSize === 'number' ? new ArrayBuffer(bufferOrSize) : bufferOrSize;
    var view = buf instanceof Uint8Array ? new DataView(buf.buffer, buf.byteOffset, buf.byteLength) : new DataView(buf);
    return { view: view, offset: 0 };
}
exports.createBinaryWriter = createBinaryWriter;
function writeBoolean(writer, value) {
    writeUint8(writer, value ? 1 : 0);
}
exports.writeBoolean = writeBoolean;
function writeString(writer, value) {
    if (value == null) {
        writeNullLength(writer);
    }
    else {
        writeLength(writer, (0, utf8_1.stringLengthInBytes)(value));
        writeStringValue(writer, value);
    }
}
exports.writeString = writeString;
function writeObject(writer, value) {
    writeAny(writer, value, new Map());
}
exports.writeObject = writeObject;
function writeUint8Array(writer, value) {
    if (value == null) {
        writeNullLength(writer);
    }
    else if (value instanceof Uint8Array) {
        writeLength(writer, value.byteLength);
        writeBytes(writer, value);
    }
    else {
        throw new Error('Value is not Uint8Array');
    }
}
exports.writeUint8Array = writeUint8Array;
function writeArrayBuffer(writer, value) {
    if (value == null) {
        writeNullLength(writer);
    }
    else if (value instanceof ArrayBuffer) {
        writeLength(writer, value.byteLength);
        writeBytes(writer, new Uint8Array(value));
    }
    else {
        throw new Error('Value is not ArrayBuffer');
    }
}
exports.writeArrayBuffer = writeArrayBuffer;
function writeArrayHeader(writer, value) {
    if (value == null) {
        writeNullLength(writer);
        return false;
    }
    else {
        writeLength(writer, value.length);
        return true;
    }
}
exports.writeArrayHeader = writeArrayHeader;
function writeArray(writer, value, writeOne) {
    if (writeArrayHeader(writer, value)) {
        for (var i = 0; i < value.length; i++) {
            writeOne(writer, value[i]);
        }
    }
}
exports.writeArray = writeArray;
function writeNullLength(writer) {
    writeUint8(writer, 0);
}
function writeLength(writer, value) {
    if (value < -1 || value > 0x7ffffffe)
        throw new Error('Invalid length value');
    value++;
    if (value === 0) {
        writeNullLength(writer);
    }
    else if ((value & 0xffffff80) === 0) {
        writeUint8(writer, value);
    }
    else if ((value & 0xffffc000) === 0) {
        var a = (value & 0x7f) | 0x80;
        var b = value >> 7;
        writeUint16(writer, (b << 8) | a);
    }
    else if ((value & 0xffe00000) === 0) {
        var a = (value & 0x7f) | 0x80;
        var b = ((value >> 7) & 0x7f) | 0x80;
        var c = value >> 14;
        writeUint8(writer, a);
        writeUint16(writer, (c << 8) | b);
    }
    else if ((value & 0xf0000000) === 0) {
        var a = (value & 0x7f) | 0x80;
        var b = ((value >> 7) & 0x7f) | 0x80;
        var c = ((value >> 14) & 0x7f) | 0x80;
        var d = value >> 21;
        writeUint32(writer, (d << 24) | (c << 16) | (b << 8) | a);
    }
    else {
        var a = (value & 0x7f) | 0x80;
        var b = ((value >> 7) & 0x7f) | 0x80;
        var c = ((value >> 14) & 0x7f) | 0x80;
        var d = ((value >> 21) & 0x7f) | 0x80;
        var e = value >> 28;
        writeUint8(writer, a);
        writeUint32(writer, (e << 24) | (d << 16) | (c << 8) | b);
    }
}
exports.writeLength = writeLength;
function getWriterBuffer(_a) {
    var view = _a.view, offset = _a.offset;
    return new Uint8Array(view.buffer, view.byteOffset, offset);
}
exports.getWriterBuffer = getWriterBuffer;
function resetWriter(writer) {
    writer.offset = 0;
}
exports.resetWriter = resetWriter;
function resizeWriter(writer) {
    writer.view = new DataView(new ArrayBuffer(writer.view.byteLength * 2));
    writer.offset = 0;
}
exports.resizeWriter = resizeWriter;
function writeInt8(writer, value) {
    writer.view.setInt8(writer.offset, value | 0);
    writer.offset += 1;
}
exports.writeInt8 = writeInt8;
function writeUint8(writer, value) {
    writer.view.setUint8(writer.offset, value | 0);
    writer.offset += 1;
}
exports.writeUint8 = writeUint8;
function writeInt16(writer, value) {
    writer.view.setInt16(writer.offset, value | 0, true);
    writer.offset += 2;
}
exports.writeInt16 = writeInt16;
function writeUint16(writer, value) {
    writer.view.setUint16(writer.offset, value | 0, true);
    writer.offset += 2;
}
exports.writeUint16 = writeUint16;
function writeInt32(writer, value) {
    writer.view.setInt32(writer.offset, value | 0, true);
    writer.offset += 4;
}
exports.writeInt32 = writeInt32;
function writeUint32(writer, value) {
    writer.view.setUint32(writer.offset, value | 0, true);
    writer.offset += 4;
}
exports.writeUint32 = writeUint32;
function writeFloat32(writer, value) {
    writer.view.setFloat32(writer.offset, +value, true);
    writer.offset += 4;
}
exports.writeFloat32 = writeFloat32;
function writeFloat64(writer, value) {
    writer.view.setFloat64(writer.offset, +value, true);
    writer.offset += 8;
}
exports.writeFloat64 = writeFloat64;
function writeBytesRange(writer, value, offset, length) {
    writeLength(writer, length);
    var view = writer.view;
    if ((writer.offset + length) > view.byteLength) {
        throw new Error('Exceeded DataView size');
    }
    var dst = writer.offset;
    var src = offset;
    for (var dstEnd = dst + length; dst < dstEnd; dst++, src++) {
        view.setUint8(dst, value[src]);
    }
    writer.offset += length;
}
exports.writeBytesRange = writeBytesRange;
function writeBytesRangeView(writer, value, offset, length) {
    writeLength(writer, length);
    var view = writer.view;
    if ((writer.offset + length) > view.byteLength) {
        throw new Error('Exceeded DataView size');
    }
    var dst = writer.offset;
    var src = offset;
    for (var dstEnd = dst + length; dst < dstEnd; dst++, src++) {
        view.setUint8(dst, value.getUint8(src));
    }
    writer.offset += length;
}
exports.writeBytesRangeView = writeBytesRangeView;
function writeBytes(writer, value) {
    if ((writer.offset + value.byteLength) > writer.view.byteLength) {
        throw new Error('Exceeded DataView size');
    }
    var view = writer.view;
    for (var src = 0, length_1 = value.length, dst = writer.offset; src < length_1; src++, dst++) {
        view.setUint8(dst, value[src]);
    }
    writer.offset += value.byteLength;
}
exports.writeBytes = writeBytes;
function writeStringValue(writer, value) {
    writer.offset = (0, utf8_1.encodeStringTo)(writer.view, writer.offset, value);
    if (writer.offset > writer.view.byteLength) {
        throw new Error('Exceeded DataView size');
    }
}
exports.writeStringValue = writeStringValue;
var floats = new Float32Array(1);
function writeShortLength(writer, type, length) {
    if (length < 31) {
        writeUint8(writer, type | length);
        return true;
    }
    else {
        writeUint8(writer, type | 0x1f);
        writeLength(writer, length);
        return false;
    }
}
function writeAny(writer, value, strings) {
    if (value === undefined) {
        writeUint8(writer, 0 /* Type.Special */ | 0 /* Special.Undefined */);
    }
    else if (value === null) {
        writeUint8(writer, 0 /* Type.Special */ | 1 /* Special.Null */);
    }
    else if (value === true) {
        writeUint8(writer, 0 /* Type.Special */ | 2 /* Special.True */);
    }
    else if (value === false) {
        writeUint8(writer, 0 /* Type.Special */ | 3 /* Special.False */);
    }
    else if (typeof value === 'number') {
        if ((value >>> 0) === value) {
            value = value >>> 0;
            if (value & 0xffff0000) {
                writeUint8(writer, 32 /* Type.Number */ | 5 /* NumberType.Uint32 */);
                writeUint32(writer, value);
            }
            else if (value & 0xff00) {
                writeUint8(writer, 32 /* Type.Number */ | 3 /* NumberType.Uint16 */);
                writeUint16(writer, value);
            }
            else if (value & 0xe0) {
                writeUint8(writer, 32 /* Type.Number */ | 1 /* NumberType.Uint8 */);
                writeUint8(writer, value);
            }
            else {
                writeUint8(writer, 160 /* Type.TinyPositiveNumber */ | value);
            }
        }
        else if ((value | 0) === value) {
            value = value | 0;
            if (value > -32 && value <= -1) {
                writeUint8(writer, 192 /* Type.TinyNegativeNumber */ | (-value - 1));
            }
            else if (value >= -128 && value <= 127) {
                writeUint8(writer, 32 /* Type.Number */ | 0 /* NumberType.Int8 */);
                writeInt8(writer, value);
            }
            else if (value >= -32768 && value <= 32767) {
                writeUint8(writer, 32 /* Type.Number */ | 2 /* NumberType.Int16 */);
                writeInt16(writer, value);
            }
            else {
                writeUint8(writer, 32 /* Type.Number */ | 4 /* NumberType.Int32 */);
                writeInt32(writer, value);
            }
        }
        else {
            floats[0] = value;
            if (floats[0] === value) {
                writeUint8(writer, 32 /* Type.Number */ | 6 /* NumberType.Float32 */);
                writeFloat32(writer, value);
            }
            else {
                writeUint8(writer, 32 /* Type.Number */ | 7 /* NumberType.Float64 */);
                writeFloat64(writer, value);
            }
        }
    }
    else if (typeof value === 'string') {
        var index = strings.get(value);
        if (index !== undefined) {
            writeShortLength(writer, 224 /* Type.StringRef */, index);
        }
        else {
            var length_2 = (0, utf8_1.stringLengthInBytes)(value);
            writeShortLength(writer, 64 /* Type.String */, length_2);
            writeStringValue(writer, value);
            strings.set(value, strings.size);
        }
    }
    else if (Array.isArray(value)) {
        var length_3 = value.length;
        writeShortLength(writer, 96 /* Type.Array */, length_3);
        for (var i = 0; i < length_3; i++) {
            writeAny(writer, value[i], strings);
        }
    }
    else if (typeof value === 'object') {
        if (value instanceof Uint8Array) {
            writeUint8(writer, 0 /* Type.Special */ | 4 /* Special.Uint8Array */);
            writeUint8Array(writer, value);
        }
        else {
            var keys = Object.keys(value);
            writeShortLength(writer, 128 /* Type.Object */, keys.length);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var index = strings.get(key);
                if (index === undefined) {
                    writeLength(writer, (0, utf8_1.stringLengthInBytes)(key));
                    writeStringValue(writer, key);
                    if (key) {
                        strings.set(key, strings.size);
                    }
                }
                else {
                    writeLength(writer, 0);
                    writeLength(writer, index);
                }
                writeAny(writer, value[key], strings);
            }
        }
    }
    else {
        throw new Error("Invalid type: ".concat(value));
    }
}
exports.writeAny = writeAny;
function isSizeError(e) {
    if (typeof RangeError !== 'undefined' && e instanceof RangeError)
        return true;
    if (typeof TypeError !== 'undefined' && e instanceof TypeError)
        return true;
    if (typeof IndexSizeError !== 'undefined' && e instanceof IndexSizeError)
        return true;
    if (/DataView/.test(e.message))
        return true;
    return false;
}
exports.isSizeError = isSizeError;
function writeWithResize(writer, write) {
    while (true) {
        try {
            write();
            break;
        }
        catch (e) {
            if (isSizeError(e)) {
                resizeWriter(writer);
            }
            else {
                throw e;
            }
        }
    }
}
exports.writeWithResize = writeWithResize;
