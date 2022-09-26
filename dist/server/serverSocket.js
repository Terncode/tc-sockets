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
exports.createServerHost = exports.createServerRaw = exports.createServer = void 0;
var interfaces_1 = require("../common/interfaces");
var utils_1 = require("../common/utils");
var packetHandler_1 = require("../packet/packetHandler");
var serverUtils_1 = require("./serverUtils");
var binaryReader_1 = require("../packet/binaryReader");
var uWebSockets_js_1 = require("uWebSockets.js");
var HTTP = require("http");
function createServer(serverType, clientType, createServer, options, errorHandler, log) {
    return createServerRaw(createServer, (0, serverUtils_1.createServerOptions)(serverType, clientType, options), errorHandler, log);
}
exports.createServer = createServer;
function createServerRaw(createServer, options, errorHandler, log) {
    var host = createServerHost({
        path: options.path,
        errorHandler: errorHandler,
        log: log,
        port: options.port,
        app: options.app,
        perMessageDeflate: options.perMessageDeflate,
        compression: options.compression,
    });
    var socket = host.socketRaw(createServer, __assign({ id: 'socket' }, options));
    socket.close = host.close;
    return socket;
}
exports.createServerRaw = createServerRaw;
function createServerHost(globalConfig) {
    if (!globalConfig.app && !globalConfig.port) {
        throw new Error('Port or uWebSockets.js app not provided');
    }
    if (globalConfig.app && globalConfig.port) {
        throw new Error('Provide port or uWebSockets.js app but not both');
    }
    var uwsApp = globalConfig.app || (0, uWebSockets_js_1.App)();
    var _a = globalConfig.path, path = _a === void 0 ? '/ws' : _a, _b = globalConfig.log, log = _b === void 0 ? console.log.bind(console) : _b, _c = globalConfig.errorHandler, errorHandler = _c === void 0 ? serverUtils_1.defaultErrorHandler : _c, _d = globalConfig.perMessageDeflate, perMessageDeflate = _d === void 0 ? true : _d, _e = globalConfig.errorCode, errorCode = _e === void 0 ? 400 : _e, _f = globalConfig.errorName, errorName = _f === void 0 ? HTTP.STATUS_CODES[400] : _f, _g = globalConfig.nativePing, nativePing = _g === void 0 ? 0 : _g;
    var servers = [];
    var upgradeReq;
    var connectedSockets = new Map();
    uwsApp.ws(path, {
        compression: globalConfig.compression ? globalConfig.compression : (perMessageDeflate ? uWebSockets_js_1.SHARED_COMPRESSOR : uWebSockets_js_1.DISABLED),
        sendPingsAutomatically: !!nativePing,
        idleTimeout: nativePing ? nativePing : undefined,
        upgrade: function (res, req, context) {
            if (upgradeReq) {
                res.end("HTTP/1.1 ".concat(503, " ").concat(HTTP.STATUS_CODES[503], "\r\n\r\n"));
                return;
            }
            var aborted = false;
            res.onAborted(function () {
                aborted = true;
            });
            var url = req.getUrl();
            var secWebSocketKey = req.getHeader('sec-websocket-key');
            var secWebSocketProtocol = req.getHeader('sec-websocket-protocol');
            var secWebSocketExtensions = req.getHeader('sec-websocket-extensions');
            if (globalConfig.path && globalConfig.path !== url.split('?')[0].split('#')[0]) {
                res.end("HTTP/1.1 ".concat(400, " ").concat(HTTP.STATUS_CODES[400], "\r\n\r\n"));
                return;
            }
            var originalRequest = (0, serverUtils_1.createOriginalRequest)(req);
            verifyClient(req, function (result, code, name) {
                if (aborted)
                    return;
                if (result) {
                    upgradeReq = originalRequest;
                    try {
                        res.upgrade({ url: url }, secWebSocketKey, secWebSocketProtocol, secWebSocketExtensions, context);
                    }
                    catch (error) {
                        console.error(error);
                    }
                }
                else {
                    res.end("HTTP/1.1 ".concat(code, " ").concat(name, "\r\n\r\n"));
                }
            });
        },
        open: function (ws) {
            if (!upgradeReq) {
                ws.close();
                return;
            }
            var uwsSocketEvents = {
                socket: ws,
                onClose: function () { },
                onMessage: function () { },
                isClosed: false,
            };
            connectSocket(upgradeReq, uwsSocketEvents);
            connectedSockets.set(ws, uwsSocketEvents);
            upgradeReq = undefined;
        },
        message: function (ws, message, isBinary) {
            connectedSockets.get(ws).onMessage(message, isBinary);
        },
        close: function (ws, code, message) {
            var events = connectedSockets.get(ws);
            if (events) {
                events.isClosed = true; //
                events.onClose(code, message);
                connectedSockets.delete(ws);
            }
        },
    });
    var socketToken;
    if (globalConfig.port) {
        var port_1 = globalConfig.port;
        uwsApp.listen(port_1, function (token) {
            if (token) {
                socketToken = token;
            }
            else {
                errorHandler.handleError(null, new Error("Failed to listen to port ".concat(port_1)));
            }
        });
    }
    function getServer(id) {
        if (servers.length === 1)
            return servers[0];
        for (var _i = 0, servers_1 = servers; _i < servers_1.length; _i++) {
            var server = servers_1[_i];
            if (server.id === id)
                return server;
        }
        throw new Error("No server for given id (".concat(id, ")"));
    }
    function verifyClient(req, next) {
        try {
            var query = (0, serverUtils_1.getQuery)(req.getUrl());
            var server = getServer(query.id);
            if (!server.verifyClient(req)) {
                next(false, errorCode, errorName);
            }
            else if (server.clientLimit !== 0 && server.clientLimit <= server.clients.length) {
                next(false, errorCode, errorName);
            }
            else if (server.connectionTokens) {
                if ((0, serverUtils_1.hasToken)(server, query.t)) {
                    next(true, 200, 'OK');
                }
                else {
                    next(false, errorCode, errorName);
                }
            }
            else {
                next(true, 200, 'OK');
            }
        }
        catch (e) {
            errorHandler.handleError(null, e);
            next(false, errorCode, errorName);
        }
    }
    function close() {
        servers.forEach(closeServer);
        connectedSockets.forEach(function (_, socket) { return socket.end(); });
        if (socketToken) {
            (0, uWebSockets_js_1.us_listen_socket_close)(socketToken);
            socketToken = undefined;
        }
    }
    function closeAndRemoveServer(server) {
        closeServer(server);
        var index = servers.indexOf(server);
        if (index !== -1)
            servers.splice(index, 1);
    }
    function socket(serverType, clientType, createServer, baseOptions) {
        var options = (0, serverUtils_1.createServerOptions)(serverType, clientType, baseOptions);
        return socketRaw(createServer, options);
    }
    function socketRaw(createServer, options) {
        var internalServer = createInternalServer(createServer, __assign(__assign({}, options), { path: path }), errorHandler, log);
        if (servers.some(function (s) { return s.id === internalServer.id; })) {
            throw new Error('Cannot open two sockets with the same id');
        }
        servers.push(internalServer);
        internalServer.server.close = function () { return closeAndRemoveServer(internalServer); };
        return internalServer.server;
    }
    function connectSocket(originalRequest, socketEvents) {
        try {
            var query = (0, serverUtils_1.getQuery)(originalRequest.url);
            var server = getServer(query.id);
            connectClient(server, originalRequest, errorHandler, log, socketEvents);
        }
        catch (e) {
            if (!socketEvents.isClosed) {
                socketEvents.socket.end();
            }
            errorHandler.handleError(null, e);
        }
    }
    return { close: close, socket: socket, socketRaw: socketRaw, app: uwsApp };
}
exports.createServerHost = createServerHost;
function createInternalServer(createServer, options, errorHandler, log) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    options = (0, serverUtils_1.optionsWithDefaults)(options);
    var onSend = options.onSend;
    var handlerOptions = {
        debug: options.debug,
        development: options.development,
        forceBinary: options.forceBinary,
        forceBinaryPackets: options.forceBinaryPackets,
        onSend: onSend,
        onRecv: options.onRecv,
        useBuffer: true,
    };
    var packetHandler = (0, packetHandler_1.createPacketHandler)(options.server, options.client, handlerOptions, log);
    var clientOptions = (0, serverUtils_1.toClientOptions)(options);
    var clientMethods = (0, interfaces_1.getNames)(options.client);
    var server = {
        id: (_a = options.id) !== null && _a !== void 0 ? _a : 'socket',
        clients: [],
        freeTokens: new Map(),
        clientsByToken: new Map(),
        totalSent: 0,
        totalReceived: 0,
        currentClientId: (_b = options.clientBaseId) !== null && _b !== void 0 ? _b : 1,
        path: (_c = options.path) !== null && _c !== void 0 ? _c : '',
        hash: (_d = options.hash) !== null && _d !== void 0 ? _d : '',
        debug: !!options.debug,
        forceBinary: !!options.forceBinary,
        connectionTokens: !!options.connectionTokens,
        keepOriginalRequest: !!options.keepOriginalRequest,
        errorIfNotConnected: !!options.errorIfNotConnected,
        tokenLifetime: (_e = options.tokenLifetime) !== null && _e !== void 0 ? _e : 0,
        clientLimit: (_f = options.clientLimit) !== null && _f !== void 0 ? _f : 0,
        transferLimit: (_g = options.transferLimit) !== null && _g !== void 0 ? _g : 0,
        verifyClient: (_h = options.verifyClient) !== null && _h !== void 0 ? _h : serverUtils_1.returnTrue,
        createClient: options.createClient,
        serverMethods: options.server,
        clientMethods: clientMethods,
        rateLimits: options.server.map(serverUtils_1.parseRateLimitDef),
        handleResult: handleResult,
        createServer: createServer,
        packetHandler: packetHandler,
        server: {},
        pingInterval: undefined,
        tokenInterval: undefined,
    };
    function handleResult(send, obj, funcId, funcName, result, messageId) {
        if (result && typeof result.then === 'function') {
            result.then(function (result) {
                if (obj.client.isConnected()) {
                    packetHandler.sendString(send, "*resolve:".concat(funcName), 254 /* MessageType.Resolved */, [funcId, messageId, result]);
                }
            }, function (e) {
                e = errorHandler.handleRejection(obj.client, e) || e;
                if (obj.client.isConnected()) {
                    packetHandler.sendString(send, "*reject:".concat(funcName), 253 /* MessageType.Rejected */, [funcId, messageId, e ? e.message : 'error']);
                }
            }).catch(function (e) { return errorHandler.handleError(obj.client, e); });
        }
    }
    var pingInterval = options.pingInterval;
    if (pingInterval) {
        server.pingInterval = setInterval(function () {
            var now = Date.now();
            var threshold = now - pingInterval;
            var timeoutThreshold = now - options.connectionTimeout;
            for (var i = 0; i < server.clients.length; i++) {
                var c = server.clients[i];
                try {
                    if (c.lastMessageTime < timeoutThreshold) {
                        c.client.disconnect(true, false, 'timeout');
                    }
                    else if (c.lastSendTime < threshold) {
                        c.ping();
                        if (onSend)
                            onSend(-1, 'PING', 0, false);
                    }
                }
                catch (_a) { }
            }
        }, pingInterval);
    }
    if (options.connectionTokens) {
        server.tokenInterval = setInterval(function () {
            var now = Date.now();
            var ids = [];
            server.freeTokens.forEach(function (token) {
                if (token.expire < now) {
                    ids.push(token.id);
                }
            });
            for (var _i = 0, ids_1 = ids; _i < ids_1.length; _i++) {
                var id = ids_1[_i];
                server.freeTokens.delete(id);
            }
        }, 10000);
    }
    server.server = {
        get clients() {
            return server.clients;
        },
        close: function () {
            closeServer(server);
        },
        options: function () {
            return (0, utils_1.cloneDeep)(clientOptions);
        },
        token: function (data) {
            return (0, serverUtils_1.createToken)(server, data).id;
        },
        clearToken: function (id) {
            var _a;
            server.freeTokens.delete(id);
            (_a = server.clientsByToken.get(id)) === null || _a === void 0 ? void 0 : _a.client.disconnect(true, true, 'clear tokens');
        },
        clearTokens: function (test) {
            var ids = [];
            server.freeTokens.forEach(function (token) {
                if (test(token.id, token.data)) {
                    ids.push(token.id);
                }
            });
            server.clientsByToken.forEach(function (_a) {
                var token = _a.token;
                if (token && test(token.id, token.data)) {
                    ids.push(token.id);
                }
            });
            for (var _i = 0, ids_2 = ids; _i < ids_2.length; _i++) {
                var id = ids_2[_i];
                this.clearToken(id);
            }
        },
        info: function () {
            var writerBufferSize = packetHandler.writerBufferSize();
            var freeTokens = server.freeTokens.size;
            var clientsByToken = server.clientsByToken.size;
            return { writerBufferSize: writerBufferSize, freeTokens: freeTokens, clientsByToken: clientsByToken };
        },
    };
    return server;
}
function closeServer(server) {
    if (server.pingInterval) {
        clearInterval(server.pingInterval);
        server.pingInterval = undefined;
    }
    if (server.tokenInterval) {
        clearInterval(server.tokenInterval);
        server.tokenInterval = undefined;
    }
}
function connectClient(server, originalRequest, errorHandler, log, uwsSocketEvents) {
    var socket = uwsSocketEvents.socket;
    var query = (0, serverUtils_1.getQuery)(originalRequest.url);
    var t = (query.t || '');
    var token = server.connectionTokens ? (0, serverUtils_1.getToken)(server, t) || (0, serverUtils_1.getTokenFromClient)(server, t) : undefined;
    if (server.hash && query.hash !== server.hash) {
        if (server.debug)
            log('client disconnected (hash mismatch)');
        socket.send(JSON.stringify([255 /* MessageType.Version */, server.hash]));
        if (!uwsSocketEvents.isClosed) {
            socket.end();
        }
        return;
    }
    if (server.connectionTokens && !token) {
        errorHandler.handleError({ originalRequest: originalRequest }, new Error("Invalid token: ".concat(t)));
        if (!uwsSocketEvents.isClosed) {
            uwsSocketEvents.socket.end();
        }
        return;
    }
    var callsList = [];
    var handleResult = server.handleResult, _a = server.createClient, createClient = _a === void 0 ? function (x) { return x; } : _a;
    var bytesReset = Date.now();
    var bytesReceived = 0;
    var transferLimitExceeded = false;
    var isConnected = true;
    var serverActions = undefined;
    var closeReason = undefined;
    var obj = {
        lastMessageTime: Date.now(),
        lastMessageId: 0,
        lastSendTime: Date.now(),
        sentSize: 0,
        supportsBinary: !!server.forceBinary || !!(query && query.bin === 'true'),
        token: token,
        ping: function () {
            socket.send('');
        },
        client: createClient({
            id: server.currentClientId++,
            tokenId: token ? token.id : undefined,
            tokenData: token ? token.data : undefined,
            originalRequest: server.keepOriginalRequest ? originalRequest : undefined,
            transferLimit: server.transferLimit,
            isConnected: function () {
                return isConnected;
            },
            lastMessageTime: function () {
                return obj.lastMessageTime;
            },
            disconnect: function (force, invalidateToken, reason) {
                if (force === void 0) { force = false; }
                if (invalidateToken === void 0) { invalidateToken = false; }
                if (reason === void 0) { reason = ''; }
                isConnected = false;
                if (invalidateToken && obj.token) {
                    if (server.clientsByToken.get(obj.token.id) === obj) {
                        server.clientsByToken.delete(obj.token.id);
                    }
                    obj.token = undefined;
                }
                if (force) {
                    if (!uwsSocketEvents) {
                        socket.end();
                    }
                }
                else {
                    closeReason = reason;
                    socket.close();
                }
            },
        }, send),
    };
    if (obj.token) {
        server.clientsByToken.set(obj.token.id, obj);
    }
    // TODO: remove Uint8Array from here
    function send(data) {
        if (server.errorIfNotConnected && !isConnected) {
            errorHandler.handleError(obj.client, new Error('Not Connected'));
        }
        if (data instanceof Buffer) {
            server.totalSent += data.byteLength;
            socket.send(data, true);
        }
        else if (typeof data !== 'string') {
            server.totalSent += data.byteLength;
            socket.send(Buffer.from(data.buffer, data.byteOffset, data.byteLength), true);
        }
        else {
            server.totalSent += data.length;
            socket.send(data, false);
        }
        obj.lastSendTime = Date.now();
    }
    var handleResult2 = function (funcId, fundName, result, messageId) {
        handleResult(send, obj, funcId, fundName, result, messageId);
    };
    function serverActionsCreated(serverActions) {
        uwsSocketEvents.onMessage = function (message, isBinary) {
            try {
                var data = undefined;
                if (!isBinary) {
                    data = Buffer.from(message).toString();
                }
                if (transferLimitExceeded || !isConnected)
                    return;
                var messageLength = (0, utils_1.getLength)(data || message);
                bytesReceived += messageLength;
                server.totalReceived += bytesReceived;
                var reader = undefined;
                if (messageLength) {
                    if (isBinary) {
                        reader = (0, binaryReader_1.createBinaryReaderFromBuffer)(message, 0, message.byteLength);
                    }
                }
                var now = Date.now();
                var diff = now - bytesReset;
                var bytesPerSecond = bytesReceived * 1000 / Math.max(1000, diff);
                var transferLimit = obj.client.transferLimit;
                if (transferLimit && transferLimit < bytesPerSecond) {
                    transferLimitExceeded = true;
                    obj.client.disconnect(true, true, 'transfer limit');
                    errorHandler.handleRecvError(obj.client, new Error("Transfer limit exceeded ".concat(bytesPerSecond.toFixed(0), "/").concat(transferLimit, " (").concat(diff, "ms)")), reader ? (0, binaryReader_1.getBinaryReaderBuffer)(reader) : data);
                    return;
                }
                if (server.forceBinary && data !== undefined) {
                    obj.client.disconnect(true, true, 'non-binary message');
                    errorHandler.handleRecvError(obj.client, new Error("String message while forced binary"), reader ? (0, binaryReader_1.getBinaryReaderBuffer)(reader) : data);
                    return;
                }
                obj.lastMessageTime = Date.now();
                obj.supportsBinary = obj.supportsBinary || !!(isBinary);
                if (reader || data) {
                    obj.lastMessageId++;
                    var messageId_1 = obj.lastMessageId;
                    try {
                        // TODO: options.onPacket?.(obj.client)
                        if (data !== undefined) {
                            server.packetHandler.recvString(data, serverActions, {}, function (funcId, funcName, func, funcObj, args) {
                                var rate = server.rateLimits[funcId];
                                // TODO: move rate limits to packet handler
                                if ((0, utils_1.checkRateLimit2)(funcId, callsList, server.rateLimits)) {
                                    handleResult(send, obj, funcId, funcName, func.apply(funcObj, args), messageId_1);
                                }
                                else if (rate && rate.promise) {
                                    handleResult(send, obj, funcId, funcName, Promise.reject(new Error('Rate limit exceeded')), messageId_1);
                                }
                                else {
                                    throw new Error("Rate limit exceeded (".concat(funcName, ")"));
                                }
                            });
                        }
                        else {
                            server.packetHandler.recvBinary(serverActions, reader, callsList, messageId_1, handleResult2);
                        }
                    }
                    catch (e) {
                        errorHandler.handleRecvError(obj.client, e, reader ? (0, binaryReader_1.getBinaryReaderBuffer)(reader) : data);
                    }
                }
                if (diff > 1000) {
                    bytesReceived = 0;
                    bytesReset = now;
                }
            }
            catch (e) {
                errorHandler.handleError(obj.client, e);
            }
        };
        server.packetHandler.createRemote(obj.client, send, obj);
        if (server.debug)
            log('client connected');
        server.packetHandler.sendString(send, '*version', 255 /* MessageType.Version */, [server.hash]);
        server.clients.push(obj);
        if (serverActions.connected) {
            (0, serverUtils_1.callWithErrorHandling)(function () { return serverActions.connected(); }, function () { }, function (e) {
                errorHandler.handleError(obj.client, e);
                obj.client.disconnect(false, false, 'error on connected()');
            });
        }
    }
    var closed = false;
    uwsSocketEvents.onClose = function (code, reason) {
        if (closed)
            return;
        try {
            closed = true;
            isConnected = false;
            // remove client
            var index = server.clients.indexOf(obj);
            if (index !== -1) {
                server.clients[index] = server.clients[server.clients.length - 1];
                server.clients.pop();
            }
            if (server.debug)
                log('client disconnected');
            if (serverActions === null || serverActions === void 0 ? void 0 : serverActions.disconnected) {
                var reader = (0, binaryReader_1.createBinaryReaderFromBuffer)(reason, 0, reason.byteLength);
                var decodedReason_1 = (0, binaryReader_1.readString)(reader) || '';
                (0, serverUtils_1.callWithErrorHandling)(function () { return serverActions.disconnected(code, closeReason || decodedReason_1); }, function () { }, function (e) { return errorHandler.handleError(obj.client, e); });
            }
            if (obj.token) {
                obj.token.expire = Date.now() + server.tokenLifetime;
                if (server.clientsByToken.get(obj.token.id) === obj) {
                    server.clientsByToken.delete(obj.token.id);
                    server.freeTokens.set(obj.token.id, obj.token);
                }
            }
        }
        catch (e) {
            errorHandler.handleError(obj.client, e);
        }
    };
    Promise.resolve(server.createServer(obj.client))
        .then(function (actions) {
        if (isConnected) {
            serverActions = actions;
            serverActionsCreated(serverActions);
        }
    })
        .catch(function (e) {
        socket.terminate();
        errorHandler.handleError(obj.client, e);
    });
}

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvc2VydmVyU29ja2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBQUEsbURBQXFGO0FBQ3JGLHlDQUF3RTtBQUV4RSx5REFBK0c7QUFJL0csNkNBR3VCO0FBQ3ZCLHVEQUF1SDtBQUN2SCxpREFBb0k7QUFDcEksMkJBQTZCO0FBRTdCLFNBQWdCLFlBQVksQ0FDM0IsVUFBMkMsRUFDM0MsVUFBMkMsRUFDM0MsWUFBNEMsRUFDNUMsT0FBdUIsRUFDdkIsWUFBMkIsRUFDM0IsR0FBWTtJQUVaLE9BQU8sZUFBZSxDQUFDLFlBQWtDLEVBQUUsSUFBQSxpQ0FBbUIsRUFBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLE9BQU8sQ0FBQyxFQUFFLFlBQVksRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNySSxDQUFDO0FBVEQsb0NBU0M7QUFFRCxTQUFnQixlQUFlLENBQzlCLFlBQWdDLEVBQUUsT0FBc0IsRUFDeEQsWUFBMkIsRUFBRSxHQUFZO0lBRXpDLElBQU0sSUFBSSxHQUFHLGdCQUFnQixDQUFDO1FBQzdCLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTtRQUNsQixZQUFZLGNBQUE7UUFDWixHQUFHLEtBQUE7UUFDSCxJQUFJLEVBQUcsT0FBc0IsQ0FBQyxJQUFJO1FBQ2xDLEdBQUcsRUFBRyxPQUEyQixDQUFDLEdBQUc7UUFDckMsaUJBQWlCLEVBQUUsT0FBTyxDQUFDLGlCQUFpQjtRQUM1QyxXQUFXLEVBQUUsT0FBTyxDQUFDLFdBQVc7S0FDaEMsQ0FBQyxDQUFDO0lBQ0gsSUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLGFBQUksRUFBRSxFQUFFLFFBQVEsSUFBSyxPQUFPLEVBQUcsQ0FBQztJQUMxRSxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDMUIsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBaEJELDBDQWdCQztBQUVELFNBQWdCLGdCQUFnQixDQUFD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O0lBR0YsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUM5QyxJQUFJLENBQUMsVUFBQSxPQUFPO1FBQ1osSUFBSSxXQUFXLEVBQUU7WUFDaEIsYUFBYSxHQUFHLE9BQU8sQ0FBQztZQUN4QixvQkFBb0IsQ0FBQyxhQUFhLENBQUMsQ0FBQztTQUNwQztJQUNGLENBQUMsQ0FBQztTQUNELEtBQUssQ0FBQyxVQUFBLENBQUM7UUFDUCxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDbkIsWUFBWSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3pDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyIsImZpbGUiOiJzZXJ2ZXIvc2VydmVyU29ja2V0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ2xpZW50T3B0aW9ucywgZ2V0TmFtZXMsIFNvY2tldFNlcnZlciwgTG9nZ2VyIH0gZnJvbSAnLi4vY29tbW9uL2ludGVyZmFjZXMnO1xuaW1wb3J0IHsgZ2V0TGVuZ3RoLCBjbG9uZURlZXAsIGNoZWNrUmF0ZUxpbWl0MiB9IGZyb20gJy4uL2NvbW1vbi91dGlscyc7XG5pbXBvcnQgeyBFcnJvckhhbmRsZXIsIE9yaWdpbmFsUmVxdWVzdCB9IGZyb20gJy4vc2VydmVyJztcbmltcG9ydCB7IE1lc3NhZ2VUeXBlLCBTZW5kLCBjcmVhdGVQYWNrZXRIYW5kbGVyLCBIYW5kbGVSZXN1bHQsIEhhbmRsZXJPcHRpb25zIH0gZnJvbSAnLi4vcGFja2V0L3BhY2tldEhhbmRsZXInO1xuaW1wb3J0IHtcblx0U2VydmVyLCBDbGllbnRTdGF0ZSwgSW50ZXJuYWxTZXJ2ZXIsIEdsb2JhbENvbmZpZywgU2VydmVySG9zdCwgQ3JlYXRlU2VydmVyTWV0aG9kLCBDcmVhdGVTZXJ2ZXIsIFNlcnZlck9wdGlvbnMsIFVXU1NvY2tldEV2ZW50cywgU2VydmVyQXBwT3B0aW9uLCBQb3J0T3B0aW9uXG59IGZyb20gJy4vc2VydmVySW50ZXJmYWNlcyc7XG5pbXBvcnQge1xuXHRoYXNUb2tlbiwgY3JlYXRlVG9rZW4sIGdldFRva2VuLCBnZXRUb2tlbkZyb21DbGllbnQsIHJldHVyblRydWUsIGNyZWF0ZU9yaWdpbmFsUmVxdWVzdCwgZGVmYXVsdEVycm9ySGFuZGxlcixcblx0Y3JlYXRlU2VydmVyT3B0aW9ucywgb3B0aW9uc1dpdGhEZWZhdWx0cywgdG9DbGllbnRPcHRpb25zLCBnZXRRdWVyeSwgY2FsbFdpdGhFcnJvckhhbmRsaW5nLCBwYXJzZVJhdGVMaW1pdERlZixcbn0gZnJvbSAnLi9zZXJ2ZXJVdGlscyc7XG5pbXBvcnQgeyBCaW5hcnlSZWFkZXIsIGNyZWF0ZUJpbmFyeVJlYWRlckZyb21CdWZmZXIsIGdldEJpbmFyeVJlYWRlckJ1ZmZlciwgcmVhZFN0cmluZyB9IGZyb20gJy4uL3BhY2tldC9iaW5hcnlSZWFkZXInO1xuaW1wb3J0IHsgQXBwLCBESVNBQkxFRCwgSHR0cFJlcXVlc3QsIFNIQVJFRF9DT01QUkVTU09SLCB1c19saXN0ZW5fc29ja2V0LCB1c19saXN0ZW5fc29ja2V0X2Nsb3NlLCBXZWJTb2NrZXQgfSBmcm9tICd1V2ViU29ja2V0cy5qcyc7XG5pbXBvcnQgKiBhcyBIVFRQIGZyb20gJ2h0dHAnO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2VydmVyPFRTZXJ2ZXIsIFRDbGllbnQ+KFxuXHRzZXJ2ZXJUeXBlOiBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBUU2VydmVyLFxuXHRjbGllbnRUeXBlOiBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBUQ2xpZW50LFxuXHRjcmVhdGVTZXJ2ZXI6IENyZWF0ZVNlcnZlcjxUU2VydmVyLCBUQ2xpZW50Pixcblx0b3B0aW9ucz86IFNlcnZlck9wdGlvbnMsXG5cdGVycm9ySGFuZGxlcj86IEVycm9ySGFuZGxlcixcblx0bG9nPzogTG9nZ2VyXG4pIHtcblx0cmV0dXJuIGNyZWF0ZVNlcnZlclJhdyhjcmVhdGVTZXJ2ZXIgYXMgQ3JlYXRlU2VydmVyTWV0aG9kLCBjcmVhdGVTZXJ2ZXJPcHRpb25zKHNlcnZlclR5cGUsIGNsaWVudFR5cGUsIG9wdGlvbnMpLCBlcnJvckhhbmRsZXIsIGxvZyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTZXJ2ZXJSYXcoXG5cdGNyZWF0ZVNlcnZlcjogQ3JlYXRlU2VydmVyTWV0aG9kLCBvcHRpb25zOiBTZXJ2ZXJPcHRpb25zLFxuXHRlcnJvckhhbmRsZXI/OiBFcnJvckhhbmRsZXIsIGxvZz86IExvZ2dlclxuKTogU2VydmVyIHtcblx0Y29uc3QgaG9zdCA9IGNyZWF0ZVNlcnZlckhvc3Qoe1xuXHRcdHBhdGg6IG9wdGlvbnMucGF0aCxcblx0XHRlcnJvckhhbmRsZXIsXG5cdFx0bG9nLFxuXHRcdHBvcnQ6IChvcHRpb25zIGFzIFBvcnRPcHRpb24pLnBvcnQsXG5cdFx0YXBwOiAob3B0aW9ucyBhcyBTZXJ2ZXJBcHBPcHRpb24pLmFwcCxcblx0XHRwZXJNZXNzYWdlRGVmbGF0ZTogb3B0aW9ucy5wZXJNZXNzYWdlRGVmbGF0ZSxcblx0XHRjb21wcmVzc2lvbjogb3B0aW9ucy5jb21wcmVzc2lvbixcblx0fSk7XG5cdGNvbnN0IHNvY2tldCA9IGhvc3Quc29ja2V0UmF3KGNyZWF0ZVNlcnZlciwgeyBpZDogJ3NvY2tldCcsIC4uLm9wdGlvbnMgfSk7XG5cdHNvY2tldC5jbG9zZSA9IGhvc3QuY2xvc2U7XG5cdHJldHVybiBzb2NrZXQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTZXJ2ZXJIb3N0KGdsb2JhbENvbmZpZzogR2xvYmFsQ29uZmlnKTogU2VydmVySG9zdCB7XG5cdGlmKCEoZ2xvYmFsQ29uZmlnIGFzIFNlcnZlckFwcE9wdGlvbikuYXBwICYmICEoZ2xvYmFsQ29uZmlnIGFzIFBvcnRPcHRpb24pLnBvcnQpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ1BvcnQgb3IgdVdlYlNvY2tldHMuanMgYXBwIG5vdCBwcm92aWRlZCcpO1xuXHR9XG5cdGlmKChnbG9iYWxDb25maWcgYXMgU2VydmVyQXBwT3B0aW9uKS5hcHAgJiYgKGdsb2JhbENvbmZpZyBhcyBQb3J0T3B0aW9uKS5wb3J0KSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdQcm92aWRlIHBvcnQgb3IgdVdlYlNvY2tldHMuanMgYXBwIGJ1dCBub3QgYm90aCcpO1xuXHR9XG5cdGNvbnN0IHV3c0FwcCA9IChnbG9iYWxDb25maWcgYXMgU2VydmVyQXBwT3B0aW9uKS5hcHAgfHwgQXBwKCk7XG5cdGNvbnN0IHtcblx0XHRwYXRoID0gJy93cycsXG5cdFx0bG9nID0gY29uc29sZS5sb2cuYmluZChjb25zb2xlKSxcblx0XHRlcnJvckhhbmRsZXIgPSBkZWZhdWx0RXJyb3JIYW5kbGVyLFxuXHRcdHBlck1lc3NhZ2VEZWZsYXRlID0gdHJ1ZSxcblx0XHRlcnJvckNvZGUgPSA0MDAsXG5cdFx0ZXJyb3JOYW1lID0gSFRUUC5TVEFUVVNfQ09ERVNbNDAwXSBhcyBzdHJpbmcsXG5cdFx0bmF0aXZlUGluZyA9IDAsXG5cdH0gPSBnbG9iYWxDb25maWc7XG5cdGNvbnN0IHNlcnZlcnM6IEludGVybmFsU2VydmVyW10gPSBbXTtcblxuXHRsZXQgdXBncmFkZVJlcTogT3JpZ2luYWxSZXF1ZXN0IHwgdW5kZWZpbmVkO1xuXHRsZXQgY29ubmVjdGVkU29ja2V0cyA9IG5ldyBNYXA8V2ViU29ja2V0LCBVV1NTb2NrZXRFdmVudHM+KCk7XG5cdHV3c0FwcC53cyhwYXRoLCB7XG5cdFx0Y29tcHJlc3Npb246IGdsb2JhbENvbmZpZy5jb21wcmVzc2lvbiA/IGdsb2JhbENvbmZpZy5jb21wcmVzc2lvbiA6IChwZXJNZXNzYWdlRGVmbGF0ZSA/IFNIQVJFRF9DT01QUkVTU09SIDogRElTQUJMRUQpLFxuXHRcdHNlbmRQaW5nc0F1dG9tYXRpY2FsbHk6ICEhbmF0aXZlUGluZyxcblx0XHRpZGxlVGltZW91dDogbmF0aXZlUGluZyA/IG5hdGl2ZVBpbmcgOiB1bmRlZmluZWQsXG5cblx0XHR1cGdyYWRlOiAocmVzLCByZXEsIGNvbnRleHQpID0+IHtcblx0XHRcdGlmICh1cGdyYWRlUmVxKSB7XG5cdFx0XHRcdHJlcy5lbmQoYEhUVFAvMS4xICR7NTAzfSAke0hUVFAuU1RBVFVTX0NPREVTWzUwM119XFxyXFxuXFxyXFxuYCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGxldCBhYm9ydGVkID0gZmFsc2U7XG5cdFx0XHRyZXMub25BYm9ydGVkKCgpID0+IHtcblx0XHRcdFx0YWJvcnRlZCA9IHRydWU7XG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IHVybCA9IHJlcS5nZXRVcmwoKTtcblx0XHRcdGNvbnN0IHNlY1dlYlNvY2tldEtleSA9IHJlcS5nZXRIZWFkZXIoJ3NlYy13ZWJzb2NrZXQta2V5Jyk7XG5cdFx0XHRjb25zdCBzZWNXZWJTb2NrZXRQcm90b2NvbCA9IHJlcS5nZXRIZWFkZXIoJ3NlYy13ZWJzb2NrZXQtcHJvdG9jb2wnKTtcblx0XHRcdGNvbnN0IHNlY1dlYlNvY2tldEV4dGVuc2lvbnMgPSByZXEuZ2V0SGVhZGVyKCdzZWMtd2Vic29ja2V0LWV4dGVuc2lvbnMnKTtcblxuXHRcdFx0aWYgKGdsb2JhbENvbmZpZy5wYXRoICYmIGdsb2JhbENvbmZpZy5wYXRoICE9PSB1cmwuc3BsaXQoJz8nKVswXS5zcGxpdCgnIycpWzBdKSB7XG5cdFx0XHRcdHJlcy5lbmQoYEhUVFAvMS4xICR7NDAwfSAke0hUVFAuU1RBVFVTX0NPREVTWzQwMF19XFxyXFxuXFxyXFxuYCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgb3JpZ2luYWxSZXF1ZXN0ID0gY3JlYXRlT3JpZ2luYWxSZXF1ZXN0KHJlcSk7XG5cdFx0XHR2ZXJpZnlDbGllbnQocmVxLCAocmVzdWx0LCBjb2RlLCBuYW1lKSA9PiB7XG5cdFx0XHRcdGlmIChhYm9ydGVkKSByZXR1cm47XG5cdFx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0XHR1cGdyYWRlUmVxID0gb3JpZ2luYWxSZXF1ZXN0O1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRyZXMudXBncmFkZSh7dXJsfSxcblx0XHRcdFx0XHRcdFx0c2VjV2ViU29ja2V0S2V5LFxuXHRcdFx0XHRcdFx0XHRzZWNXZWJTb2NrZXRQcm90b2NvbCxcblx0XHRcdFx0XHRcdFx0c2VjV2ViU29ja2V0RXh0ZW5zaW9ucyxcblx0XHRcdFx0XHRcdFx0Y29udGV4dCk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXMuZW5kKGBIVFRQLzEuMSAke2NvZGV9ICR7bmFtZX1cXHJcXG5cXHJcXG5gKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSxcblx0XHRvcGVuOiAod3MpID0+IHtcblx0XHRcdGlmICghdXBncmFkZVJlcSkge1xuXHRcdFx0XHR3cy5jbG9zZSgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB1d3NTb2NrZXRFdmVudHM6IFVXU1NvY2tldEV2ZW50cyA9IHtcblx0XHRcdFx0c29ja2V0OiB3cyxcblx0XHRcdFx0b25DbG9zZTogKCkgPT4ge30sXG5cdFx0XHRcdG9uTWVzc2FnZTogKCkgPT4ge30sXG5cdFx0XHRcdGlzQ2xvc2VkOiBmYWxzZSxcblx0XHRcdH07XG5cdFx0XHRjb25uZWN0U29ja2V0KHVwZ3JhZGVSZXEsIHV3c1NvY2tldEV2ZW50cyk7XG5cblx0XHRcdGNvbm5lY3RlZFNvY2tldHMuc2V0KHdzLCB1d3NTb2NrZXRFdmVudHMpO1xuXHRcdFx0dXBncmFkZVJlcSA9IHVuZGVmaW5lZDtcblx0XHR9LFxuXHRcdG1lc3NhZ2Uod3MsIG1lc3NhZ2UsIGlzQmluYXJ5KSB7XG5cdFx0XHRjb25uZWN0ZWRTb2NrZXRzLmdldCh3cykhLm9uTWVzc2FnZShtZXNzYWdlLCBpc0JpbmFyeSk7XG5cdFx0fSxcblx0XHRjbG9zZSh3cywgY29kZSwgbWVzc2FnZSkge1xuXHRcdFx0Y29uc3QgZXZlbnRzID0gY29ubmVjdGVkU29ja2V0cy5nZXQod3MpITtcblx0XHRcdGlmIChldmVudHMpIHtcblx0XHRcdFx0ZXZlbnRzLmlzQ2xvc2VkID0gdHJ1ZTsvL1xuXHRcdFx0XHRldmVudHMub25DbG9zZShjb2RlLCBtZXNzYWdlKTtcblx0XHRcdFx0Y29ubmVjdGVkU29ja2V0cy5kZWxldGUod3MpO1xuXHRcdFx0fVxuXHRcdH0sXG5cdH0pO1xuXG5cdGxldCBzb2NrZXRUb2tlbjogdXNfbGlzdGVuX3NvY2tldCB8IHVuZGVmaW5lZDtcblx0aWYgKChnbG9iYWxDb25maWcgYXMgUG9ydE9wdGlvbikucG9ydCkge1xuXHRcdGNvbnN0IHBvcnQgPSAoZ2xvYmFsQ29uZmlnIGFzIFBvcnRPcHRpb24pLnBvcnQ7XG5cdFx0dXdzQXBwLmxpc3Rlbihwb3J0LCB0b2tlbiA9PiB7XG5cdFx0XHRpZiAodG9rZW4pIHtcblx0XHRcdFx0c29ja2V0VG9rZW4gPSB0b2tlbjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihudWxsLCBuZXcgRXJyb3IoYEZhaWxlZCB0byBsaXN0ZW4gdG8gcG9ydCAke3BvcnR9YCkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0U2VydmVyKGlkOiBhbnkpIHtcblx0XHRpZiAoc2VydmVycy5sZW5ndGggPT09IDEpIHJldHVybiBzZXJ2ZXJzWzBdO1xuXG5cdFx0Zm9yIChjb25zdCBzZXJ2ZXIgb2Ygc2VydmVycykge1xuXHRcdFx0aWYgKHNlcnZlci5pZCA9PT0gaWQpIHJldHVybiBzZXJ2ZXI7XG5cdFx0fVxuXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBObyBzZXJ2ZXIgZm9yIGdpdmVuIGlkICgke2lkfSlgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHZlcmlmeUNsaWVudChyZXEgOiBIdHRwUmVxdWVzdCwgbmV4dDogKHJlc3VsdDogYW55LCBjb2RlOiBudW1iZXIsIG5hbWU6IHN0cmluZykgPT4gdm9pZCkge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBxdWVyeSA9IGdldFF1ZXJ5KHJlcS5nZXRVcmwoKSk7XG5cdFx0XHRjb25zdCBzZXJ2ZXIgPSBnZXRTZXJ2ZXIocXVlcnkuaWQpO1xuXG5cdFx0XHRpZiAoIXNlcnZlci52ZXJpZnlDbGllbnQocmVxKSkge1xuXHRcdFx0XHRuZXh0KGZhbHNlLCBlcnJvckNvZGUsIGVycm9yTmFtZSk7XG5cdFx0XHR9IGVsc2UgaWYgKHNlcnZlci5jbGllbnRMaW1pdCAhPT0gMCAmJiBzZXJ2ZXIuY2xpZW50TGltaXQgPD0gc2VydmVyLmNsaWVudHMubGVuZ3RoKSB7XG5cdFx0XHRcdG5leHQoZmFsc2UsIGVycm9yQ29kZSwgZXJyb3JOYW1lKTtcblx0XHRcdH0gZWxzZSBpZiAoc2VydmVyLmNvbm5lY3Rpb25Ub2tlbnMpIHtcblx0XHRcdFx0aWYgKGhhc1Rva2VuKHNlcnZlciwgcXVlcnkudCkpIHtcblx0XHRcdFx0XHRuZXh0KHRydWUsIDIwMCwgJ09LJyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bmV4dChmYWxzZSwgZXJyb3JDb2RlLCBlcnJvck5hbWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuZXh0KHRydWUsIDIwMCwgJ09LJyk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0ZXJyb3JIYW5kbGVyLmhhbmRsZUVycm9yKG51bGwsIGUpO1xuXHRcdFx0bmV4dChmYWxzZSwgZXJyb3JDb2RlLCBlcnJvck5hbWUpO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGNsb3NlKCkge1xuXHRcdHNlcnZlcnMuZm9yRWFjaChjbG9zZVNlcnZlcik7XG5cdFx0Y29ubmVjdGVkU29ja2V0cy5mb3JFYWNoKChfLCBzb2NrZXQpID0+IHNvY2tldC5lbmQoKSk7XG5cdFx0aWYgKHNvY2tldFRva2VuKSB7XG5cdFx0XHR1c19saXN0ZW5fc29ja2V0X2Nsb3NlKHNvY2tldFRva2VuKTtcblx0XHRcdHNvY2tldFRva2VuID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGNsb3NlQW5kUmVtb3ZlU2VydmVyKHNlcnZlcjogSW50ZXJuYWxTZXJ2ZXIpIHtcblx0XHRjbG9zZVNlcnZlcihzZXJ2ZXIpO1xuXHRcdGNvbnN0IGluZGV4ID0gc2VydmVycy5pbmRleE9mKHNlcnZlcik7XG5cdFx0aWYgKGluZGV4ICE9PSAtMSkgc2VydmVycy5zcGxpY2UoaW5kZXgsIDEpO1xuXHR9XG5cblx0ZnVuY3Rpb24gc29ja2V0PFRTZXJ2ZXIsIFRDbGllbnQ+KFxuXHRcdHNlcnZlclR5cGU6IG5ldyAoLi4uYXJnczogYW55W10pID0+IFRTZXJ2ZXIsXG5cdFx0Y2xpZW50VHlwZTogbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gVENsaWVudCxcblx0XHRjcmVhdGVTZXJ2ZXI6IENyZWF0ZVNlcnZlcjxUU2VydmVyLCBUQ2xpZW50Pixcblx0XHRiYXNlT3B0aW9ucz86IFNlcnZlck9wdGlvbnNcblx0KTogU2VydmVyIHtcblx0XHRjb25zdCBvcHRpb25zID0gY3JlYXRlU2VydmVyT3B0aW9ucyhzZXJ2ZXJUeXBlLCBjbGllbnRUeXBlLCBiYXNlT3B0aW9ucyk7XG5cdFx0cmV0dXJuIHNvY2tldFJhdyhjcmVhdGVTZXJ2ZXIgYXMgQ3JlYXRlU2VydmVyTWV0aG9kLCBvcHRpb25zKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHNvY2tldFJhdyhjcmVhdGVTZXJ2ZXI6IENyZWF0ZVNlcnZlck1ldGhvZCwgb3B0aW9uczogU2VydmVyT3B0aW9ucyk6IFNlcnZlciB7XG5cdFx0Y29uc3QgaW50ZXJuYWxTZXJ2ZXIgPSBjcmVhdGVJbnRlcm5hbFNlcnZlcihjcmVhdGVTZXJ2ZXIsIHsgLi4ub3B0aW9ucywgcGF0aCB9LCBlcnJvckhhbmRsZXIsIGxvZyk7XG5cblx0XHRpZiAoc2VydmVycy5zb21lKHMgPT4gcy5pZCA9PT0gaW50ZXJuYWxTZXJ2ZXIuaWQpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBvcGVuIHR3byBzb2NrZXRzIHdpdGggdGhlIHNhbWUgaWQnKTtcblx0XHR9XG5cblx0XHRzZXJ2ZXJzLnB1c2goaW50ZXJuYWxTZXJ2ZXIpO1xuXHRcdGludGVybmFsU2VydmVyLnNlcnZlci5jbG9zZSA9ICgpID0+IGNsb3NlQW5kUmVtb3ZlU2VydmVyKGludGVybmFsU2VydmVyKTtcblx0XHRyZXR1cm4gaW50ZXJuYWxTZXJ2ZXIuc2VydmVyO1xuXHR9XG5cblx0ZnVuY3Rpb24gY29ubmVjdFNvY2tldChvcmlnaW5hbFJlcXVlc3Q6IE9yaWdpbmFsUmVxdWVzdCwgc29ja2V0RXZlbnRzOiBVV1NTb2NrZXRFdmVudHMpIHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcXVlcnkgPSBnZXRRdWVyeShvcmlnaW5hbFJlcXVlc3QudXJsKTtcblx0XHRcdGNvbnN0IHNlcnZlciA9IGdldFNlcnZlcihxdWVyeS5pZCk7XG5cblx0XHRcdGNvbm5lY3RDbGllbnQoc2VydmVyLCBvcmlnaW5hbFJlcXVlc3QsIGVycm9ySGFuZGxlciwgbG9nLCBzb2NrZXRFdmVudHMpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGlmICghc29ja2V0RXZlbnRzLmlzQ2xvc2VkKSB7XG5cdFx0XHRcdHNvY2tldEV2ZW50cy5zb2NrZXQuZW5kKCk7XG5cdFx0XHR9XG5cdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3IobnVsbCwgZSk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHsgY2xvc2UsIHNvY2tldCwgc29ja2V0UmF3LCBhcHA6IHV3c0FwcCB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVJbnRlcm5hbFNlcnZlcihcblx0Y3JlYXRlU2VydmVyOiBDcmVhdGVTZXJ2ZXJNZXRob2QsIG9wdGlvbnM6IFNlcnZlck9wdGlvbnMsIGVycm9ySGFuZGxlcjogRXJyb3JIYW5kbGVyLCBsb2c6IExvZ2dlcixcbik6IEludGVybmFsU2VydmVyIHtcblx0b3B0aW9ucyA9IG9wdGlvbnNXaXRoRGVmYXVsdHMob3B0aW9ucyk7XG5cblx0Y29uc3Qgb25TZW5kID0gb3B0aW9ucy5vblNlbmQ7XG5cdGNvbnN0IGhhbmRsZXJPcHRpb25zOiBIYW5kbGVyT3B0aW9ucyA9IHtcblx0XHRkZWJ1Zzogb3B0aW9ucy5kZWJ1Zyxcblx0XHRkZXZlbG9wbWVudDogb3B0aW9ucy5kZXZlbG9wbWVudCxcblx0XHRmb3JjZUJpbmFyeTogb3B0aW9ucy5mb3JjZUJpbmFyeSxcblx0XHRmb3JjZUJpbmFyeVBhY2tldHM6IG9wdGlvbnMuZm9yY2VCaW5hcnlQYWNrZXRzLFxuXHRcdG9uU2VuZCxcblx0XHRvblJlY3Y6IG9wdGlvbnMub25SZWN2LFxuXHRcdHVzZUJ1ZmZlcjogdHJ1ZSxcblx0fTtcblxuXHRjb25zdCBwYWNrZXRIYW5kbGVyID0gY3JlYXRlUGFja2V0SGFuZGxlcihvcHRpb25zLnNlcnZlciwgb3B0aW9ucy5jbGllbnQsIGhhbmRsZXJPcHRpb25zLCBsb2cpO1xuXHRjb25zdCBjbGllbnRPcHRpb25zID0gdG9DbGllbnRPcHRpb25zKG9wdGlvbnMpO1xuXHRjb25zdCBjbGllbnRNZXRob2RzID0gZ2V0TmFtZXMob3B0aW9ucy5jbGllbnQhKTtcblx0Y29uc3Qgc2VydmVyOiBJbnRlcm5hbFNlcnZlciA9IHtcblx0XHRpZDogb3B0aW9ucy5pZCA/PyAnc29ja2V0Jyxcblx0XHRjbGllbnRzOiBbXSxcblx0XHRmcmVlVG9rZW5zOiBuZXcgTWFwKCksXG5cdFx0Y2xpZW50c0J5VG9rZW46IG5ldyBNYXAoKSxcblx0XHR0b3RhbFNlbnQ6IDAsXG5cdFx0dG90YWxSZWNlaXZlZDogMCxcblx0XHRjdXJyZW50Q2xpZW50SWQ6IG9wdGlvbnMuY2xpZW50QmFzZUlkID8/IDEsXG5cdFx0cGF0aDogb3B0aW9ucy5wYXRoID8/ICcnLFxuXHRcdGhhc2g6IG9wdGlvbnMuaGFzaCA/PyAnJyxcblx0XHRkZWJ1ZzogISFvcHRpb25zLmRlYnVnLFxuXHRcdGZvcmNlQmluYXJ5OiAhIW9wdGlvbnMuZm9yY2VCaW5hcnksXG5cdFx0Y29ubmVjdGlvblRva2VuczogISFvcHRpb25zLmNvbm5lY3Rpb25Ub2tlbnMsXG5cdFx0a2VlcE9yaWdpbmFsUmVxdWVzdDogISFvcHRpb25zLmtlZXBPcmlnaW5hbFJlcXVlc3QsXG5cdFx0ZXJyb3JJZk5vdENvbm5lY3RlZDogISFvcHRpb25zLmVycm9ySWZOb3RDb25uZWN0ZWQsXG5cdFx0dG9rZW5MaWZldGltZTogb3B0aW9ucy50b2tlbkxpZmV0aW1lID8/IDAsXG5cdFx0Y2xpZW50TGltaXQ6IG9wdGlvbnMuY2xpZW50TGltaXQgPz8gMCxcblx0XHR0cmFuc2ZlckxpbWl0OiBvcHRpb25zLnRyYW5zZmVyTGltaXQgPz8gMCxcblx0XHR2ZXJpZnlDbGllbnQ6IG9wdGlvbnMudmVyaWZ5Q2xpZW50ID8/IHJldHVyblRydWUsXG5cdFx0Y3JlYXRlQ2xpZW50OiBvcHRpb25zLmNyZWF0ZUNsaWVudCxcblx0XHRzZXJ2ZXJNZXRob2RzOiBvcHRpb25zLnNlcnZlciEsXG5cdFx0Y2xpZW50TWV0aG9kcyxcblx0XHRyYXRlTGltaXRzOiBvcHRpb25zLnNlcnZlciEubWFwKHBhcnNlUmF0ZUxpbWl0RGVmKSxcblx0XHRoYW5kbGVSZXN1bHQsXG5cdFx0Y3JlYXRlU2VydmVyLFxuXHRcdHBhY2tldEhhbmRsZXIsXG5cdFx0c2VydmVyOiB7fSBhcyBhbnksXG5cdFx0cGluZ0ludGVydmFsOiB1bmRlZmluZWQsXG5cdFx0dG9rZW5JbnRlcnZhbDogdW5kZWZpbmVkLFxuXHR9O1xuXG5cdGZ1bmN0aW9uIGhhbmRsZVJlc3VsdChzZW5kOiBTZW5kLCBvYmo6IENsaWVudFN0YXRlLCBmdW5jSWQ6IG51bWJlciwgZnVuY05hbWU6IHN0cmluZywgcmVzdWx0OiBQcm9taXNlPGFueT4sIG1lc3NhZ2VJZDogbnVtYmVyKSB7XG5cdFx0aWYgKHJlc3VsdCAmJiB0eXBlb2YgcmVzdWx0LnRoZW4gPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHJlc3VsdC50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRcdGlmIChvYmouY2xpZW50LmlzQ29ubmVjdGVkKCkpIHtcblx0XHRcdFx0XHRwYWNrZXRIYW5kbGVyLnNlbmRTdHJpbmcoc2VuZCwgYCpyZXNvbHZlOiR7ZnVuY05hbWV9YCwgTWVzc2FnZVR5cGUuUmVzb2x2ZWQsIFtmdW5jSWQsIG1lc3NhZ2VJZCwgcmVzdWx0XSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIChlOiBFcnJvcikgPT4ge1xuXHRcdFx0XHRlID0gZXJyb3JIYW5kbGVyLmhhbmRsZVJlamVjdGlvbihvYmouY2xpZW50LCBlKSB8fCBlO1xuXHRcdFx0XHRpZiAob2JqLmNsaWVudC5pc0Nvbm5lY3RlZCgpKSB7XG5cdFx0XHRcdFx0cGFja2V0SGFuZGxlci5zZW5kU3RyaW5nKHNlbmQsIGAqcmVqZWN0OiR7ZnVuY05hbWV9YCwgTWVzc2FnZVR5cGUuUmVqZWN0ZWQsIFtmdW5jSWQsIG1lc3NhZ2VJZCwgZSA/IGUubWVzc2FnZSA6ICdlcnJvciddKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkuY2F0Y2goKGU6IEVycm9yKSA9PiBlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3Iob2JqLmNsaWVudCwgZSkpO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IHBpbmdJbnRlcnZhbCA9IG9wdGlvbnMucGluZ0ludGVydmFsO1xuXG5cdGlmIChwaW5nSW50ZXJ2YWwpIHtcblx0XHRzZXJ2ZXIucGluZ0ludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXHRcdFx0Y29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblx0XHRcdGNvbnN0IHRocmVzaG9sZCA9IG5vdyAtIHBpbmdJbnRlcnZhbDtcblx0XHRcdGNvbnN0IHRpbWVvdXRUaHJlc2hvbGQgPSBub3cgLSBvcHRpb25zLmNvbm5lY3Rpb25UaW1lb3V0ITtcblxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzZXJ2ZXIuY2xpZW50cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBjID0gc2VydmVyLmNsaWVudHNbaV07XG5cblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRpZiAoYy5sYXN0TWVzc2FnZVRpbWUgPCB0aW1lb3V0VGhyZXNob2xkKSB7XG5cdFx0XHRcdFx0XHRjLmNsaWVudC5kaXNjb25uZWN0KHRydWUsIGZhbHNlLCAndGltZW91dCcpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoYy5sYXN0U2VuZFRpbWUgPCB0aHJlc2hvbGQpIHtcblx0XHRcdFx0XHRcdGMucGluZygpO1xuXHRcdFx0XHRcdFx0aWYgKG9uU2VuZCkgb25TZW5kKC0xLCAnUElORycsIDAsIGZhbHNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gY2F0Y2ggeyB9XG5cdFx0XHR9XG5cdFx0fSwgcGluZ0ludGVydmFsKTtcblx0fVxuXG5cdGlmIChvcHRpb25zLmNvbm5lY3Rpb25Ub2tlbnMpIHtcblx0XHRzZXJ2ZXIudG9rZW5JbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcblx0XHRcdGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cdFx0XHRjb25zdCBpZHM6IHN0cmluZ1tdID0gW107XG5cblx0XHRcdHNlcnZlci5mcmVlVG9rZW5zLmZvckVhY2godG9rZW4gPT4ge1xuXHRcdFx0XHRpZiAodG9rZW4uZXhwaXJlIDwgbm93KSB7XG5cdFx0XHRcdFx0aWRzLnB1c2godG9rZW4uaWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Zm9yIChjb25zdCBpZCBvZiBpZHMpIHtcblx0XHRcdFx0c2VydmVyLmZyZWVUb2tlbnMuZGVsZXRlKGlkKTtcblx0XHRcdH1cblx0XHR9LCAxMDAwMCk7XG5cdH1cblxuXHRzZXJ2ZXIuc2VydmVyID0ge1xuXHRcdGdldCBjbGllbnRzKCkge1xuXHRcdFx0cmV0dXJuIHNlcnZlci5jbGllbnRzO1xuXHRcdH0sXG5cdFx0Y2xvc2UoKSB7XG5cdFx0XHRjbG9zZVNlcnZlcihzZXJ2ZXIpO1xuXHRcdH0sXG5cdFx0b3B0aW9ucygpOiBDbGllbnRPcHRpb25zIHtcblx0XHRcdHJldHVybiBjbG9uZURlZXAoY2xpZW50T3B0aW9ucyk7XG5cdFx0fSxcblx0XHR0b2tlbihkYXRhPzogYW55KSB7XG5cdFx0XHRyZXR1cm4gY3JlYXRlVG9rZW4oc2VydmVyLCBkYXRhKS5pZDtcblx0XHR9LFxuXHRcdGNsZWFyVG9rZW4oaWQ6IHN0cmluZykge1xuXHRcdFx0c2VydmVyLmZyZWVUb2tlbnMuZGVsZXRlKGlkKTtcblx0XHRcdHNlcnZlci5jbGllbnRzQnlUb2tlbi5nZXQoaWQpPy5jbGllbnQuZGlzY29ubmVjdCh0cnVlLCB0cnVlLCAnY2xlYXIgdG9rZW5zJyk7XG5cdFx0fSxcblx0XHRjbGVhclRva2Vucyh0ZXN0OiAoaWQ6IHN0cmluZywgZGF0YT86IGFueSkgPT4gYm9vbGVhbikge1xuXHRcdFx0Y29uc3QgaWRzOiBzdHJpbmdbXSA9IFtdO1xuXG5cdFx0XHRzZXJ2ZXIuZnJlZVRva2Vucy5mb3JFYWNoKHRva2VuID0+IHtcblx0XHRcdFx0aWYgKHRlc3QodG9rZW4uaWQsIHRva2VuLmRhdGEpKSB7XG5cdFx0XHRcdFx0aWRzLnB1c2godG9rZW4uaWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0c2VydmVyLmNsaWVudHNCeVRva2VuLmZvckVhY2goKHsgdG9rZW4gfSkgPT4ge1xuXHRcdFx0XHRpZiAodG9rZW4gJiYgdGVzdCh0b2tlbi5pZCwgdG9rZW4uZGF0YSkpIHtcblx0XHRcdFx0XHRpZHMucHVzaCh0b2tlbi5pZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGlkIG9mIGlkcykge1xuXHRcdFx0XHR0aGlzLmNsZWFyVG9rZW4oaWQpO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0aW5mbygpIHtcblx0XHRcdGNvbnN0IHdyaXRlckJ1ZmZlclNpemUgPSBwYWNrZXRIYW5kbGVyLndyaXRlckJ1ZmZlclNpemUoKTtcblx0XHRcdGNvbnN0IGZyZWVUb2tlbnMgPSBzZXJ2ZXIuZnJlZVRva2Vucy5zaXplO1xuXHRcdFx0Y29uc3QgY2xpZW50c0J5VG9rZW4gPSBzZXJ2ZXIuY2xpZW50c0J5VG9rZW4uc2l6ZTtcblx0XHRcdHJldHVybiB7IHdyaXRlckJ1ZmZlclNpemUsIGZyZWVUb2tlbnMsIGNsaWVudHNCeVRva2VuIH07XG5cdFx0fSxcblx0fTtcblxuXHRyZXR1cm4gc2VydmVyO1xufVxuXG5mdW5jdGlvbiBjbG9zZVNlcnZlcihzZXJ2ZXI6IEludGVybmFsU2VydmVyKSB7XG5cdGlmIChzZXJ2ZXIucGluZ0ludGVydmFsKSB7XG5cdFx0Y2xlYXJJbnRlcnZhbChzZXJ2ZXIucGluZ0ludGVydmFsKTtcblx0XHRzZXJ2ZXIucGluZ0ludGVydmFsID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0aWYgKHNlcnZlci50b2tlbkludGVydmFsKSB7XG5cdFx0Y2xlYXJJbnRlcnZhbChzZXJ2ZXIudG9rZW5JbnRlcnZhbCk7XG5cdFx0c2VydmVyLnRva2VuSW50ZXJ2YWwgPSB1bmRlZmluZWQ7XG5cdH1cbn1cblxuZnVuY3Rpb24gY29ubmVjdENsaWVudChcblx0c2VydmVyOiBJbnRlcm5hbFNlcnZlciwgb3JpZ2luYWxSZXF1ZXN0OiBPcmlnaW5hbFJlcXVlc3QsIGVycm9ySGFuZGxlcjogRXJyb3JIYW5kbGVyLCBsb2c6IExvZ2dlcixcblx0dXdzU29ja2V0RXZlbnRzOiBVV1NTb2NrZXRFdmVudHNcbikge1xuXHRjb25zdCBzb2NrZXQgPSB1d3NTb2NrZXRFdmVudHMuc29ja2V0O1xuXHRjb25zdCBxdWVyeSA9IGdldFF1ZXJ5KG9yaWdpbmFsUmVxdWVzdC51cmwpO1xuXHRjb25zdCB0ID0gKHF1ZXJ5LnQgfHwgJycpIGFzIHN0cmluZztcblx0Y29uc3QgdG9rZW4gPSBzZXJ2ZXIuY29ubmVjdGlvblRva2VucyA/IGdldFRva2VuKHNlcnZlciwgdCkgfHwgZ2V0VG9rZW5Gcm9tQ2xpZW50KHNlcnZlciwgdCkgOiB1bmRlZmluZWQ7XG5cblx0aWYgKHNlcnZlci5oYXNoICYmIHF1ZXJ5Lmhhc2ggIT09IHNlcnZlci5oYXNoKSB7XG5cdFx0aWYgKHNlcnZlci5kZWJ1ZykgbG9nKCdjbGllbnQgZGlzY29ubmVjdGVkIChoYXNoIG1pc21hdGNoKScpO1xuXG5cdFx0c29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoW01lc3NhZ2VUeXBlLlZlcnNpb24sIHNlcnZlci5oYXNoXSkpO1xuXHRcdGlmICghdXdzU29ja2V0RXZlbnRzLmlzQ2xvc2VkKSB7XG5cdFx0XHRzb2NrZXQuZW5kKCk7XG5cdFx0fVxuXHRcdHJldHVybjtcblx0fVxuXG5cdGlmIChzZXJ2ZXIuY29ubmVjdGlvblRva2VucyAmJiAhdG9rZW4pIHtcblx0XHRlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3IoeyBvcmlnaW5hbFJlcXVlc3QgfSBhcyBhbnksIG5ldyBFcnJvcihgSW52YWxpZCB0b2tlbjogJHt0fWApKTtcblx0XHRpZiAoIXV3c1NvY2tldEV2ZW50cy5pc0Nsb3NlZCkge1xuXHRcdFx0dXdzU29ja2V0RXZlbnRzLnNvY2tldC5lbmQoKTtcblx0XHR9XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3QgY2FsbHNMaXN0OiBudW1iZXJbXSA9IFtdO1xuXHRjb25zdCB7IGhhbmRsZVJlc3VsdCwgY3JlYXRlQ2xpZW50ID0geCA9PiB4IH0gPSBzZXJ2ZXI7XG5cblx0bGV0IGJ5dGVzUmVzZXQgPSBEYXRlLm5vdygpO1xuXHRsZXQgYnl0ZXNSZWNlaXZlZCA9IDA7XG5cdGxldCB0cmFuc2ZlckxpbWl0RXhjZWVkZWQgPSBmYWxzZTtcblx0bGV0IGlzQ29ubmVjdGVkID0gdHJ1ZTtcblx0bGV0IHNlcnZlckFjdGlvbnM6IFNvY2tldFNlcnZlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0bGV0IGNsb3NlUmVhc29uOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0Y29uc3Qgb2JqOiBDbGllbnRTdGF0ZSA9IHtcblx0XHRsYXN0TWVzc2FnZVRpbWU6IERhdGUubm93KCksXG5cdFx0bGFzdE1lc3NhZ2VJZDogMCxcblx0XHRsYXN0U2VuZFRpbWU6IERhdGUubm93KCksXG5cdFx0c2VudFNpemU6IDAsXG5cdFx0c3VwcG9ydHNCaW5hcnk6ICEhc2VydmVyLmZvcmNlQmluYXJ5IHx8ICEhKHF1ZXJ5ICYmIHF1ZXJ5LmJpbiA9PT0gJ3RydWUnKSxcblx0XHR0b2tlbixcblx0XHRwaW5nKCkge1xuXHRcdFx0c29ja2V0LnNlbmQoJycpO1xuXHRcdH0sXG5cdFx0Y2xpZW50OiBjcmVhdGVDbGllbnQoe1xuXHRcdFx0aWQ6IHNlcnZlci5jdXJyZW50Q2xpZW50SWQrKyxcblx0XHRcdHRva2VuSWQ6IHRva2VuID8gdG9rZW4uaWQgOiB1bmRlZmluZWQsXG5cdFx0XHR0b2tlbkRhdGE6IHRva2VuID8gdG9rZW4uZGF0YSA6IHVuZGVmaW5lZCxcblx0XHRcdG9yaWdpbmFsUmVxdWVzdDogc2VydmVyLmtlZXBPcmlnaW5hbFJlcXVlc3QgPyBvcmlnaW5hbFJlcXVlc3QgOiB1bmRlZmluZWQsXG5cdFx0XHR0cmFuc2ZlckxpbWl0OiBzZXJ2ZXIudHJhbnNmZXJMaW1pdCxcblx0XHRcdGlzQ29ubmVjdGVkKCkge1xuXHRcdFx0XHRyZXR1cm4gaXNDb25uZWN0ZWQ7XG5cdFx0XHR9LFxuXHRcdFx0bGFzdE1lc3NhZ2VUaW1lKCkge1xuXHRcdFx0XHRyZXR1cm4gb2JqLmxhc3RNZXNzYWdlVGltZTtcblx0XHRcdH0sXG5cdFx0XHRkaXNjb25uZWN0KGZvcmNlID0gZmFsc2UsIGludmFsaWRhdGVUb2tlbiA9IGZhbHNlLCByZWFzb24gPSAnJykge1xuXHRcdFx0XHRpc0Nvbm5lY3RlZCA9IGZhbHNlO1xuXG5cdFx0XHRcdGlmIChpbnZhbGlkYXRlVG9rZW4gJiYgb2JqLnRva2VuKSB7XG5cdFx0XHRcdFx0aWYgKHNlcnZlci5jbGllbnRzQnlUb2tlbi5nZXQob2JqLnRva2VuLmlkKSA9PT0gb2JqKSB7XG5cdFx0XHRcdFx0XHRzZXJ2ZXIuY2xpZW50c0J5VG9rZW4uZGVsZXRlKG9iai50b2tlbi5pZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG9iai50b2tlbiA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChmb3JjZSkge1xuXHRcdFx0XHRcdGlmICghdXdzU29ja2V0RXZlbnRzKSB7XG5cdFx0XHRcdFx0XHRzb2NrZXQuZW5kKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNsb3NlUmVhc29uID0gcmVhc29uO1xuXHRcdFx0XHRcdHNvY2tldC5jbG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdH0sIHNlbmQpLFxuXHR9O1xuXG5cdGlmIChvYmoudG9rZW4pIHtcblx0XHRzZXJ2ZXIuY2xpZW50c0J5VG9rZW4uc2V0KG9iai50b2tlbi5pZCwgb2JqKTtcblx0fVxuXG5cdC8vIFRPRE86IHJlbW92ZSBVaW50OEFycmF5IGZyb20gaGVyZVxuXHRmdW5jdGlvbiBzZW5kKGRhdGE6IHN0cmluZyB8IFVpbnQ4QXJyYXkgfCBCdWZmZXIpIHtcblx0XHRpZiAoc2VydmVyLmVycm9ySWZOb3RDb25uZWN0ZWQgJiYgIWlzQ29ubmVjdGVkKSB7XG5cdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3Iob2JqLmNsaWVudCwgbmV3IEVycm9yKCdOb3QgQ29ubmVjdGVkJykpO1xuXHRcdH1cblxuXHRcdGlmIChkYXRhIGluc3RhbmNlb2YgQnVmZmVyKSB7XG5cdFx0XHRzZXJ2ZXIudG90YWxTZW50ICs9IGRhdGEuYnl0ZUxlbmd0aDtcblx0XHRcdHNvY2tldC5zZW5kKGRhdGEsIHRydWUpO1xuXHRcdH0gZWxzZSBpZiAodHlwZW9mIGRhdGEgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRzZXJ2ZXIudG90YWxTZW50ICs9IGRhdGEuYnl0ZUxlbmd0aDtcblx0XHRcdHNvY2tldC5zZW5kKEJ1ZmZlci5mcm9tKGRhdGEuYnVmZmVyLCBkYXRhLmJ5dGVPZmZzZXQsIGRhdGEuYnl0ZUxlbmd0aCksIHRydWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzZXJ2ZXIudG90YWxTZW50ICs9IGRhdGEubGVuZ3RoO1xuXHRcdFx0c29ja2V0LnNlbmQoZGF0YSwgZmFsc2UpO1xuXHRcdH1cblxuXHRcdG9iai5sYXN0U2VuZFRpbWUgPSBEYXRlLm5vdygpO1xuXHR9XG5cblx0Y29uc3QgaGFuZGxlUmVzdWx0MjogSGFuZGxlUmVzdWx0ID0gKGZ1bmNJZCwgZnVuZE5hbWUsIHJlc3VsdCwgbWVzc2FnZUlkKSA9PiB7XG5cdFx0aGFuZGxlUmVzdWx0KHNlbmQsIG9iaiwgZnVuY0lkLCBmdW5kTmFtZSwgcmVzdWx0LCBtZXNzYWdlSWQpO1xuXHR9O1xuXG5cdGZ1bmN0aW9uIHNlcnZlckFjdGlvbnNDcmVhdGVkKHNlcnZlckFjdGlvbnM6IFNvY2tldFNlcnZlcikge1xuXHRcdHV3c1NvY2tldEV2ZW50cy5vbk1lc3NhZ2UgPSAobWVzc2FnZSwgaXNCaW5hcnkpID0+IHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGxldCBkYXRhOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmICghaXNCaW5hcnkpIHtcblx0XHRcdFx0XHRkYXRhID0gQnVmZmVyLmZyb20obWVzc2FnZSkudG9TdHJpbmcoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodHJhbnNmZXJMaW1pdEV4Y2VlZGVkIHx8ICFpc0Nvbm5lY3RlZClcblx0XHRcdFx0XHRyZXR1cm47XG5cblx0XHRcdFx0Y29uc3QgbWVzc2FnZUxlbmd0aCA9IGdldExlbmd0aChkYXRhIHx8IG1lc3NhZ2UpO1xuXHRcdFx0XHRieXRlc1JlY2VpdmVkICs9IG1lc3NhZ2VMZW5ndGg7XG5cdFx0XHRcdHNlcnZlci50b3RhbFJlY2VpdmVkICs9IGJ5dGVzUmVjZWl2ZWQ7XG5cblx0XHRcdFx0bGV0IHJlYWRlcjogQmluYXJ5UmVhZGVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0XHRcdGlmIChtZXNzYWdlTGVuZ3RoKSB7XG5cdFx0XHRcdFx0aWYgKGlzQmluYXJ5KSB7XG5cdFx0XHRcdFx0XHRyZWFkZXIgPSBjcmVhdGVCaW5hcnlSZWFkZXJGcm9tQnVmZmVyKG1lc3NhZ2UsIDAsIG1lc3NhZ2UuYnl0ZUxlbmd0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblx0XHRcdFx0Y29uc3QgZGlmZiA9IG5vdyAtIGJ5dGVzUmVzZXQ7XG5cdFx0XHRcdGNvbnN0IGJ5dGVzUGVyU2Vjb25kID0gYnl0ZXNSZWNlaXZlZCAqIDEwMDAgLyBNYXRoLm1heCgxMDAwLCBkaWZmKTtcblx0XHRcdFx0Y29uc3QgdHJhbnNmZXJMaW1pdCA9IG9iai5jbGllbnQudHJhbnNmZXJMaW1pdDtcblxuXHRcdFx0XHRpZiAodHJhbnNmZXJMaW1pdCAmJiB0cmFuc2ZlckxpbWl0IDwgYnl0ZXNQZXJTZWNvbmQpIHtcblx0XHRcdFx0XHR0cmFuc2ZlckxpbWl0RXhjZWVkZWQgPSB0cnVlO1xuXHRcdFx0XHRcdG9iai5jbGllbnQuZGlzY29ubmVjdCh0cnVlLCB0cnVlLCAndHJhbnNmZXIgbGltaXQnKTtcblx0XHRcdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlUmVjdkVycm9yKFxuXHRcdFx0XHRcdFx0b2JqLmNsaWVudCwgbmV3IEVycm9yKGBUcmFuc2ZlciBsaW1pdCBleGNlZWRlZCAke2J5dGVzUGVyU2Vjb25kLnRvRml4ZWQoMCl9LyR7dHJhbnNmZXJMaW1pdH0gKCR7ZGlmZn1tcylgKSxcblx0XHRcdFx0XHRcdHJlYWRlciA/IGdldEJpbmFyeVJlYWRlckJ1ZmZlcihyZWFkZXIpIDogZGF0YSEpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChzZXJ2ZXIuZm9yY2VCaW5hcnkgJiYgZGF0YSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0b2JqLmNsaWVudC5kaXNjb25uZWN0KHRydWUsIHRydWUsICdub24tYmluYXJ5IG1lc3NhZ2UnKTtcblx0XHRcdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlUmVjdkVycm9yKG9iai5jbGllbnQsIG5ldyBFcnJvcihgU3RyaW5nIG1lc3NhZ2Ugd2hpbGUgZm9yY2VkIGJpbmFyeWApLFxuXHRcdFx0XHRcdFx0cmVhZGVyID8gZ2V0QmluYXJ5UmVhZGVyQnVmZmVyKHJlYWRlcikgOiBkYXRhISk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0b2JqLmxhc3RNZXNzYWdlVGltZSA9IERhdGUubm93KCk7XG5cdFx0XHRcdG9iai5zdXBwb3J0c0JpbmFyeSA9IG9iai5zdXBwb3J0c0JpbmFyeSB8fCAhIShpc0JpbmFyeSk7XG5cblx0XHRcdFx0aWYgKHJlYWRlciB8fCBkYXRhKSB7XG5cdFx0XHRcdFx0b2JqLmxhc3RNZXNzYWdlSWQrKztcblx0XHRcdFx0XHRjb25zdCBtZXNzYWdlSWQgPSBvYmoubGFzdE1lc3NhZ2VJZDtcblxuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHQvLyBUT0RPOiBvcHRpb25zLm9uUGFja2V0Py4ob2JqLmNsaWVudClcblxuXHRcdFx0XHRcdFx0aWYgKGRhdGEgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0XHRzZXJ2ZXIucGFja2V0SGFuZGxlci5yZWN2U3RyaW5nKGRhdGEsIHNlcnZlckFjdGlvbnMsIHt9LCAoZnVuY0lkLCBmdW5jTmFtZSwgZnVuYywgZnVuY09iaiwgYXJncykgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IHJhdGUgPSBzZXJ2ZXIucmF0ZUxpbWl0c1tmdW5jSWRdO1xuXG5cdFx0XHRcdFx0XHRcdFx0Ly8gVE9ETzogbW92ZSByYXRlIGxpbWl0cyB0byBwYWNrZXQgaGFuZGxlclxuXHRcdFx0XHRcdFx0XHRcdGlmIChjaGVja1JhdGVMaW1pdDIoZnVuY0lkLCBjYWxsc0xpc3QsIHNlcnZlci5yYXRlTGltaXRzKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0aGFuZGxlUmVzdWx0KHNlbmQsIG9iaiwgZnVuY0lkLCBmdW5jTmFtZSwgZnVuYy5hcHBseShmdW5jT2JqLCBhcmdzKSwgbWVzc2FnZUlkKTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2UgaWYgKHJhdGUgJiYgcmF0ZS5wcm9taXNlKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRoYW5kbGVSZXN1bHQoc2VuZCwgb2JqLCBmdW5jSWQsIGZ1bmNOYW1lLCBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ1JhdGUgbGltaXQgZXhjZWVkZWQnKSksIG1lc3NhZ2VJZCk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihgUmF0ZSBsaW1pdCBleGNlZWRlZCAoJHtmdW5jTmFtZX0pYCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHNlcnZlci5wYWNrZXRIYW5kbGVyLnJlY3ZCaW5hcnkoc2VydmVyQWN0aW9ucywgcmVhZGVyISwgY2FsbHNMaXN0LCBtZXNzYWdlSWQsIGhhbmRsZVJlc3VsdDIpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdGVycm9ySGFuZGxlci5oYW5kbGVSZWN2RXJyb3Iob2JqLmNsaWVudCwgZSwgcmVhZGVyID8gZ2V0QmluYXJ5UmVhZGVyQnVmZmVyKHJlYWRlcikgOiBkYXRhISk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGRpZmYgPiAxMDAwKSB7XG5cdFx0XHRcdFx0Ynl0ZXNSZWNlaXZlZCA9IDA7XG5cdFx0XHRcdFx0Ynl0ZXNSZXNldCA9IG5vdztcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3Iob2JqLmNsaWVudCwgZSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHNlcnZlci5wYWNrZXRIYW5kbGVyLmNyZWF0ZVJlbW90ZShvYmouY2xpZW50LCBzZW5kLCBvYmopO1xuXG5cdFx0aWYgKHNlcnZlci5kZWJ1ZykgbG9nKCdjbGllbnQgY29ubmVjdGVkJyk7XG5cblx0XHRzZXJ2ZXIucGFja2V0SGFuZGxlci5zZW5kU3RyaW5nKHNlbmQsICcqdmVyc2lvbicsIE1lc3NhZ2VUeXBlLlZlcnNpb24sIFtzZXJ2ZXIuaGFzaF0pO1xuXHRcdHNlcnZlci5jbGllbnRzLnB1c2gob2JqKTtcblxuXHRcdGlmIChzZXJ2ZXJBY3Rpb25zLmNvbm5lY3RlZCkge1xuXHRcdFx0Y2FsbFdpdGhFcnJvckhhbmRsaW5nKCgpID0+IHNlcnZlckFjdGlvbnMuY29ubmVjdGVkISgpLCAoKSA9PiB7IH0sIGUgPT4ge1xuXHRcdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3Iob2JqLmNsaWVudCwgZSk7XG5cdFx0XHRcdG9iai5jbGllbnQuZGlzY29ubmVjdChmYWxzZSwgZmFsc2UsICdlcnJvciBvbiBjb25uZWN0ZWQoKScpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0bGV0IGNsb3NlZCA9IGZhbHNlO1xuXG5cdHV3c1NvY2tldEV2ZW50cy5vbkNsb3NlID0gKGNvZGUsIHJlYXNvbikgPT4ge1xuXHRcdGlmIChjbG9zZWQpIHJldHVybjtcblxuXHRcdHRyeSB7XG5cdFx0XHRjbG9zZWQgPSB0cnVlO1xuXHRcdFx0aXNDb25uZWN0ZWQgPSBmYWxzZTtcblxuXHRcdFx0Ly8gcmVtb3ZlIGNsaWVudFxuXHRcdFx0Y29uc3QgaW5kZXggPSBzZXJ2ZXIuY2xpZW50cy5pbmRleE9mKG9iaik7XG5cdFx0XHRpZiAoaW5kZXggIT09IC0xKSB7XG5cdFx0XHRcdHNlcnZlci5jbGllbnRzW2luZGV4XSA9IHNlcnZlci5jbGllbnRzW3NlcnZlci5jbGllbnRzLmxlbmd0aCAtIDFdO1xuXHRcdFx0XHRzZXJ2ZXIuY2xpZW50cy5wb3AoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHNlcnZlci5kZWJ1ZykgbG9nKCdjbGllbnQgZGlzY29ubmVjdGVkJyk7XG5cblx0XHRcdGlmIChzZXJ2ZXJBY3Rpb25zPy5kaXNjb25uZWN0ZWQpIHtcblx0XHRcdFx0Y29uc3QgcmVhZGVyID0gY3JlYXRlQmluYXJ5UmVhZGVyRnJvbUJ1ZmZlcihyZWFzb24sIDAsIHJlYXNvbi5ieXRlTGVuZ3RoKTtcblx0XHRcdFx0Y29uc3QgZGVjb2RlZFJlYXNvbiA9IHJlYWRTdHJpbmcocmVhZGVyKSB8fCAnJztcblx0XHRcdFx0Y2FsbFdpdGhFcnJvckhhbmRsaW5nKCgpID0+IHNlcnZlckFjdGlvbnMhLmRpc2Nvbm5lY3RlZCEoY29kZSwgY2xvc2VSZWFzb24gfHwgZGVjb2RlZFJlYXNvbiksICgpID0+IHsgfSxcblx0XHRcdFx0XHRlID0+IGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihvYmouY2xpZW50LCBlKSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChvYmoudG9rZW4pIHtcblx0XHRcdFx0b2JqLnRva2VuLmV4cGlyZSA9IERhdGUubm93KCkgKyBzZXJ2ZXIudG9rZW5MaWZldGltZTtcblxuXHRcdFx0XHRpZiAoc2VydmVyLmNsaWVudHNCeVRva2VuLmdldChvYmoudG9rZW4uaWQpID09PSBvYmopIHtcblx0XHRcdFx0XHRzZXJ2ZXIuY2xpZW50c0J5VG9rZW4uZGVsZXRlKG9iai50b2tlbi5pZCk7XG5cdFx0XHRcdFx0c2VydmVyLmZyZWVUb2tlbnMuc2V0KG9iai50b2tlbi5pZCwgb2JqLnRva2VuKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihvYmouY2xpZW50LCBlKTtcblx0XHR9XG5cdH07XG5cblxuXHRQcm9taXNlLnJlc29sdmUoc2VydmVyLmNyZWF0ZVNlcnZlcihvYmouY2xpZW50KSlcblx0XHQudGhlbihhY3Rpb25zID0+IHtcblx0XHRcdGlmIChpc0Nvbm5lY3RlZCkge1xuXHRcdFx0XHRzZXJ2ZXJBY3Rpb25zID0gYWN0aW9ucztcblx0XHRcdFx0c2VydmVyQWN0aW9uc0NyZWF0ZWQoc2VydmVyQWN0aW9ucyk7XG5cdFx0XHR9XG5cdFx0fSlcblx0XHQuY2F0Y2goZSA9PiB7XG5cdFx0XHRzb2NrZXQudGVybWluYXRlKCk7XG5cdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3Iob2JqLmNsaWVudCwgZSk7XG5cdFx0fSk7XG59XG4iXSwic291cmNlUm9vdCI6Ii9ob21lL2FscGhhL0Rlc2t0b3AvZGV2L3RjLXNvY2tldHMvc3JjIn0=
