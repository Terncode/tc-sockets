"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCodeGenHandlers = void 0;
var packetHandlerCodeGen_1 = require("./packet/packetHandlerCodeGen");
function createCodeGenHandlers(codeGenOptions) {
    return {
        createLocalHandler: function (methodsDef, remoteNames, onRecv, useBinaryResultByDefault) {
            return (0, packetHandlerCodeGen_1.generateLocalHandlerCode)(methodsDef, remoteNames, __assign({ useBinaryResultByDefault: useBinaryResultByDefault }, codeGenOptions), onRecv);
        },
        createRemoteHandler: function (methodsDef, handlerOptions) {
            var createRemoteHandler = (0, packetHandlerCodeGen_1.generateRemoteHandlerCode)(methodsDef, __assign(__assign({}, handlerOptions), codeGenOptions));
            return function (remote, send, state, options, writer) {
                createRemoteHandler(remote, send, state, options, packetHandlerCodeGen_1.writerMethods, writer);
            };
        }
    };
}
exports.createCodeGenHandlers = createCodeGenHandlers;
