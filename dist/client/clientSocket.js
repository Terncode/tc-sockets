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
exports.createClientSocket = void 0;
var utils_1 = require("../common/utils");
var packetHandler_1 = require("../packet/packetHandler");
var binaryReader_1 = require("../packet/binaryReader");
var defaultErrorHandler = {
    handleRecvError: function (error) {
        throw error;
    }
};
function createClientSocket(originalOptions, token, errorHandler, apply, log, customHandlers) {
    if (errorHandler === void 0) { errorHandler = defaultErrorHandler; }
    if (apply === void 0) { apply = function (f) { return f(); }; }
    if (log === void 0) { log = console.log.bind(console); }
    if (customHandlers === void 0) { customHandlers = undefined; }
    var special = {};
    var defers = new Map();
    var inProgressFields = {};
    var convertToArrayBuffer = typeof navigator !== 'undefined' && /MSIE 10|Trident\/7/.test(navigator.userAgent);
    var now = typeof performance !== 'undefined' ? function () { return performance.now(); } : function () { return Date.now(); };
    var copySendBuffer = originalOptions.copySendBuffer;
    var callsLists = [];
    var rateLimits = originalOptions.server.map(function () { return undefined; });
    var pingBuffer = new ArrayBuffer(0);
    var supportsBinary = (0, utils_1.supportsBinary)();
    var socket = null;
    var connecting = false;
    var reconnectTimeout;
    var pingInterval;
    var lastSend = 0;
    var packet = undefined;
    var remote = undefined;
    var lastSentId = 0;
    var versionValidated = false;
    var lastTokenRefresh = now();
    var clientSocket = {
        client: {},
        server: {},
        sentSize: 0,
        receivedSize: 0,
        sentPackets: 0,
        receivedPackets: 0,
        lastPacket: 0,
        isConnected: false,
        supportsBinary: supportsBinary,
        options: originalOptions,
        connect: connect,
        disconnect: disconnect,
        socket: function () { return socket; },
    };
    originalOptions.server.forEach(function (item, id) {
        if (typeof item === 'string') {
            createMethod(item, id, {});
        }
        else {
            createMethod(item[0], id, item[1]);
            if (item[1].rateLimit) {
                rateLimits[id] = __assign({ promise: false }, (0, utils_1.parseRateLimit)(item[1].rateLimit, false));
            }
        }
    });
    special['*version'] = function (version) {
        var _a, _b, _c, _d;
        if (version === clientSocket.options.hash) {
            versionValidated = true;
            lastSentId = 0;
            clientSocket.isConnected = true;
            // notify server of binary support
            if (supportsBinary)
                send(pingBuffer);
            (_b = (_a = clientSocket.client).connected) === null || _b === void 0 ? void 0 : _b.call(_a);
        }
        else {
            disconnect();
            (_d = (_c = clientSocket.client).connectionError) === null || _d === void 0 ? void 0 : _d.call(_c, "invalid version (expected: ".concat(version, ", actual: ").concat(clientSocket.options.hash, ")"));
        }
    };
    special['*error'] = function (error) {
        var _a, _b;
        (_b = (_a = clientSocket.client).connectionError) === null || _b === void 0 ? void 0 : _b.call(_a, error);
    };
    function beforeunload() {
        if (socket) {
            try {
                socket.onclose = function () { };
                socket.close();
                socket = null;
            }
            catch (_a) { }
        }
    }
    function getWebsocketUrl() {
        var options = clientSocket.options;
        var protocol = (options.ssl || location.protocol === 'https:') ? 'wss://' : 'ws://';
        var host = options.host || location.host;
        var path = options.path || '/ws';
        var id = options.id || 'socket';
        var query = (0, utils_1.queryString)(__assign(__assign({}, options.requestParams), { id: id, t: token, bin: supportsBinary, hash: options.hash }));
        return "".concat(protocol).concat(host).concat(path).concat(query);
    }
    function connect() {
        connecting = true;
        if (socket)
            return;
        var options = clientSocket.options;
        var theSocket = socket = new WebSocket(getWebsocketUrl());
        var mockCallsList = [];
        window.addEventListener('beforeunload', beforeunload);
        packet = (0, packetHandler_1.createPacketHandler)(options.client, options.server, options, log, customHandlers);
        remote = {};
        packet.createRemote(remote, send, clientSocket);
        supportsBinary = !!theSocket.binaryType;
        theSocket.binaryType = 'arraybuffer';
        theSocket.onmessage = function (message) {
            if (socket !== theSocket)
                return;
            clientSocket.lastPacket = now();
            clientSocket.receivedPackets++;
            var data = message.data;
            if (data && packet && (typeof data === 'string' || data.byteLength > 0)) {
                try {
                    if (typeof data === 'string') {
                        clientSocket.receivedSize += data.length;
                        packet.recvString(data, clientSocket.client, special);
                    }
                    else {
                        clientSocket.receivedSize += data.byteLength;
                        var reader = (0, binaryReader_1.createBinaryReaderFromBuffer)(data, 0, data.byteLength);
                        packet.recvBinary(reader, clientSocket.client, special, mockCallsList, 0);
                    }
                }
                catch (e) {
                    errorHandler.handleRecvError(e, typeof data === 'string' ? data : new Uint8Array(data));
                }
            }
            sendPing(); // need to send ping here because setInterval in unreliable on some browsers when the tab is in the background
        };
        theSocket.onopen = function () {
            if (socket !== theSocket) {
                theSocket.close();
                return;
            }
            clientSocket.lastPacket = now();
            if (options.debug)
                log('socket opened');
            if (options.clientPingInterval) {
                pingInterval = setInterval(sendPing, options.clientPingInterval);
            }
        };
        theSocket.onerror = function (e) {
            if (options.debug)
                log('socket error', e);
        };
        theSocket.onclose = function (e) {
            var _a, _b, _c, _d;
            if (options.debug)
                log('socket closed', e);
            if (socket && socket !== theSocket)
                return;
            socket = null;
            versionValidated = false;
            if (clientSocket.isConnected) {
                lastTokenRefresh = now();
                clientSocket.isConnected = false;
                (_b = (_a = clientSocket.client).disconnected) === null || _b === void 0 ? void 0 : _b.call(_a, e.code, e.reason);
            }
            if (connecting) {
                if (options.tokenLifetime && (lastTokenRefresh + options.tokenLifetime) < now()) {
                    disconnect();
                    (_d = (_c = clientSocket.client).connectionError) === null || _d === void 0 ? void 0 : _d.call(_c, "token expired");
                }
                else {
                    reconnectTimeout = setTimeout(function () {
                        connect();
                        reconnectTimeout = null;
                    }, options.reconnectTimeout);
                }
            }
            defers.forEach(function (d) { return d.reject(new Error("Disconnected (".concat(d.name, ")"))); });
            defers.clear();
            Object.keys(inProgressFields).forEach(function (key) { return inProgressFields[key] = 0; });
            if (pingInterval) {
                clearInterval(pingInterval);
                pingInterval = null;
            }
        };
    }
    function disconnect() {
        connecting = false;
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
        }
        if (socket) {
            if (clientSocket.isConnected) {
                socket.close();
            }
            socket = null;
        }
        window.removeEventListener('beforeunload', beforeunload);
    }
    function send(data) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            // HACK: fix for IE
            if (convertToArrayBuffer && data instanceof Uint8Array) {
                var buffer = new ArrayBuffer(data.byteLength);
                var view = new Uint8Array(buffer);
                view.set(data);
                data = buffer;
            }
            if (copySendBuffer && data instanceof Uint8Array) {
                data = data.slice();
            }
            socket.send(data);
            clientSocket.sentPackets++;
            lastSend = now();
            return true;
        }
        else {
            return false;
        }
    }
    function sendPing() {
        try {
            var now_1 = Date.now();
            if (versionValidated) {
                var interval = clientSocket.options.clientPingInterval;
                if (interval && (now_1 - lastSend) > interval) {
                    send(supportsBinary ? pingBuffer : '');
                }
                var timeout = clientSocket.options.clientConnectionTimeout;
                if (timeout && (now_1 - clientSocket.lastPacket) > timeout) {
                    socket === null || socket === void 0 ? void 0 : socket.close();
                }
            }
        }
        catch (_a) { }
    }
    function createMethod(name, id, options) {
        if (name) {
            if (options.promise) {
                createPromiseMethod(name, id, options.progress);
            }
            else {
                createSimpleMethod(name, id);
            }
        }
    }
    function createSimpleMethod(name, id) {
        clientSocket.server[name] = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            if (!clientSocket.isConnected)
                throw new Error('Not connected');
            if ((0, utils_1.checkRateLimit2)(id, callsLists, rateLimits) && packet && remote) {
                remote[name].apply(null, args);
                lastSentId++;
                return true;
            }
            else {
                return false;
            }
        };
    }
    function createPromiseMethod(name, id, inProgressField) {
        if (inProgressField) {
            inProgressFields[inProgressField] = 0;
            Object.defineProperty(clientSocket.server, inProgressField, {
                get: function () { return !!inProgressFields[inProgressField]; }
            });
        }
        clientSocket.server[name] = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            if (!clientSocket.isConnected)
                return Promise.reject(new Error('Not connected'));
            if (!(0, utils_1.checkRateLimit2)(id, callsLists, rateLimits))
                return Promise.reject(new Error('Rate limit exceeded'));
            if (!packet || !remote)
                return Promise.reject(new Error('Not initialized'));
            remote[name].apply(null, args);
            var messageId = ++lastSentId;
            var defer = (0, utils_1.deferred)();
            defer.name = name;
            defers.set(messageId, defer);
            if (inProgressField)
                inProgressFields[inProgressField]++;
            return defer.promise;
        };
        special['*resolve:' + name] = function (messageId, result) {
            var defer = defers.get(messageId);
            if (defer) {
                defers.delete(messageId);
                if (inProgressField)
                    inProgressFields[inProgressField]--;
                apply(function () { return defer.resolve(result); });
            }
        };
        special['*reject:' + name] = function (messageId, error) {
            var defer = defers.get(messageId);
            if (defer) {
                defers.delete(messageId);
                if (inProgressField)
                    inProgressFields[inProgressField]--;
                apply(function () { return defer.reject(new Error(error)); });
            }
        };
    }
    return clientSocket;
}
exports.createClientSocket = createClientSocket;
