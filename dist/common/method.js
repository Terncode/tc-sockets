"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMethods = exports.getMethodMetadata = exports.Method = void 0;
var methodMetadata = new Map();
function Method(options) {
    if (options === void 0) { options = {}; }
    return function (target, name) {
        var meta = methodMetadata.get(target.constructor) || [];
        meta.push({ name: name, options: options });
        methodMetadata.set(target.constructor, meta);
    };
}
exports.Method = Method;
function getMethodMetadata(ctor) {
    return methodMetadata.get(ctor);
}
exports.getMethodMetadata = getMethodMetadata;
function generateMethodMetadata(prototype) {
    return Object.keys(prototype)
        .filter(function (k) { return k !== 'connected' && k !== 'disconnected' && k !== 'connectionError' && typeof prototype[k] === 'function'; })
        .map(function (name) { return ({ name: name, options: {} }); });
}
function getMethods(ctor) {
    return getMethodMetadata(ctor) || generateMethodMetadata(ctor.prototype);
}
exports.getMethods = getMethods;
