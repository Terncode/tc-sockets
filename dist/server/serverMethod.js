"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSocketMetadata = exports.Socket = void 0;
var socketServerMetadata = new Map();
function Socket(options) {
    if (options === void 0) { options = {}; }
    return function (target) {
        socketServerMetadata.set(target, options);
    };
}
exports.Socket = Socket;
function getSocketMetadata(ctor) {
    return socketServerMetadata.get(ctor);
}
exports.getSocketMetadata = getSocketMetadata;
