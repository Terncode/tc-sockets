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
function createClientSocket(originalOptions, token, errorHandler, apply, log) {
    if (errorHandler === void 0) { errorHandler = defaultErrorHandler; }
    if (apply === void 0) { apply = function (f) { return f(); }; }
    if (log === void 0) { log = console.log.bind(console); }
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
    var lastTokenRefresh = Date.now();
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
            (_d = (_c = clientSocket.client).invalidVersion) === null || _d === void 0 ? void 0 : _d.call(_c, version, clientSocket.options.hash);
        }
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
        packet = (0, packetHandler_1.createPacketHandler)(options.client, options.server, options, log);
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
                        packet.recvBinary(clientSocket.client, reader, mockCallsList, 0);
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
            if (options.pingInterval) {
                pingInterval = setInterval(sendPing, options.pingInterval);
            }
        };
        theSocket.onerror = function (e) {
            if (options.debug)
                log('socket error', e);
        };
        theSocket.onclose = function (e) {
            var _a, _b;
            if (options.debug)
                log('socket closed', e);
            if (socket && socket !== theSocket)
                return;
            socket = null;
            versionValidated = false;
            if (clientSocket.isConnected) {
                lastTokenRefresh = Date.now();
                clientSocket.isConnected = false;
                (_b = (_a = clientSocket.client).disconnected) === null || _b === void 0 ? void 0 : _b.call(_a, e.code, e.reason);
            }
            if (connecting) {
                if (options.tokenLifetime && (lastTokenRefresh + options.tokenLifetime) < Date.now()) {
                    disconnect();
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
            lastSend = Date.now();
            return true;
        }
        else {
            return false;
        }
    }
    function sendPing() {
        try {
            var now_1 = Date.now();
            var interval = clientSocket.options.pingInterval;
            if (versionValidated && interval && (now_1 - lastSend) > interval) {
                send(supportsBinary ? pingBuffer : '');
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGllbnQvY2xpZW50U29ja2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBR0EseUNBQXlJO0FBQ3pJLHlEQUE2RTtBQUM3RSx1REFBc0U7QUFNdEUsSUFBTSxtQkFBbUIsR0FBdUI7SUFDL0MsZUFBZSxFQUFmLFVBQWdCLEtBQVk7UUFDM0IsTUFBTSxLQUFLLENBQUM7SUFDYixDQUFDO0NBQ0QsQ0FBQztBQUVGLFNBQWdCLGtCQUFrQixDQUNqQyxlQUE4QixFQUM5QixLQUFpQyxFQUNqQyxZQUFzRCxFQUN0RCxLQUF3QyxFQUN4QyxHQUF1QztJQUZ2Qyw2QkFBQSxFQUFBLGtDQUFzRDtJQUN0RCxzQkFBQSxFQUFBLGtCQUFnQyxDQUFDLElBQUksT0FBQSxDQUFDLEVBQUUsRUFBSCxDQUFHO0lBQ3hDLG9CQUFBLEVBQUEsTUFBYyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7SUFFdkMsSUFBTSxPQUFPLEdBQWEsRUFBRSxDQUFDO0lBQzdCLElBQU0sTUFBTSxHQUFHLElBQUksR0FBRyxFQUF5QixDQUFDO0lBQ2hELElBQU0sZ0JBQWdCLEdBQThCLEVBQUUsQ0FBQztJQUN2RCxJQUFNLG9CQUFvQixHQUFHLE9BQU8sU0FBUyxLQUFLLFdBQVcsSUFBSSxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ2hILElBQU0sR0FBRyxHQUFHLE9BQU8sV0FBVyxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsY0FBTSxPQUFBLFdBQVcsQ0FBQyxHQUFHLEVBQUUsRUFBakIsQ0FBaUIsQ0FBQyxDQUFDLENBQUMsY0FBTSxPQUFBLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBVixDQUFVLENBQUM7SUFDNUYsSUFBTSxjQUFjLEdBQUcsZUFBZSxDQUFDLGNBQWMsQ0FBQztJQUN0RCxJQUFNLFVBQVUsR0FBYSxFQUFFLENBQUM7SUFDaEMsSUFBTSxVQUFVLEdBQWlD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LENBQUMsRUFBOUIsQ0FBOEIsQ0FBQyxDQUFDO2FBQzVDO1FBQ0YsQ0FBQyxDQUFDO0lBQ0gsQ0FBQztJQUVELE9BQU8sWUFBWSxDQUFDO0FBQ3JCLENBQUM7QUEzVUQsZ0RBMlVDIiwiZmlsZSI6ImNsaWVudC9jbGllbnRTb2NrZXQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuXHRTb2NrZXRTZXJ2aWNlLCBTb2NrZXRTZXJ2ZXIsIFNvY2tldENsaWVudCwgQ2xpZW50T3B0aW9ucywgRnVuY0xpc3QsIE1ldGhvZE9wdGlvbnMsIExvZ2dlciwgUmF0ZUxpbWl0RGVmXG59IGZyb20gJy4uL2NvbW1vbi9pbnRlcmZhY2VzJztcbmltcG9ydCB7IHN1cHBvcnRzQmluYXJ5IGFzIGlzU3VwcG9ydGluZ0JpbmFyeSwgRGVmZXJyZWQsIGRlZmVycmVkLCBxdWVyeVN0cmluZywgcGFyc2VSYXRlTGltaXQsIGNoZWNrUmF0ZUxpbWl0MiB9IGZyb20gJy4uL2NvbW1vbi91dGlscyc7XG5pbXBvcnQgeyBQYWNrZXRIYW5kbGVyLCBjcmVhdGVQYWNrZXRIYW5kbGVyIH0gZnJvbSAnLi4vcGFja2V0L3BhY2tldEhhbmRsZXInO1xuaW1wb3J0IHsgY3JlYXRlQmluYXJ5UmVhZGVyRnJvbUJ1ZmZlciB9IGZyb20gJy4uL3BhY2tldC9iaW5hcnlSZWFkZXInO1xuXG5leHBvcnQgaW50ZXJmYWNlIENsaWVudEVycm9ySGFuZGxlciB7XG5cdGhhbmRsZVJlY3ZFcnJvcihlcnJvcjogRXJyb3IsIGRhdGE6IHN0cmluZyB8IFVpbnQ4QXJyYXkpOiB2b2lkO1xufVxuXG5jb25zdCBkZWZhdWx0RXJyb3JIYW5kbGVyOiBDbGllbnRFcnJvckhhbmRsZXIgPSB7XG5cdGhhbmRsZVJlY3ZFcnJvcihlcnJvcjogRXJyb3IpIHtcblx0XHR0aHJvdyBlcnJvcjtcblx0fVxufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNsaWVudFNvY2tldDxUQ2xpZW50IGV4dGVuZHMgU29ja2V0Q2xpZW50LCBUU2VydmVyIGV4dGVuZHMgU29ja2V0U2VydmVyPihcblx0b3JpZ2luYWxPcHRpb25zOiBDbGllbnRPcHRpb25zLFxuXHR0b2tlbj86IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsXG5cdGVycm9ySGFuZGxlcjogQ2xpZW50RXJyb3JIYW5kbGVyID0gZGVmYXVsdEVycm9ySGFuZGxlcixcblx0YXBwbHk6IChmOiAoKSA9PiBhbnkpID0+IHZvaWQgPSBmID0+IGYoKSxcblx0bG9nOiBMb2dnZXIgPSBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpLFxuKTogU29ja2V0U2VydmljZTxUQ2xpZW50LCBUU2VydmVyPiB7XG5cdGNvbnN0IHNwZWNpYWw6IEZ1bmNMaXN0ID0ge307XG5cdGNvbnN0IGRlZmVycyA9IG5ldyBNYXA8bnVtYmVyLCBEZWZlcnJlZDxhbnk+PigpO1xuXHRjb25zdCBpblByb2dyZXNzRmllbGRzOiB7IFtrZXk6IHN0cmluZ106IG51bWJlciB9ID0ge307XG5cdGNvbnN0IGNvbnZlcnRUb0FycmF5QnVmZmVyID0gdHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgL01TSUUgMTB8VHJpZGVudFxcLzcvLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCk7XG5cdGNvbnN0IG5vdyA9IHR5cGVvZiBwZXJmb3JtYW5jZSAhPT0gJ3VuZGVmaW5lZCcgPyAoKSA9PiBwZXJmb3JtYW5jZS5ub3coKSA6ICgpID0+IERhdGUubm93KCk7XG5cdGNvbnN0IGNvcHlTZW5kQnVmZmVyID0gb3JpZ2luYWxPcHRpb25zLmNvcHlTZW5kQnVmZmVyO1xuXHRjb25zdCBjYWxsc0xpc3RzOiBudW1iZXJbXSA9IFtdO1xuXHRjb25zdCByYXRlTGltaXRzOiAoUmF0ZUxpbWl0RGVmIHwgdW5kZWZpbmVkKVtdID0gb3JpZ2luYWxPcHRpb25zLnNlcnZlci5tYXAoKCkgPT4gdW5kZWZpbmVkKTtcblx0Y29uc3QgcGluZ0J1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcigwKTtcblx0bGV0IHN1cHBvcnRzQmluYXJ5ID0gaXNTdXBwb3J0aW5nQmluYXJ5KCk7XG5cdGxldCBzb2NrZXQ6IFdlYlNvY2tldCB8IG51bGwgPSBudWxsO1xuXHRsZXQgY29ubmVjdGluZyA9IGZhbHNlO1xuXHRsZXQgcmVjb25uZWN0VGltZW91dDogYW55O1xuXHRsZXQgcGluZ0ludGVydmFsOiBhbnk7XG5cdGxldCBsYXN0U2VuZCA9IDA7XG5cdGxldCBwYWNrZXQ6IFBhY2tldEhhbmRsZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdGxldCByZW1vdGU6IHsgW2tleTogc3RyaW5nXTogRnVuY3Rpb247IH0gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdGxldCBsYXN0U2VudElkID0gMDtcblx0bGV0IHZlcnNpb25WYWxpZGF0ZWQgPSBmYWxzZTtcblx0bGV0IGxhc3RUb2tlblJlZnJlc2ggPSBEYXRlLm5vdygpO1xuXG5cdGNvbnN0IGNsaWVudFNvY2tldDogU29ja2V0U2VydmljZTxUQ2xpZW50LCBUU2VydmVyPiA9IHtcblx0XHRjbGllbnQ6IHt9IGFzIGFueSBhcyBUQ2xpZW50LFxuXHRcdHNlcnZlcjoge30gYXMgYW55IGFzIFRTZXJ2ZXIsXG5cdFx0c2VudFNpemU6IDAsXG5cdFx0cmVjZWl2ZWRTaXplOiAwLFxuXHRcdHNlbnRQYWNrZXRzOiAwLFxuXHRcdHJlY2VpdmVkUGFja2V0czogMCxcblx0XHRsYXN0UGFja2V0OiAwLFxuXHRcdGlzQ29ubmVjdGVkOiBmYWxzZSxcblx0XHRzdXBwb3J0c0JpbmFyeSxcblx0XHRvcHRpb25zOiBvcmlnaW5hbE9wdGlvbnMsXG5cdFx0Y29ubmVjdCxcblx0XHRkaXNjb25uZWN0LFxuXHRcdHNvY2tldDogKCkgPT4gc29ja2V0LFxuXHR9O1xuXG5cdG9yaWdpbmFsT3B0aW9ucy5zZXJ2ZXIuZm9yRWFjaCgoaXRlbSwgaWQpID0+IHtcblx0XHRpZiAodHlwZW9mIGl0ZW0gPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRjcmVhdGVNZXRob2QoaXRlbSwgaWQsIHt9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y3JlYXRlTWV0aG9kKGl0ZW1bMF0sIGlkLCBpdGVtWzFdKTtcblxuXHRcdFx0aWYgKGl0ZW1bMV0ucmF0ZUxpbWl0KSB7XG5cdFx0XHRcdHJhdGVMaW1pdHNbaWRdID0geyBwcm9taXNlOiBmYWxzZSwgLi4ucGFyc2VSYXRlTGltaXQoaXRlbVsxXS5yYXRlTGltaXQsIGZhbHNlKSB9O1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0c3BlY2lhbFsnKnZlcnNpb24nXSA9ICh2ZXJzaW9uOiBzdHJpbmcpID0+IHtcblx0XHRpZiAodmVyc2lvbiA9PT0gY2xpZW50U29ja2V0Lm9wdGlvbnMuaGFzaCkge1xuXHRcdFx0dmVyc2lvblZhbGlkYXRlZCA9IHRydWU7XG5cdFx0XHRsYXN0U2VudElkID0gMDtcblx0XHRcdGNsaWVudFNvY2tldC5pc0Nvbm5lY3RlZCA9IHRydWU7XG5cblx0XHRcdC8vIG5vdGlmeSBzZXJ2ZXIgb2YgYmluYXJ5IHN1cHBvcnRcblx0XHRcdGlmIChzdXBwb3J0c0JpbmFyeSkgc2VuZChwaW5nQnVmZmVyKTtcblxuXHRcdFx0Y2xpZW50U29ja2V0LmNsaWVudC5jb25uZWN0ZWQ/LigpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkaXNjb25uZWN0KCk7XG5cdFx0XHRjbGllbnRTb2NrZXQuY2xpZW50LmludmFsaWRWZXJzaW9uPy4odmVyc2lvbiwgY2xpZW50U29ja2V0Lm9wdGlvbnMuaGFzaCEpO1xuXHRcdH1cblx0fTtcblxuXHRmdW5jdGlvbiBiZWZvcmV1bmxvYWQoKSB7XG5cdFx0aWYgKHNvY2tldCkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0c29ja2V0Lm9uY2xvc2UgPSAoKSA9PiB7IH07XG5cdFx0XHRcdHNvY2tldC5jbG9zZSgpO1xuXHRcdFx0XHRzb2NrZXQgPSBudWxsO1xuXHRcdFx0fSBjYXRjaCB7IH1cblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRXZWJzb2NrZXRVcmwoKSB7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IGNsaWVudFNvY2tldC5vcHRpb25zO1xuXHRcdGNvbnN0IHByb3RvY29sID0gKG9wdGlvbnMuc3NsIHx8IGxvY2F0aW9uLnByb3RvY29sID09PSAnaHR0cHM6JykgPyAnd3NzOi8vJyA6ICd3czovLyc7XG5cdFx0Y29uc3QgaG9zdCA9IG9wdGlvbnMuaG9zdCB8fCBsb2NhdGlvbi5ob3N0O1xuXHRcdGNvbnN0IHBhdGggPSBvcHRpb25zLnBhdGggfHwgJy93cyc7XG5cdFx0Y29uc3QgaWQgPSBvcHRpb25zLmlkIHx8ICdzb2NrZXQnO1xuXHRcdGNvbnN0IHF1ZXJ5ID0gcXVlcnlTdHJpbmcoeyAuLi5vcHRpb25zLnJlcXVlc3RQYXJhbXMsIGlkLCB0OiB0b2tlbiwgYmluOiBzdXBwb3J0c0JpbmFyeSwgaGFzaDogb3B0aW9ucy5oYXNoIH0pO1xuXHRcdHJldHVybiBgJHtwcm90b2NvbH0ke2hvc3R9JHtwYXRofSR7cXVlcnl9YDtcblx0fVxuXG5cdGZ1bmN0aW9uIGNvbm5lY3QoKSB7XG5cdFx0Y29ubmVjdGluZyA9IHRydWU7XG5cblx0XHRpZiAoc29ja2V0KSByZXR1cm47XG5cblx0XHRjb25zdCBvcHRpb25zID0gY2xpZW50U29ja2V0Lm9wdGlvbnM7XG5cdFx0Y29uc3QgdGhlU29ja2V0ID0gc29ja2V0ID0gbmV3IFdlYlNvY2tldChnZXRXZWJzb2NrZXRVcmwoKSk7XG5cdFx0Y29uc3QgbW9ja0NhbGxzTGlzdDogbnVtYmVyW10gPSBbXTtcblxuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdiZWZvcmV1bmxvYWQnLCBiZWZvcmV1bmxvYWQpO1xuXG5cdFx0cGFja2V0ID0gY3JlYXRlUGFja2V0SGFuZGxlcihvcHRpb25zLmNsaWVudCwgb3B0aW9ucy5zZXJ2ZXIsIG9wdGlvbnMsIGxvZyk7XG5cblx0XHRyZW1vdGUgPSB7fTtcblx0XHRwYWNrZXQuY3JlYXRlUmVtb3RlKHJlbW90ZSwgc2VuZCwgY2xpZW50U29ja2V0KTtcblxuXHRcdHN1cHBvcnRzQmluYXJ5ID0gISF0aGVTb2NrZXQuYmluYXJ5VHlwZTtcblxuXHRcdHRoZVNvY2tldC5iaW5hcnlUeXBlID0gJ2FycmF5YnVmZmVyJztcblx0XHR0aGVTb2NrZXQub25tZXNzYWdlID0gbWVzc2FnZSA9PiB7XG5cdFx0XHRpZiAoc29ja2V0ICE9PSB0aGVTb2NrZXQpIHJldHVybjtcblxuXHRcdFx0Y2xpZW50U29ja2V0Lmxhc3RQYWNrZXQgPSBub3coKTtcblx0XHRcdGNsaWVudFNvY2tldC5yZWNlaXZlZFBhY2tldHMrKztcblxuXHRcdFx0Y29uc3QgZGF0YTogc3RyaW5nIHwgQXJyYXlCdWZmZXIgfCB1bmRlZmluZWQgPSBtZXNzYWdlLmRhdGE7XG5cblx0XHRcdGlmIChkYXRhICYmIHBhY2tldCAmJiAodHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnIHx8IGRhdGEuYnl0ZUxlbmd0aCA+IDApKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0Y2xpZW50U29ja2V0LnJlY2VpdmVkU2l6ZSArPSBkYXRhLmxlbmd0aDtcblx0XHRcdFx0XHRcdHBhY2tldC5yZWN2U3RyaW5nKGRhdGEsIGNsaWVudFNvY2tldC5jbGllbnQsIHNwZWNpYWwpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjbGllbnRTb2NrZXQucmVjZWl2ZWRTaXplICs9IGRhdGEuYnl0ZUxlbmd0aDtcblx0XHRcdFx0XHRcdGNvbnN0IHJlYWRlciA9IGNyZWF0ZUJpbmFyeVJlYWRlckZyb21CdWZmZXIoZGF0YSwgMCwgZGF0YS5ieXRlTGVuZ3RoKTtcblx0XHRcdFx0XHRcdHBhY2tldC5yZWN2QmluYXJ5KGNsaWVudFNvY2tldC5jbGllbnQsIHJlYWRlciwgbW9ja0NhbGxzTGlzdCwgMCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0ZXJyb3JIYW5kbGVyLmhhbmRsZVJlY3ZFcnJvcihlLCB0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycgPyBkYXRhIDogbmV3IFVpbnQ4QXJyYXkoZGF0YSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHNlbmRQaW5nKCk7IC8vIG5lZWQgdG8gc2VuZCBwaW5nIGhlcmUgYmVjYXVzZSBzZXRJbnRlcnZhbCBpbiB1bnJlbGlhYmxlIG9uIHNvbWUgYnJvd3NlcnMgd2hlbiB0aGUgdGFiIGlzIGluIHRoZSBiYWNrZ3JvdW5kXG5cdFx0fTtcblxuXHRcdHRoZVNvY2tldC5vbm9wZW4gPSAoKSA9PiB7XG5cdFx0XHRpZiAoc29ja2V0ICE9PSB0aGVTb2NrZXQpIHtcblx0XHRcdFx0dGhlU29ja2V0LmNsb3NlKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y2xpZW50U29ja2V0Lmxhc3RQYWNrZXQgPSBub3coKTtcblxuXHRcdFx0aWYgKG9wdGlvbnMuZGVidWcpIGxvZygnc29ja2V0IG9wZW5lZCcpO1xuXG5cdFx0XHRpZiAob3B0aW9ucy5waW5nSW50ZXJ2YWwpIHtcblx0XHRcdFx0cGluZ0ludGVydmFsID0gc2V0SW50ZXJ2YWwoc2VuZFBpbmcsIG9wdGlvbnMucGluZ0ludGVydmFsKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dGhlU29ja2V0Lm9uZXJyb3IgPSBlID0+IHtcblx0XHRcdGlmIChvcHRpb25zLmRlYnVnKSBsb2coJ3NvY2tldCBlcnJvcicsIGUpO1xuXHRcdH07XG5cblx0XHR0aGVTb2NrZXQub25jbG9zZSA9IGUgPT4ge1xuXHRcdFx0aWYgKG9wdGlvbnMuZGVidWcpIGxvZygnc29ja2V0IGNsb3NlZCcsIGUpO1xuXHRcdFx0aWYgKHNvY2tldCAmJiBzb2NrZXQgIT09IHRoZVNvY2tldCkgcmV0dXJuO1xuXG5cdFx0XHRzb2NrZXQgPSBudWxsO1xuXHRcdFx0dmVyc2lvblZhbGlkYXRlZCA9IGZhbHNlO1xuXG5cdFx0XHRpZiAoY2xpZW50U29ja2V0LmlzQ29ubmVjdGVkKSB7XG5cdFx0XHRcdGxhc3RUb2tlblJlZnJlc2ggPSBEYXRlLm5vdygpO1xuXHRcdFx0XHRjbGllbnRTb2NrZXQuaXNDb25uZWN0ZWQgPSBmYWxzZTtcblx0XHRcdFx0Y2xpZW50U29ja2V0LmNsaWVudC5kaXNjb25uZWN0ZWQ/LihlLmNvZGUsIGUucmVhc29uKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGNvbm5lY3RpbmcpIHtcblx0XHRcdFx0aWYgKG9wdGlvbnMudG9rZW5MaWZldGltZSAmJiAobGFzdFRva2VuUmVmcmVzaCArIG9wdGlvbnMudG9rZW5MaWZldGltZSkgPCBEYXRlLm5vdygpKSB7XG5cdFx0XHRcdFx0ZGlzY29ubmVjdCgpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlY29ubmVjdFRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRcdGNvbm5lY3QoKTtcblx0XHRcdFx0XHRcdHJlY29ubmVjdFRpbWVvdXQgPSBudWxsO1xuXHRcdFx0XHRcdH0sIG9wdGlvbnMucmVjb25uZWN0VGltZW91dCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0ZGVmZXJzLmZvckVhY2goZCA9PiBkLnJlamVjdChuZXcgRXJyb3IoYERpc2Nvbm5lY3RlZCAoJHsoZCBhcyBhbnkpLm5hbWV9KWApKSk7XG5cdFx0XHRkZWZlcnMuY2xlYXIoKTtcblxuXHRcdFx0T2JqZWN0LmtleXMoaW5Qcm9ncmVzc0ZpZWxkcykuZm9yRWFjaChrZXkgPT4gaW5Qcm9ncmVzc0ZpZWxkc1trZXldID0gMCk7XG5cblx0XHRcdGlmIChwaW5nSW50ZXJ2YWwpIHtcblx0XHRcdFx0Y2xlYXJJbnRlcnZhbChwaW5nSW50ZXJ2YWwpO1xuXHRcdFx0XHRwaW5nSW50ZXJ2YWwgPSBudWxsO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRmdW5jdGlvbiBkaXNjb25uZWN0KCkge1xuXHRcdGNvbm5lY3RpbmcgPSBmYWxzZTtcblxuXHRcdGlmIChyZWNvbm5lY3RUaW1lb3V0KSB7XG5cdFx0XHRjbGVhclRpbWVvdXQocmVjb25uZWN0VGltZW91dCk7XG5cdFx0XHRyZWNvbm5lY3RUaW1lb3V0ID0gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAocGluZ0ludGVydmFsKSB7XG5cdFx0XHRjbGVhckludGVydmFsKHBpbmdJbnRlcnZhbCk7XG5cdFx0XHRwaW5nSW50ZXJ2YWwgPSBudWxsO1xuXHRcdH1cblxuXHRcdGlmIChzb2NrZXQpIHtcblx0XHRcdGlmIChjbGllbnRTb2NrZXQuaXNDb25uZWN0ZWQpIHtcblx0XHRcdFx0c29ja2V0LmNsb3NlKCk7XG5cdFx0XHR9XG5cblx0XHRcdHNvY2tldCA9IG51bGw7XG5cdFx0fVxuXG5cdFx0d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2JlZm9yZXVubG9hZCcsIGJlZm9yZXVubG9hZCk7XG5cdH1cblxuXHRmdW5jdGlvbiBzZW5kKGRhdGE6IHN0cmluZyB8IEFycmF5QnVmZmVyIHwgVWludDhBcnJheSkge1xuXHRcdGlmIChzb2NrZXQgJiYgc29ja2V0LnJlYWR5U3RhdGUgPT09IFdlYlNvY2tldC5PUEVOKSB7XG5cdFx0XHQvLyBIQUNLOiBmaXggZm9yIElFXG5cdFx0XHRpZiAoY29udmVydFRvQXJyYXlCdWZmZXIgJiYgZGF0YSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcblx0XHRcdFx0Y29uc3QgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKGRhdGEuYnl0ZUxlbmd0aCk7XG5cdFx0XHRcdGNvbnN0IHZpZXcgPSBuZXcgVWludDhBcnJheShidWZmZXIpO1xuXHRcdFx0XHR2aWV3LnNldChkYXRhKTtcblx0XHRcdFx0ZGF0YSA9IGJ1ZmZlcjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGNvcHlTZW5kQnVmZmVyICYmIGRhdGEgaW5zdGFuY2VvZiBVaW50OEFycmF5KSB7XG5cdFx0XHRcdGRhdGEgPSBkYXRhLnNsaWNlKCk7XG5cdFx0XHR9XG5cblx0XHRcdHNvY2tldC5zZW5kKGRhdGEpO1xuXHRcdFx0Y2xpZW50U29ja2V0LnNlbnRQYWNrZXRzKys7XG5cdFx0XHRsYXN0U2VuZCA9IERhdGUubm93KCk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHNlbmRQaW5nKCkge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXHRcdFx0Y29uc3QgaW50ZXJ2YWwgPSBjbGllbnRTb2NrZXQub3B0aW9ucy5waW5nSW50ZXJ2YWw7XG5cblx0XHRcdGlmICh2ZXJzaW9uVmFsaWRhdGVkICYmIGludGVydmFsICYmIChub3cgLSBsYXN0U2VuZCkgPiBpbnRlcnZhbCkge1xuXHRcdFx0XHRzZW5kKHN1cHBvcnRzQmluYXJ5ID8gcGluZ0J1ZmZlciA6ICcnKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIHsgfVxuXHR9XG5cblx0ZnVuY3Rpb24gY3JlYXRlTWV0aG9kKG5hbWU6IHN0cmluZywgaWQ6IG51bWJlciwgb3B0aW9uczogTWV0aG9kT3B0aW9ucykge1xuXHRcdGlmIChuYW1lKSB7XG5cdFx0XHRpZiAob3B0aW9ucy5wcm9taXNlKSB7XG5cdFx0XHRcdGNyZWF0ZVByb21pc2VNZXRob2QobmFtZSwgaWQsIG9wdGlvbnMucHJvZ3Jlc3MpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y3JlYXRlU2ltcGxlTWV0aG9kKG5hbWUsIGlkKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBjcmVhdGVTaW1wbGVNZXRob2QobmFtZTogc3RyaW5nLCBpZDogbnVtYmVyKSB7XG5cdFx0KGNsaWVudFNvY2tldC5zZXJ2ZXIgYXMgYW55KVtuYW1lXSA9ICguLi5hcmdzOiBhbnlbXSkgPT4ge1xuXHRcdFx0aWYgKCFjbGllbnRTb2NrZXQuaXNDb25uZWN0ZWQpXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignTm90IGNvbm5lY3RlZCcpO1xuXG5cdFx0XHRpZiAoY2hlY2tSYXRlTGltaXQyKGlkLCBjYWxsc0xpc3RzLCByYXRlTGltaXRzKSAmJiBwYWNrZXQgJiYgcmVtb3RlKSB7XG5cdFx0XHRcdHJlbW90ZVtuYW1lXS5hcHBseShudWxsLCBhcmdzKTtcblx0XHRcdFx0bGFzdFNlbnRJZCsrO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0ZnVuY3Rpb24gY3JlYXRlUHJvbWlzZU1ldGhvZChuYW1lOiBzdHJpbmcsIGlkOiBudW1iZXIsIGluUHJvZ3Jlc3NGaWVsZD86IHN0cmluZykge1xuXHRcdGlmIChpblByb2dyZXNzRmllbGQpIHtcblx0XHRcdGluUHJvZ3Jlc3NGaWVsZHNbaW5Qcm9ncmVzc0ZpZWxkXSA9IDA7XG5cblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjbGllbnRTb2NrZXQuc2VydmVyLCBpblByb2dyZXNzRmllbGQsIHtcblx0XHRcdFx0Z2V0OiAoKSA9PiAhIWluUHJvZ3Jlc3NGaWVsZHNbaW5Qcm9ncmVzc0ZpZWxkXVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0KGNsaWVudFNvY2tldC5zZXJ2ZXIgYXMgYW55KVtuYW1lXSA9ICguLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8YW55PiA9PiB7XG5cdFx0XHRpZiAoIWNsaWVudFNvY2tldC5pc0Nvbm5lY3RlZClcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignTm90IGNvbm5lY3RlZCcpKTtcblxuXHRcdFx0aWYgKCFjaGVja1JhdGVMaW1pdDIoaWQsIGNhbGxzTGlzdHMsIHJhdGVMaW1pdHMpKVxuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdSYXRlIGxpbWl0IGV4Y2VlZGVkJykpO1xuXG5cdFx0XHRpZiAoIXBhY2tldCB8fCAhcmVtb3RlKVxuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdOb3QgaW5pdGlhbGl6ZWQnKSk7XG5cblx0XHRcdHJlbW90ZVtuYW1lXS5hcHBseShudWxsLCBhcmdzKTtcblx0XHRcdGNvbnN0IG1lc3NhZ2VJZCA9ICsrbGFzdFNlbnRJZDtcblx0XHRcdGNvbnN0IGRlZmVyID0gZGVmZXJyZWQ8YW55PigpO1xuXHRcdFx0KGRlZmVyIGFzIGFueSkubmFtZSA9IG5hbWU7XG5cdFx0XHRkZWZlcnMuc2V0KG1lc3NhZ2VJZCwgZGVmZXIpO1xuXG5cdFx0XHRpZiAoaW5Qcm9ncmVzc0ZpZWxkKSBpblByb2dyZXNzRmllbGRzW2luUHJvZ3Jlc3NGaWVsZF0rKztcblxuXHRcdFx0cmV0dXJuIGRlZmVyLnByb21pc2U7XG5cdFx0fTtcblxuXHRcdHNwZWNpYWxbJypyZXNvbHZlOicgKyBuYW1lXSA9IChtZXNzYWdlSWQ6IG51bWJlciwgcmVzdWx0OiBhbnkpID0+IHtcblx0XHRcdGNvbnN0IGRlZmVyID0gZGVmZXJzLmdldChtZXNzYWdlSWQpO1xuXG5cdFx0XHRpZiAoZGVmZXIpIHtcblx0XHRcdFx0ZGVmZXJzLmRlbGV0ZShtZXNzYWdlSWQpO1xuXG5cdFx0XHRcdGlmIChpblByb2dyZXNzRmllbGQpIGluUHJvZ3Jlc3NGaWVsZHNbaW5Qcm9ncmVzc0ZpZWxkXS0tO1xuXG5cdFx0XHRcdGFwcGx5KCgpID0+IGRlZmVyLnJlc29sdmUocmVzdWx0KSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHNwZWNpYWxbJypyZWplY3Q6JyArIG5hbWVdID0gKG1lc3NhZ2VJZDogbnVtYmVyLCBlcnJvcjogc3RyaW5nKSA9PiB7XG5cdFx0XHRjb25zdCBkZWZlciA9IGRlZmVycy5nZXQobWVzc2FnZUlkKTtcblxuXHRcdFx0aWYgKGRlZmVyKSB7XG5cdFx0XHRcdGRlZmVycy5kZWxldGUobWVzc2FnZUlkKTtcblxuXHRcdFx0XHRpZiAoaW5Qcm9ncmVzc0ZpZWxkKSBpblByb2dyZXNzRmllbGRzW2luUHJvZ3Jlc3NGaWVsZF0tLTtcblxuXHRcdFx0XHRhcHBseSgoKSA9PiBkZWZlci5yZWplY3QobmV3IEVycm9yKGVycm9yKSkpO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRyZXR1cm4gY2xpZW50U29ja2V0O1xufVxuIl0sInNvdXJjZVJvb3QiOiIvaG9tZS9hbHBoYS9EZXNrdG9wL2Rldi90Yy1zb2NrZXRzL3NyYyJ9
