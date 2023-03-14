"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIgnore = exports.getMethodsDefArray = exports.getNames = exports.Bin = void 0;
var Bin;
(function (Bin) {
    Bin[Bin["I8"] = 0] = "I8";
    Bin[Bin["U8"] = 1] = "U8";
    Bin[Bin["I16"] = 2] = "I16";
    Bin[Bin["U16"] = 3] = "U16";
    Bin[Bin["I32"] = 4] = "I32";
    Bin[Bin["U32"] = 5] = "U32";
    Bin[Bin["F32"] = 6] = "F32";
    Bin[Bin["F64"] = 7] = "F64";
    Bin[Bin["Bool"] = 8] = "Bool";
    Bin[Bin["Str"] = 9] = "Str";
    Bin[Bin["Obj"] = 10] = "Obj";
    Bin[Bin["Buffer"] = 11] = "Buffer";
    Bin[Bin["U8Array"] = 12] = "U8Array";
    Bin[Bin["Raw"] = 13] = "Raw";
    Bin[Bin["U8ArrayOffsetLength"] = 14] = "U8ArrayOffsetLength";
    Bin[Bin["DataViewOffsetLength"] = 15] = "DataViewOffsetLength";
})(Bin = exports.Bin || (exports.Bin = {}));
function getNames(methods) {
    return methods.map(function (i) { return typeof i === 'string' ? i : i[0]; });
}
exports.getNames = getNames;
function getMethodsDefArray(methods) {
    return methods.map(function (i) { return typeof i === 'string' ? [i, {}] : i; });
}
exports.getMethodsDefArray = getMethodsDefArray;
function getIgnore(methods) {
    return methods.map(function (i) { return (typeof i !== 'string' && i[1].ignore) ? i[0] : null; }).filter(function (x) { return !!x; });
}
exports.getIgnore = getIgnore;
