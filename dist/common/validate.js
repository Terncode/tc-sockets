"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValid = void 0;
var interfaces_1 = require("./interfaces");
function isNumber(value) {
    return typeof value === 'number';
}
function isInt(min, max) {
    return function (value) { return isNumber(value) && ((value | 0) === value) && value >= min && value <= max; };
}
function isUint(max) {
    return function (value) { return isNumber(value) && ((value >>> 0) === value) && value >= 0 && value <= max; };
}
var validators = [];
validators[interfaces_1.Bin.U8] = isUint(0xff);
validators[interfaces_1.Bin.I8] = isInt(-128, 127);
validators[interfaces_1.Bin.U16] = isUint(0xffff);
validators[interfaces_1.Bin.I16] = isInt(-32768, 32767);
validators[interfaces_1.Bin.U32] = isUint(0xffffffff);
validators[interfaces_1.Bin.I32] = isInt(-2147483648, 2147483647);
validators[interfaces_1.Bin.F32] = function (value) { return isNumber(value); };
validators[interfaces_1.Bin.F64] = function (value) { return isNumber(value); };
validators[interfaces_1.Bin.Bool] = function (value) { return value === true || value === false; };
validators[interfaces_1.Bin.Str] = function (value) { return value === null || typeof value === 'string'; };
validators[interfaces_1.Bin.Obj] = function (value) { return value === null || typeof value === 'object'; };
function isValid(value, def) {
    if (Array.isArray(def)) {
        if (!Array.isArray(value))
            return false;
        if (def.length === 1) {
            return value.every(function (v) { return isValid(v, def[0]); });
        }
        else {
            return value.every(function (v) {
                if (!v || v.length !== def.length)
                    return false;
                for (var i = 0; i < def.length; i++) {
                    if (!isValid(v[i], def[i]))
                        return false;
                }
                return true;
            });
        }
    }
    else {
        return validators[def](value);
    }
}
exports.isValid = isValid;
