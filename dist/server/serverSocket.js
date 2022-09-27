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
            var query = (0, serverUtils_1.getQuery)((0, serverUtils_1.getFullUrl)(req));
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
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
        backpressureLimit: (_h = options.backpressureLimit) !== null && _h !== void 0 ? _h : 1024,
        verifyClient: (_j = options.verifyClient) !== null && _j !== void 0 ? _j : serverUtils_1.returnTrue,
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
            backpressureLimit: server.backpressureLimit,
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
        if (socket.getBufferedAmount() > obj.client.backpressureLimit) {
            obj.client.disconnect(true, false, 'Exceeded buffered amount');
            return;
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
                var decodedReason_1 = Buffer.from(reason).toString();
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvc2VydmVyU29ja2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBQUEsbURBQXFGO0FBQ3JGLHlDQUF3RTtBQUV4RSx5REFBK0c7QUFJL0csNkNBR3VCO0FBQ3ZCLHVEQUEyRztBQUMzRyxpREFBb0k7QUFDcEksMkJBQTZCO0FBRTdCLFNBQWdCLFlBQVksQ0FDM0IsVUFBMkMsRUFDM0MsVUFBMkMsRUFDM0MsWUFBNEMsRUFDNUMsT0FBdUIsRUFDdkIsWUFBMkIsRUFDM0IsR0FBWTtJQUVaLE9BQU8sZUFBZSxDQUFDLFlBQWtDLEVBQUUsSUFBQSxpQ0FBbUIsRUFBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLE9BQU8sQ0FBQyxFQUFFLFlBQVksRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNySSxDQUFDO0FBVEQsb0NBU0M7QUFFRCxTQUFnQixlQUFlLENBQzlCLFlBQWdDLEVBQUUsT0FBc0IsRUFDeEQsWUFBMkIsRUFBRSxHQUFZO0lBRXpDLElBQU0sSUFBSSxHQUFHLGdCQUFnQixDQUFDO1FBQzdCLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTtRQUNsQixZQUFZLGNBQUE7UUFDWixHQUFHLEtBQUE7UUFDSCxJQUFJLEVBQUcsT0FBc0IsQ0FBQyxJQUFJO1FBQ2xDLEdBQUcsRUFBRyxPQUEyQixDQUFDLEdBQUc7UUFDckMsaUJBQWlCLEVBQUUsT0FBTyxDQUFDLGlCQUFpQjtRQUM1QyxXQUFXLEVBQUUsT0FBTyxDQUFDLFdBQVc7S0FDaEMsQ0FBQyxDQUFDO0lBQ0gsSUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLGFBQUksRUFBRSxFQUFFLFFBQVEsSUFBSyxPQUFPLEVBQUcsQ0FBQztJQUMxRSxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDMUIsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBaEJELDBDQWdCQztBQUVELFNBQWdCLGdCQUFnQixDQUFD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QUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2lCQUMvQzthQUNEO1NBQ0Q7UUFBQyxPQUFPLENBQUMsRUFBRTtZQUNYLFlBQVksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztTQUN4QztJQUNGLENBQUMsQ0FBQztJQUdGLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7U0FDOUMsSUFBSSxDQUFDLFVBQUEsT0FBTztRQUNaLElBQUksV0FBVyxFQUFFO1lBQ2hCLGFBQWEsR0FBRyxPQUFPLENBQUM7WUFDeEIsb0JBQW9CLENBQUMsYUFBYSxDQUFDLENBQUM7U0FDcEM7SUFDRixDQUFDLENBQUM7U0FDRCxLQUFLLENBQUMsVUFBQSxDQUFDO1FBQ1AsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQ25CLFlBQVksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN6QyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMiLCJmaWxlIjoic2VydmVyL3NlcnZlclNvY2tldC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENsaWVudE9wdGlvbnMsIGdldE5hbWVzLCBTb2NrZXRTZXJ2ZXIsIExvZ2dlciB9IGZyb20gJy4uL2NvbW1vbi9pbnRlcmZhY2VzJztcbmltcG9ydCB7IGdldExlbmd0aCwgY2xvbmVEZWVwLCBjaGVja1JhdGVMaW1pdDIgfSBmcm9tICcuLi9jb21tb24vdXRpbHMnO1xuaW1wb3J0IHsgRXJyb3JIYW5kbGVyLCBPcmlnaW5hbFJlcXVlc3QgfSBmcm9tICcuL3NlcnZlcic7XG5pbXBvcnQgeyBNZXNzYWdlVHlwZSwgU2VuZCwgY3JlYXRlUGFja2V0SGFuZGxlciwgSGFuZGxlUmVzdWx0LCBIYW5kbGVyT3B0aW9ucyB9IGZyb20gJy4uL3BhY2tldC9wYWNrZXRIYW5kbGVyJztcbmltcG9ydCB7XG5cdFNlcnZlciwgQ2xpZW50U3RhdGUsIEludGVybmFsU2VydmVyLCBHbG9iYWxDb25maWcsIFNlcnZlckhvc3QsIENyZWF0ZVNlcnZlck1ldGhvZCwgQ3JlYXRlU2VydmVyLCBTZXJ2ZXJPcHRpb25zLCBVV1NTb2NrZXRFdmVudHMsIFNlcnZlckFwcE9wdGlvbiwgUG9ydE9wdGlvblxufSBmcm9tICcuL3NlcnZlckludGVyZmFjZXMnO1xuaW1wb3J0IHtcblx0aGFzVG9rZW4sIGNyZWF0ZVRva2VuLCBnZXRUb2tlbiwgZ2V0VG9rZW5Gcm9tQ2xpZW50LCByZXR1cm5UcnVlLCBjcmVhdGVPcmlnaW5hbFJlcXVlc3QsIGRlZmF1bHRFcnJvckhhbmRsZXIsXG5cdGNyZWF0ZVNlcnZlck9wdGlvbnMsIG9wdGlvbnNXaXRoRGVmYXVsdHMsIHRvQ2xpZW50T3B0aW9ucywgZ2V0UXVlcnksIGNhbGxXaXRoRXJyb3JIYW5kbGluZywgcGFyc2VSYXRlTGltaXREZWYsIGdldEZ1bGxVcmwsXG59IGZyb20gJy4vc2VydmVyVXRpbHMnO1xuaW1wb3J0IHsgQmluYXJ5UmVhZGVyLCBjcmVhdGVCaW5hcnlSZWFkZXJGcm9tQnVmZmVyLCBnZXRCaW5hcnlSZWFkZXJCdWZmZXIgfSBmcm9tICcuLi9wYWNrZXQvYmluYXJ5UmVhZGVyJztcbmltcG9ydCB7IEFwcCwgRElTQUJMRUQsIEh0dHBSZXF1ZXN0LCBTSEFSRURfQ09NUFJFU1NPUiwgdXNfbGlzdGVuX3NvY2tldCwgdXNfbGlzdGVuX3NvY2tldF9jbG9zZSwgV2ViU29ja2V0IH0gZnJvbSAndVdlYlNvY2tldHMuanMnO1xuaW1wb3J0ICogYXMgSFRUUCBmcm9tICdodHRwJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNlcnZlcjxUU2VydmVyLCBUQ2xpZW50Pihcblx0c2VydmVyVHlwZTogbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gVFNlcnZlcixcblx0Y2xpZW50VHlwZTogbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gVENsaWVudCxcblx0Y3JlYXRlU2VydmVyOiBDcmVhdGVTZXJ2ZXI8VFNlcnZlciwgVENsaWVudD4sXG5cdG9wdGlvbnM/OiBTZXJ2ZXJPcHRpb25zLFxuXHRlcnJvckhhbmRsZXI/OiBFcnJvckhhbmRsZXIsXG5cdGxvZz86IExvZ2dlclxuKSB7XG5cdHJldHVybiBjcmVhdGVTZXJ2ZXJSYXcoY3JlYXRlU2VydmVyIGFzIENyZWF0ZVNlcnZlck1ldGhvZCwgY3JlYXRlU2VydmVyT3B0aW9ucyhzZXJ2ZXJUeXBlLCBjbGllbnRUeXBlLCBvcHRpb25zKSwgZXJyb3JIYW5kbGVyLCBsb2cpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2VydmVyUmF3KFxuXHRjcmVhdGVTZXJ2ZXI6IENyZWF0ZVNlcnZlck1ldGhvZCwgb3B0aW9uczogU2VydmVyT3B0aW9ucyxcblx0ZXJyb3JIYW5kbGVyPzogRXJyb3JIYW5kbGVyLCBsb2c/OiBMb2dnZXJcbik6IFNlcnZlciB7XG5cdGNvbnN0IGhvc3QgPSBjcmVhdGVTZXJ2ZXJIb3N0KHtcblx0XHRwYXRoOiBvcHRpb25zLnBhdGgsXG5cdFx0ZXJyb3JIYW5kbGVyLFxuXHRcdGxvZyxcblx0XHRwb3J0OiAob3B0aW9ucyBhcyBQb3J0T3B0aW9uKS5wb3J0LFxuXHRcdGFwcDogKG9wdGlvbnMgYXMgU2VydmVyQXBwT3B0aW9uKS5hcHAsXG5cdFx0cGVyTWVzc2FnZURlZmxhdGU6IG9wdGlvbnMucGVyTWVzc2FnZURlZmxhdGUsXG5cdFx0Y29tcHJlc3Npb246IG9wdGlvbnMuY29tcHJlc3Npb24sXG5cdH0pO1xuXHRjb25zdCBzb2NrZXQgPSBob3N0LnNvY2tldFJhdyhjcmVhdGVTZXJ2ZXIsIHsgaWQ6ICdzb2NrZXQnLCAuLi5vcHRpb25zIH0pO1xuXHRzb2NrZXQuY2xvc2UgPSBob3N0LmNsb3NlO1xuXHRyZXR1cm4gc29ja2V0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2VydmVySG9zdChnbG9iYWxDb25maWc6IEdsb2JhbENvbmZpZyk6IFNlcnZlckhvc3Qge1xuXHRpZighKGdsb2JhbENvbmZpZyBhcyBTZXJ2ZXJBcHBPcHRpb24pLmFwcCAmJiAhKGdsb2JhbENvbmZpZyBhcyBQb3J0T3B0aW9uKS5wb3J0KSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdQb3J0IG9yIHVXZWJTb2NrZXRzLmpzIGFwcCBub3QgcHJvdmlkZWQnKTtcblx0fVxuXHRpZigoZ2xvYmFsQ29uZmlnIGFzIFNlcnZlckFwcE9wdGlvbikuYXBwICYmIChnbG9iYWxDb25maWcgYXMgUG9ydE9wdGlvbikucG9ydCkge1xuXHRcdHRocm93IG5ldyBFcnJvcignUHJvdmlkZSBwb3J0IG9yIHVXZWJTb2NrZXRzLmpzIGFwcCBidXQgbm90IGJvdGgnKTtcblx0fVxuXHRjb25zdCB1d3NBcHAgPSAoZ2xvYmFsQ29uZmlnIGFzIFNlcnZlckFwcE9wdGlvbikuYXBwIHx8IEFwcCgpO1xuXHRjb25zdCB7XG5cdFx0cGF0aCA9ICcvd3MnLFxuXHRcdGxvZyA9IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSksXG5cdFx0ZXJyb3JIYW5kbGVyID0gZGVmYXVsdEVycm9ySGFuZGxlcixcblx0XHRwZXJNZXNzYWdlRGVmbGF0ZSA9IHRydWUsXG5cdFx0ZXJyb3JDb2RlID0gNDAwLFxuXHRcdGVycm9yTmFtZSA9IEhUVFAuU1RBVFVTX0NPREVTWzQwMF0gYXMgc3RyaW5nLFxuXHRcdG5hdGl2ZVBpbmcgPSAwLFxuXHR9ID0gZ2xvYmFsQ29uZmlnO1xuXHRjb25zdCBzZXJ2ZXJzOiBJbnRlcm5hbFNlcnZlcltdID0gW107XG5cblx0bGV0IHVwZ3JhZGVSZXE6IE9yaWdpbmFsUmVxdWVzdCB8IHVuZGVmaW5lZDtcblx0bGV0IGNvbm5lY3RlZFNvY2tldHMgPSBuZXcgTWFwPFdlYlNvY2tldCwgVVdTU29ja2V0RXZlbnRzPigpO1xuXHR1d3NBcHAud3MocGF0aCwge1xuXHRcdGNvbXByZXNzaW9uOiBnbG9iYWxDb25maWcuY29tcHJlc3Npb24gPyBnbG9iYWxDb25maWcuY29tcHJlc3Npb24gOiAocGVyTWVzc2FnZURlZmxhdGUgPyBTSEFSRURfQ09NUFJFU1NPUiA6IERJU0FCTEVEKSxcblx0XHRzZW5kUGluZ3NBdXRvbWF0aWNhbGx5OiAhIW5hdGl2ZVBpbmcsXG5cdFx0aWRsZVRpbWVvdXQ6IG5hdGl2ZVBpbmcgPyBuYXRpdmVQaW5nIDogdW5kZWZpbmVkLFxuXG5cdFx0dXBncmFkZTogKHJlcywgcmVxLCBjb250ZXh0KSA9PiB7XG5cdFx0XHRpZiAodXBncmFkZVJlcSkge1xuXHRcdFx0XHRyZXMuZW5kKGBIVFRQLzEuMSAkezUwM30gJHtIVFRQLlNUQVRVU19DT0RFU1s1MDNdfVxcclxcblxcclxcbmApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRsZXQgYWJvcnRlZCA9IGZhbHNlO1xuXHRcdFx0cmVzLm9uQWJvcnRlZCgoKSA9PiB7XG5cdFx0XHRcdGFib3J0ZWQgPSB0cnVlO1xuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCB1cmwgPSByZXEuZ2V0VXJsKCk7XG5cdFx0XHRjb25zdCBzZWNXZWJTb2NrZXRLZXkgPSByZXEuZ2V0SGVhZGVyKCdzZWMtd2Vic29ja2V0LWtleScpO1xuXHRcdFx0Y29uc3Qgc2VjV2ViU29ja2V0UHJvdG9jb2wgPSByZXEuZ2V0SGVhZGVyKCdzZWMtd2Vic29ja2V0LXByb3RvY29sJyk7XG5cdFx0XHRjb25zdCBzZWNXZWJTb2NrZXRFeHRlbnNpb25zID0gcmVxLmdldEhlYWRlcignc2VjLXdlYnNvY2tldC1leHRlbnNpb25zJyk7XG5cblx0XHRcdGlmIChnbG9iYWxDb25maWcucGF0aCAmJiBnbG9iYWxDb25maWcucGF0aCAhPT0gdXJsLnNwbGl0KCc/JylbMF0uc3BsaXQoJyMnKVswXSkge1xuXHRcdFx0XHRyZXMuZW5kKGBIVFRQLzEuMSAkezQwMH0gJHtIVFRQLlNUQVRVU19DT0RFU1s0MDBdfVxcclxcblxcclxcbmApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG9yaWdpbmFsUmVxdWVzdCA9IGNyZWF0ZU9yaWdpbmFsUmVxdWVzdChyZXEpO1xuXHRcdFx0dmVyaWZ5Q2xpZW50KHJlcSwgKHJlc3VsdCwgY29kZSwgbmFtZSkgPT4ge1xuXHRcdFx0XHRpZiAoYWJvcnRlZCkgcmV0dXJuO1xuXHRcdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdFx0dXBncmFkZVJlcSA9IG9yaWdpbmFsUmVxdWVzdDtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0cmVzLnVwZ3JhZGUoe3VybH0sXG5cdFx0XHRcdFx0XHRcdHNlY1dlYlNvY2tldEtleSxcblx0XHRcdFx0XHRcdFx0c2VjV2ViU29ja2V0UHJvdG9jb2wsXG5cdFx0XHRcdFx0XHRcdHNlY1dlYlNvY2tldEV4dGVuc2lvbnMsXG5cdFx0XHRcdFx0XHRcdGNvbnRleHQpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmVycm9yKGVycm9yKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVzLmVuZChgSFRUUC8xLjEgJHtjb2RlfSAke25hbWV9XFxyXFxuXFxyXFxuYCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0sXG5cdFx0b3BlbjogKHdzKSA9PiB7XG5cdFx0XHRpZiAoIXVwZ3JhZGVSZXEpIHtcblx0XHRcdFx0d3MuY2xvc2UoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgdXdzU29ja2V0RXZlbnRzOiBVV1NTb2NrZXRFdmVudHMgPSB7XG5cdFx0XHRcdHNvY2tldDogd3MsXG5cdFx0XHRcdG9uQ2xvc2U6ICgpID0+IHt9LFxuXHRcdFx0XHRvbk1lc3NhZ2U6ICgpID0+IHt9LFxuXHRcdFx0XHRpc0Nsb3NlZDogZmFsc2UsXG5cdFx0XHR9O1xuXHRcdFx0Y29ubmVjdFNvY2tldCh1cGdyYWRlUmVxLCB1d3NTb2NrZXRFdmVudHMpO1xuXG5cdFx0XHRjb25uZWN0ZWRTb2NrZXRzLnNldCh3cywgdXdzU29ja2V0RXZlbnRzKTtcblx0XHRcdHVwZ3JhZGVSZXEgPSB1bmRlZmluZWQ7XG5cdFx0fSxcblx0XHRtZXNzYWdlKHdzLCBtZXNzYWdlLCBpc0JpbmFyeSkge1xuXHRcdFx0Y29ubmVjdGVkU29ja2V0cy5nZXQod3MpIS5vbk1lc3NhZ2UobWVzc2FnZSwgaXNCaW5hcnkpO1xuXHRcdH0sXG5cdFx0Y2xvc2Uod3MsIGNvZGUsIG1lc3NhZ2UpIHtcblx0XHRcdGNvbnN0IGV2ZW50cyA9IGNvbm5lY3RlZFNvY2tldHMuZ2V0KHdzKSE7XG5cdFx0XHRpZiAoZXZlbnRzKSB7XG5cdFx0XHRcdGV2ZW50cy5pc0Nsb3NlZCA9IHRydWU7Ly9cblx0XHRcdFx0ZXZlbnRzLm9uQ2xvc2UoY29kZSwgbWVzc2FnZSk7XG5cdFx0XHRcdGNvbm5lY3RlZFNvY2tldHMuZGVsZXRlKHdzKTtcblx0XHRcdH1cblx0XHR9LFxuXHR9KTtcblxuXHRsZXQgc29ja2V0VG9rZW46IHVzX2xpc3Rlbl9zb2NrZXQgfCB1bmRlZmluZWQ7XG5cdGlmICgoZ2xvYmFsQ29uZmlnIGFzIFBvcnRPcHRpb24pLnBvcnQpIHtcblx0XHRjb25zdCBwb3J0ID0gKGdsb2JhbENvbmZpZyBhcyBQb3J0T3B0aW9uKS5wb3J0O1xuXHRcdHV3c0FwcC5saXN0ZW4ocG9ydCwgdG9rZW4gPT4ge1xuXHRcdFx0aWYgKHRva2VuKSB7XG5cdFx0XHRcdHNvY2tldFRva2VuID0gdG9rZW47XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3IobnVsbCwgbmV3IEVycm9yKGBGYWlsZWQgdG8gbGlzdGVuIHRvIHBvcnQgJHtwb3J0fWApKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldFNlcnZlcihpZDogYW55KSB7XG5cdFx0aWYgKHNlcnZlcnMubGVuZ3RoID09PSAxKSByZXR1cm4gc2VydmVyc1swXTtcblxuXHRcdGZvciAoY29uc3Qgc2VydmVyIG9mIHNlcnZlcnMpIHtcblx0XHRcdGlmIChzZXJ2ZXIuaWQgPT09IGlkKSByZXR1cm4gc2VydmVyO1xuXHRcdH1cblxuXHRcdHRocm93IG5ldyBFcnJvcihgTm8gc2VydmVyIGZvciBnaXZlbiBpZCAoJHtpZH0pYCk7XG5cdH1cblxuXHRmdW5jdGlvbiB2ZXJpZnlDbGllbnQocmVxOiBIdHRwUmVxdWVzdCwgbmV4dDogKHJlc3VsdDogYW55LCBjb2RlOiBudW1iZXIsIG5hbWU6IHN0cmluZykgPT4gdm9pZCkge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBxdWVyeSA9IGdldFF1ZXJ5KGdldEZ1bGxVcmwocmVxKSk7XG5cdFx0XHRjb25zdCBzZXJ2ZXIgPSBnZXRTZXJ2ZXIocXVlcnkuaWQpO1xuXG5cdFx0XHRpZiAoIXNlcnZlci52ZXJpZnlDbGllbnQocmVxKSkge1xuXHRcdFx0XHRuZXh0KGZhbHNlLCBlcnJvckNvZGUsIGVycm9yTmFtZSk7XG5cdFx0XHR9IGVsc2UgaWYgKHNlcnZlci5jbGllbnRMaW1pdCAhPT0gMCAmJiBzZXJ2ZXIuY2xpZW50TGltaXQgPD0gc2VydmVyLmNsaWVudHMubGVuZ3RoKSB7XG5cdFx0XHRcdG5leHQoZmFsc2UsIGVycm9yQ29kZSwgZXJyb3JOYW1lKTtcblx0XHRcdH0gZWxzZSBpZiAoc2VydmVyLmNvbm5lY3Rpb25Ub2tlbnMpIHtcblx0XHRcdFx0aWYgKGhhc1Rva2VuKHNlcnZlciwgcXVlcnkudCkpIHtcblx0XHRcdFx0XHRuZXh0KHRydWUsIDIwMCwgJ09LJyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bmV4dChmYWxzZSwgZXJyb3JDb2RlLCBlcnJvck5hbWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuZXh0KHRydWUsIDIwMCwgJ09LJyk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0ZXJyb3JIYW5kbGVyLmhhbmRsZUVycm9yKG51bGwsIGUpO1xuXHRcdFx0bmV4dChmYWxzZSwgZXJyb3JDb2RlLCBlcnJvck5hbWUpO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGNsb3NlKCkge1xuXHRcdHNlcnZlcnMuZm9yRWFjaChjbG9zZVNlcnZlcik7XG5cdFx0Y29ubmVjdGVkU29ja2V0cy5mb3JFYWNoKChfLCBzb2NrZXQpID0+IHNvY2tldC5lbmQoKSk7XG5cdFx0aWYgKHNvY2tldFRva2VuKSB7XG5cdFx0XHR1c19saXN0ZW5fc29ja2V0X2Nsb3NlKHNvY2tldFRva2VuKTtcblx0XHRcdHNvY2tldFRva2VuID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGNsb3NlQW5kUmVtb3ZlU2VydmVyKHNlcnZlcjogSW50ZXJuYWxTZXJ2ZXIpIHtcblx0XHRjbG9zZVNlcnZlcihzZXJ2ZXIpO1xuXHRcdGNvbnN0IGluZGV4ID0gc2VydmVycy5pbmRleE9mKHNlcnZlcik7XG5cdFx0aWYgKGluZGV4ICE9PSAtMSkgc2VydmVycy5zcGxpY2UoaW5kZXgsIDEpO1xuXHR9XG5cblx0ZnVuY3Rpb24gc29ja2V0PFRTZXJ2ZXIsIFRDbGllbnQ+KFxuXHRcdHNlcnZlclR5cGU6IG5ldyAoLi4uYXJnczogYW55W10pID0+IFRTZXJ2ZXIsXG5cdFx0Y2xpZW50VHlwZTogbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gVENsaWVudCxcblx0XHRjcmVhdGVTZXJ2ZXI6IENyZWF0ZVNlcnZlcjxUU2VydmVyLCBUQ2xpZW50Pixcblx0XHRiYXNlT3B0aW9ucz86IFNlcnZlck9wdGlvbnNcblx0KTogU2VydmVyIHtcblx0XHRjb25zdCBvcHRpb25zID0gY3JlYXRlU2VydmVyT3B0aW9ucyhzZXJ2ZXJUeXBlLCBjbGllbnRUeXBlLCBiYXNlT3B0aW9ucyk7XG5cdFx0cmV0dXJuIHNvY2tldFJhdyhjcmVhdGVTZXJ2ZXIgYXMgQ3JlYXRlU2VydmVyTWV0aG9kLCBvcHRpb25zKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHNvY2tldFJhdyhjcmVhdGVTZXJ2ZXI6IENyZWF0ZVNlcnZlck1ldGhvZCwgb3B0aW9uczogU2VydmVyT3B0aW9ucyk6IFNlcnZlciB7XG5cdFx0Y29uc3QgaW50ZXJuYWxTZXJ2ZXIgPSBjcmVhdGVJbnRlcm5hbFNlcnZlcihjcmVhdGVTZXJ2ZXIsIHsgLi4ub3B0aW9ucywgcGF0aCB9LCBlcnJvckhhbmRsZXIsIGxvZyk7XG5cblx0XHRpZiAoc2VydmVycy5zb21lKHMgPT4gcy5pZCA9PT0gaW50ZXJuYWxTZXJ2ZXIuaWQpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBvcGVuIHR3byBzb2NrZXRzIHdpdGggdGhlIHNhbWUgaWQnKTtcblx0XHR9XG5cblx0XHRzZXJ2ZXJzLnB1c2goaW50ZXJuYWxTZXJ2ZXIpO1xuXHRcdGludGVybmFsU2VydmVyLnNlcnZlci5jbG9zZSA9ICgpID0+IGNsb3NlQW5kUmVtb3ZlU2VydmVyKGludGVybmFsU2VydmVyKTtcblx0XHRyZXR1cm4gaW50ZXJuYWxTZXJ2ZXIuc2VydmVyO1xuXHR9XG5cblx0ZnVuY3Rpb24gY29ubmVjdFNvY2tldChvcmlnaW5hbFJlcXVlc3Q6IE9yaWdpbmFsUmVxdWVzdCwgc29ja2V0RXZlbnRzOiBVV1NTb2NrZXRFdmVudHMpIHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcXVlcnkgPSBnZXRRdWVyeShvcmlnaW5hbFJlcXVlc3QudXJsKTtcblx0XHRcdGNvbnN0IHNlcnZlciA9IGdldFNlcnZlcihxdWVyeS5pZCk7XG5cblx0XHRcdGNvbm5lY3RDbGllbnQoc2VydmVyLCBvcmlnaW5hbFJlcXVlc3QsIGVycm9ySGFuZGxlciwgbG9nLCBzb2NrZXRFdmVudHMpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGlmICghc29ja2V0RXZlbnRzLmlzQ2xvc2VkKSB7XG5cdFx0XHRcdHNvY2tldEV2ZW50cy5zb2NrZXQuZW5kKCk7XG5cdFx0XHR9XG5cdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3IobnVsbCwgZSk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHsgY2xvc2UsIHNvY2tldCwgc29ja2V0UmF3LCBhcHA6IHV3c0FwcCB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVJbnRlcm5hbFNlcnZlcihcblx0Y3JlYXRlU2VydmVyOiBDcmVhdGVTZXJ2ZXJNZXRob2QsIG9wdGlvbnM6IFNlcnZlck9wdGlvbnMsIGVycm9ySGFuZGxlcjogRXJyb3JIYW5kbGVyLCBsb2c6IExvZ2dlcixcbik6IEludGVybmFsU2VydmVyIHtcblx0b3B0aW9ucyA9IG9wdGlvbnNXaXRoRGVmYXVsdHMob3B0aW9ucyk7XG5cblx0Y29uc3Qgb25TZW5kID0gb3B0aW9ucy5vblNlbmQ7XG5cdGNvbnN0IGhhbmRsZXJPcHRpb25zOiBIYW5kbGVyT3B0aW9ucyA9IHtcblx0XHRkZWJ1Zzogb3B0aW9ucy5kZWJ1Zyxcblx0XHRkZXZlbG9wbWVudDogb3B0aW9ucy5kZXZlbG9wbWVudCxcblx0XHRmb3JjZUJpbmFyeTogb3B0aW9ucy5mb3JjZUJpbmFyeSxcblx0XHRmb3JjZUJpbmFyeVBhY2tldHM6IG9wdGlvbnMuZm9yY2VCaW5hcnlQYWNrZXRzLFxuXHRcdG9uU2VuZCxcblx0XHRvblJlY3Y6IG9wdGlvbnMub25SZWN2LFxuXHRcdHVzZUJ1ZmZlcjogdHJ1ZSxcblx0fTtcblxuXHRjb25zdCBwYWNrZXRIYW5kbGVyID0gY3JlYXRlUGFja2V0SGFuZGxlcihvcHRpb25zLnNlcnZlciwgb3B0aW9ucy5jbGllbnQsIGhhbmRsZXJPcHRpb25zLCBsb2cpO1xuXHRjb25zdCBjbGllbnRPcHRpb25zID0gdG9DbGllbnRPcHRpb25zKG9wdGlvbnMpO1xuXHRjb25zdCBjbGllbnRNZXRob2RzID0gZ2V0TmFtZXMob3B0aW9ucy5jbGllbnQhKTtcblx0Y29uc3Qgc2VydmVyOiBJbnRlcm5hbFNlcnZlciA9IHtcblx0XHRpZDogb3B0aW9ucy5pZCA/PyAnc29ja2V0Jyxcblx0XHRjbGllbnRzOiBbXSxcblx0XHRmcmVlVG9rZW5zOiBuZXcgTWFwKCksXG5cdFx0Y2xpZW50c0J5VG9rZW46IG5ldyBNYXAoKSxcblx0XHR0b3RhbFNlbnQ6IDAsXG5cdFx0dG90YWxSZWNlaXZlZDogMCxcblx0XHRjdXJyZW50Q2xpZW50SWQ6IG9wdGlvbnMuY2xpZW50QmFzZUlkID8/IDEsXG5cdFx0cGF0aDogb3B0aW9ucy5wYXRoID8/ICcnLFxuXHRcdGhhc2g6IG9wdGlvbnMuaGFzaCA/PyAnJyxcblx0XHRkZWJ1ZzogISFvcHRpb25zLmRlYnVnLFxuXHRcdGZvcmNlQmluYXJ5OiAhIW9wdGlvbnMuZm9yY2VCaW5hcnksXG5cdFx0Y29ubmVjdGlvblRva2VuczogISFvcHRpb25zLmNvbm5lY3Rpb25Ub2tlbnMsXG5cdFx0a2VlcE9yaWdpbmFsUmVxdWVzdDogISFvcHRpb25zLmtlZXBPcmlnaW5hbFJlcXVlc3QsXG5cdFx0ZXJyb3JJZk5vdENvbm5lY3RlZDogISFvcHRpb25zLmVycm9ySWZOb3RDb25uZWN0ZWQsXG5cdFx0dG9rZW5MaWZldGltZTogb3B0aW9ucy50b2tlbkxpZmV0aW1lID8/IDAsXG5cdFx0Y2xpZW50TGltaXQ6IG9wdGlvbnMuY2xpZW50TGltaXQgPz8gMCxcblx0XHR0cmFuc2ZlckxpbWl0OiBvcHRpb25zLnRyYW5zZmVyTGltaXQgPz8gMCxcblx0XHRiYWNrcHJlc3N1cmVMaW1pdDogb3B0aW9ucy5iYWNrcHJlc3N1cmVMaW1pdCA/PyAxMDI0LFxuXHRcdHZlcmlmeUNsaWVudDogb3B0aW9ucy52ZXJpZnlDbGllbnQgPz8gcmV0dXJuVHJ1ZSxcblx0XHRjcmVhdGVDbGllbnQ6IG9wdGlvbnMuY3JlYXRlQ2xpZW50LFxuXHRcdHNlcnZlck1ldGhvZHM6IG9wdGlvbnMuc2VydmVyISxcblx0XHRjbGllbnRNZXRob2RzLFxuXHRcdHJhdGVMaW1pdHM6IG9wdGlvbnMuc2VydmVyIS5tYXAocGFyc2VSYXRlTGltaXREZWYpLFxuXHRcdGhhbmRsZVJlc3VsdCxcblx0XHRjcmVhdGVTZXJ2ZXIsXG5cdFx0cGFja2V0SGFuZGxlcixcblx0XHRzZXJ2ZXI6IHt9IGFzIGFueSxcblx0XHRwaW5nSW50ZXJ2YWw6IHVuZGVmaW5lZCxcblx0XHR0b2tlbkludGVydmFsOiB1bmRlZmluZWQsXG5cdH07XG5cblx0ZnVuY3Rpb24gaGFuZGxlUmVzdWx0KHNlbmQ6IFNlbmQsIG9iajogQ2xpZW50U3RhdGUsIGZ1bmNJZDogbnVtYmVyLCBmdW5jTmFtZTogc3RyaW5nLCByZXN1bHQ6IFByb21pc2U8YW55PiwgbWVzc2FnZUlkOiBudW1iZXIpIHtcblx0XHRpZiAocmVzdWx0ICYmIHR5cGVvZiByZXN1bHQudGhlbiA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0cmVzdWx0LnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdFx0aWYgKG9iai5jbGllbnQuaXNDb25uZWN0ZWQoKSkge1xuXHRcdFx0XHRcdHBhY2tldEhhbmRsZXIuc2VuZFN0cmluZyhzZW5kLCBgKnJlc29sdmU6JHtmdW5jTmFtZX1gLCBNZXNzYWdlVHlwZS5SZXNvbHZlZCwgW2Z1bmNJZCwgbWVzc2FnZUlkLCByZXN1bHRdKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgKGU6IEVycm9yKSA9PiB7XG5cdFx0XHRcdGUgPSBlcnJvckhhbmRsZXIuaGFuZGxlUmVqZWN0aW9uKG9iai5jbGllbnQsIGUpIHx8IGU7XG5cdFx0XHRcdGlmIChvYmouY2xpZW50LmlzQ29ubmVjdGVkKCkpIHtcblx0XHRcdFx0XHRwYWNrZXRIYW5kbGVyLnNlbmRTdHJpbmcoc2VuZCwgYCpyZWplY3Q6JHtmdW5jTmFtZX1gLCBNZXNzYWdlVHlwZS5SZWplY3RlZCwgW2Z1bmNJZCwgbWVzc2FnZUlkLCBlID8gZS5tZXNzYWdlIDogJ2Vycm9yJ10pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KS5jYXRjaCgoZTogRXJyb3IpID0+IGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihvYmouY2xpZW50LCBlKSk7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgcGluZ0ludGVydmFsID0gb3B0aW9ucy5waW5nSW50ZXJ2YWw7XG5cblx0aWYgKHBpbmdJbnRlcnZhbCkge1xuXHRcdHNlcnZlci5waW5nSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHRjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXHRcdFx0Y29uc3QgdGhyZXNob2xkID0gbm93IC0gcGluZ0ludGVydmFsO1xuXHRcdFx0Y29uc3QgdGltZW91dFRocmVzaG9sZCA9IG5vdyAtIG9wdGlvbnMuY29ubmVjdGlvblRpbWVvdXQhO1xuXG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHNlcnZlci5jbGllbnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGMgPSBzZXJ2ZXIuY2xpZW50c1tpXTtcblxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGlmIChjLmxhc3RNZXNzYWdlVGltZSA8IHRpbWVvdXRUaHJlc2hvbGQpIHtcblx0XHRcdFx0XHRcdGMuY2xpZW50LmRpc2Nvbm5lY3QodHJ1ZSwgZmFsc2UsICd0aW1lb3V0Jyk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChjLmxhc3RTZW5kVGltZSA8IHRocmVzaG9sZCkge1xuXHRcdFx0XHRcdFx0Yy5waW5nKCk7XG5cdFx0XHRcdFx0XHRpZiAob25TZW5kKSBvblNlbmQoLTEsICdQSU5HJywgMCwgZmFsc2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBjYXRjaCB7IH1cblx0XHRcdH1cblx0XHR9LCBwaW5nSW50ZXJ2YWwpO1xuXHR9XG5cblx0aWYgKG9wdGlvbnMuY29ubmVjdGlvblRva2Vucykge1xuXHRcdHNlcnZlci50b2tlbkludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXHRcdFx0Y29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblx0XHRcdGNvbnN0IGlkczogc3RyaW5nW10gPSBbXTtcblxuXHRcdFx0c2VydmVyLmZyZWVUb2tlbnMuZm9yRWFjaCh0b2tlbiA9PiB7XG5cdFx0XHRcdGlmICh0b2tlbi5leHBpcmUgPCBub3cpIHtcblx0XHRcdFx0XHRpZHMucHVzaCh0b2tlbi5pZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGlkIG9mIGlkcykge1xuXHRcdFx0XHRzZXJ2ZXIuZnJlZVRva2Vucy5kZWxldGUoaWQpO1xuXHRcdFx0fVxuXHRcdH0sIDEwMDAwKTtcblx0fVxuXG5cdHNlcnZlci5zZXJ2ZXIgPSB7XG5cdFx0Z2V0IGNsaWVudHMoKSB7XG5cdFx0XHRyZXR1cm4gc2VydmVyLmNsaWVudHM7XG5cdFx0fSxcblx0XHRjbG9zZSgpIHtcblx0XHRcdGNsb3NlU2VydmVyKHNlcnZlcik7XG5cdFx0fSxcblx0XHRvcHRpb25zKCk6IENsaWVudE9wdGlvbnMge1xuXHRcdFx0cmV0dXJuIGNsb25lRGVlcChjbGllbnRPcHRpb25zKTtcblx0XHR9LFxuXHRcdHRva2VuKGRhdGE/OiBhbnkpIHtcblx0XHRcdHJldHVybiBjcmVhdGVUb2tlbihzZXJ2ZXIsIGRhdGEpLmlkO1xuXHRcdH0sXG5cdFx0Y2xlYXJUb2tlbihpZDogc3RyaW5nKSB7XG5cdFx0XHRzZXJ2ZXIuZnJlZVRva2Vucy5kZWxldGUoaWQpO1xuXHRcdFx0c2VydmVyLmNsaWVudHNCeVRva2VuLmdldChpZCk/LmNsaWVudC5kaXNjb25uZWN0KHRydWUsIHRydWUsICdjbGVhciB0b2tlbnMnKTtcblx0XHR9LFxuXHRcdGNsZWFyVG9rZW5zKHRlc3Q6IChpZDogc3RyaW5nLCBkYXRhPzogYW55KSA9PiBib29sZWFuKSB7XG5cdFx0XHRjb25zdCBpZHM6IHN0cmluZ1tdID0gW107XG5cblx0XHRcdHNlcnZlci5mcmVlVG9rZW5zLmZvckVhY2godG9rZW4gPT4ge1xuXHRcdFx0XHRpZiAodGVzdCh0b2tlbi5pZCwgdG9rZW4uZGF0YSkpIHtcblx0XHRcdFx0XHRpZHMucHVzaCh0b2tlbi5pZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRzZXJ2ZXIuY2xpZW50c0J5VG9rZW4uZm9yRWFjaCgoeyB0b2tlbiB9KSA9PiB7XG5cdFx0XHRcdGlmICh0b2tlbiAmJiB0ZXN0KHRva2VuLmlkLCB0b2tlbi5kYXRhKSkge1xuXHRcdFx0XHRcdGlkcy5wdXNoKHRva2VuLmlkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGZvciAoY29uc3QgaWQgb2YgaWRzKSB7XG5cdFx0XHRcdHRoaXMuY2xlYXJUb2tlbihpZCk7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRpbmZvKCkge1xuXHRcdFx0Y29uc3Qgd3JpdGVyQnVmZmVyU2l6ZSA9IHBhY2tldEhhbmRsZXIud3JpdGVyQnVmZmVyU2l6ZSgpO1xuXHRcdFx0Y29uc3QgZnJlZVRva2VucyA9IHNlcnZlci5mcmVlVG9rZW5zLnNpemU7XG5cdFx0XHRjb25zdCBjbGllbnRzQnlUb2tlbiA9IHNlcnZlci5jbGllbnRzQnlUb2tlbi5zaXplO1xuXHRcdFx0cmV0dXJuIHsgd3JpdGVyQnVmZmVyU2l6ZSwgZnJlZVRva2VucywgY2xpZW50c0J5VG9rZW4gfTtcblx0XHR9LFxuXHR9O1xuXG5cdHJldHVybiBzZXJ2ZXI7XG59XG5cbmZ1bmN0aW9uIGNsb3NlU2VydmVyKHNlcnZlcjogSW50ZXJuYWxTZXJ2ZXIpIHtcblx0aWYgKHNlcnZlci5waW5nSW50ZXJ2YWwpIHtcblx0XHRjbGVhckludGVydmFsKHNlcnZlci5waW5nSW50ZXJ2YWwpO1xuXHRcdHNlcnZlci5waW5nSW50ZXJ2YWwgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRpZiAoc2VydmVyLnRva2VuSW50ZXJ2YWwpIHtcblx0XHRjbGVhckludGVydmFsKHNlcnZlci50b2tlbkludGVydmFsKTtcblx0XHRzZXJ2ZXIudG9rZW5JbnRlcnZhbCA9IHVuZGVmaW5lZDtcblx0fVxufVxuXG5mdW5jdGlvbiBjb25uZWN0Q2xpZW50KFxuXHRzZXJ2ZXI6IEludGVybmFsU2VydmVyLCBvcmlnaW5hbFJlcXVlc3Q6IE9yaWdpbmFsUmVxdWVzdCwgZXJyb3JIYW5kbGVyOiBFcnJvckhhbmRsZXIsIGxvZzogTG9nZ2VyLFxuXHR1d3NTb2NrZXRFdmVudHM6IFVXU1NvY2tldEV2ZW50c1xuKSB7XG5cdGNvbnN0IHNvY2tldCA9IHV3c1NvY2tldEV2ZW50cy5zb2NrZXQ7XG5cdGNvbnN0IHF1ZXJ5ID0gZ2V0UXVlcnkob3JpZ2luYWxSZXF1ZXN0LnVybCk7XG5cdGNvbnN0IHQgPSAocXVlcnkudCB8fCAnJykgYXMgc3RyaW5nO1xuXHRjb25zdCB0b2tlbiA9IHNlcnZlci5jb25uZWN0aW9uVG9rZW5zID8gZ2V0VG9rZW4oc2VydmVyLCB0KSB8fCBnZXRUb2tlbkZyb21DbGllbnQoc2VydmVyLCB0KSA6IHVuZGVmaW5lZDtcblxuXHRpZiAoc2VydmVyLmhhc2ggJiYgcXVlcnkuaGFzaCAhPT0gc2VydmVyLmhhc2gpIHtcblx0XHRpZiAoc2VydmVyLmRlYnVnKSBsb2coJ2NsaWVudCBkaXNjb25uZWN0ZWQgKGhhc2ggbWlzbWF0Y2gpJyk7XG5cblx0XHRzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeShbTWVzc2FnZVR5cGUuVmVyc2lvbiwgc2VydmVyLmhhc2hdKSk7XG5cdFx0aWYgKCF1d3NTb2NrZXRFdmVudHMuaXNDbG9zZWQpIHtcblx0XHRcdHNvY2tldC5lbmQoKTtcblx0XHR9XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0aWYgKHNlcnZlci5jb25uZWN0aW9uVG9rZW5zICYmICF0b2tlbikge1xuXHRcdGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcih7IG9yaWdpbmFsUmVxdWVzdCB9IGFzIGFueSwgbmV3IEVycm9yKGBJbnZhbGlkIHRva2VuOiAke3R9YCkpO1xuXHRcdGlmICghdXdzU29ja2V0RXZlbnRzLmlzQ2xvc2VkKSB7XG5cdFx0XHR1d3NTb2NrZXRFdmVudHMuc29ja2V0LmVuZCgpO1xuXHRcdH1cblx0XHRyZXR1cm47XG5cdH1cblxuXHRjb25zdCBjYWxsc0xpc3Q6IG51bWJlcltdID0gW107XG5cdGNvbnN0IHsgaGFuZGxlUmVzdWx0LCBjcmVhdGVDbGllbnQgPSB4ID0+IHggfSA9IHNlcnZlcjtcblxuXHRsZXQgYnl0ZXNSZXNldCA9IERhdGUubm93KCk7XG5cdGxldCBieXRlc1JlY2VpdmVkID0gMDtcblx0bGV0IHRyYW5zZmVyTGltaXRFeGNlZWRlZCA9IGZhbHNlO1xuXHRsZXQgaXNDb25uZWN0ZWQgPSB0cnVlO1xuXHRsZXQgc2VydmVyQWN0aW9uczogU29ja2V0U2VydmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRsZXQgY2xvc2VSZWFzb246IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRjb25zdCBvYmo6IENsaWVudFN0YXRlID0ge1xuXHRcdGxhc3RNZXNzYWdlVGltZTogRGF0ZS5ub3coKSxcblx0XHRsYXN0TWVzc2FnZUlkOiAwLFxuXHRcdGxhc3RTZW5kVGltZTogRGF0ZS5ub3coKSxcblx0XHRzZW50U2l6ZTogMCxcblx0XHRzdXBwb3J0c0JpbmFyeTogISFzZXJ2ZXIuZm9yY2VCaW5hcnkgfHwgISEocXVlcnkgJiYgcXVlcnkuYmluID09PSAndHJ1ZScpLFxuXHRcdHRva2VuLFxuXHRcdHBpbmcoKSB7XG5cdFx0XHRzb2NrZXQuc2VuZCgnJyk7XG5cdFx0fSxcblx0XHRjbGllbnQ6IGNyZWF0ZUNsaWVudCh7XG5cdFx0XHRpZDogc2VydmVyLmN1cnJlbnRDbGllbnRJZCsrLFxuXHRcdFx0dG9rZW5JZDogdG9rZW4gPyB0b2tlbi5pZCA6IHVuZGVmaW5lZCxcblx0XHRcdHRva2VuRGF0YTogdG9rZW4gPyB0b2tlbi5kYXRhIDogdW5kZWZpbmVkLFxuXHRcdFx0b3JpZ2luYWxSZXF1ZXN0OiBzZXJ2ZXIua2VlcE9yaWdpbmFsUmVxdWVzdCA/IG9yaWdpbmFsUmVxdWVzdCA6IHVuZGVmaW5lZCxcblx0XHRcdHRyYW5zZmVyTGltaXQ6IHNlcnZlci50cmFuc2ZlckxpbWl0LFxuXHRcdFx0YmFja3ByZXNzdXJlTGltaXQ6IHNlcnZlci5iYWNrcHJlc3N1cmVMaW1pdCxcblx0XHRcdGlzQ29ubmVjdGVkKCkge1xuXHRcdFx0XHRyZXR1cm4gaXNDb25uZWN0ZWQ7XG5cdFx0XHR9LFxuXHRcdFx0bGFzdE1lc3NhZ2VUaW1lKCkge1xuXHRcdFx0XHRyZXR1cm4gb2JqLmxhc3RNZXNzYWdlVGltZTtcblx0XHRcdH0sXG5cdFx0XHRkaXNjb25uZWN0KGZvcmNlID0gZmFsc2UsIGludmFsaWRhdGVUb2tlbiA9IGZhbHNlLCByZWFzb24gPSAnJykge1xuXHRcdFx0XHRpc0Nvbm5lY3RlZCA9IGZhbHNlO1xuXG5cdFx0XHRcdGlmIChpbnZhbGlkYXRlVG9rZW4gJiYgb2JqLnRva2VuKSB7XG5cdFx0XHRcdFx0aWYgKHNlcnZlci5jbGllbnRzQnlUb2tlbi5nZXQob2JqLnRva2VuLmlkKSA9PT0gb2JqKSB7XG5cdFx0XHRcdFx0XHRzZXJ2ZXIuY2xpZW50c0J5VG9rZW4uZGVsZXRlKG9iai50b2tlbi5pZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG9iai50b2tlbiA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChmb3JjZSkge1xuXHRcdFx0XHRcdGlmICghdXdzU29ja2V0RXZlbnRzKSB7XG5cdFx0XHRcdFx0XHRzb2NrZXQuZW5kKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNsb3NlUmVhc29uID0gcmVhc29uO1xuXHRcdFx0XHRcdHNvY2tldC5jbG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdH0sIHNlbmQpLFxuXHR9O1xuXG5cdGlmIChvYmoudG9rZW4pIHtcblx0XHRzZXJ2ZXIuY2xpZW50c0J5VG9rZW4uc2V0KG9iai50b2tlbi5pZCwgb2JqKTtcblx0fVxuXG5cdC8vIFRPRE86IHJlbW92ZSBVaW50OEFycmF5IGZyb20gaGVyZVxuXHRmdW5jdGlvbiBzZW5kKGRhdGE6IHN0cmluZyB8IFVpbnQ4QXJyYXkgfCBCdWZmZXIpIHtcblx0XHRpZiAoc2VydmVyLmVycm9ySWZOb3RDb25uZWN0ZWQgJiYgIWlzQ29ubmVjdGVkKSB7XG5cdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3Iob2JqLmNsaWVudCwgbmV3IEVycm9yKCdOb3QgQ29ubmVjdGVkJykpO1xuXHRcdH1cblxuXHRcdGlmIChzb2NrZXQuZ2V0QnVmZmVyZWRBbW91bnQoKSA+IG9iai5jbGllbnQuYmFja3ByZXNzdXJlTGltaXQpIHtcblx0XHRcdG9iai5jbGllbnQuZGlzY29ubmVjdCh0cnVlLCBmYWxzZSwgJ0V4Y2VlZGVkIGJ1ZmZlcmVkIGFtb3VudCcpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChkYXRhIGluc3RhbmNlb2YgQnVmZmVyKSB7XG5cdFx0XHRzZXJ2ZXIudG90YWxTZW50ICs9IGRhdGEuYnl0ZUxlbmd0aDtcblx0XHRcdHNvY2tldC5zZW5kKGRhdGEsIHRydWUpO1xuXHRcdH0gZWxzZSBpZiAodHlwZW9mIGRhdGEgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRzZXJ2ZXIudG90YWxTZW50ICs9IGRhdGEuYnl0ZUxlbmd0aDtcblx0XHRcdHNvY2tldC5zZW5kKEJ1ZmZlci5mcm9tKGRhdGEuYnVmZmVyLCBkYXRhLmJ5dGVPZmZzZXQsIGRhdGEuYnl0ZUxlbmd0aCksIHRydWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzZXJ2ZXIudG90YWxTZW50ICs9IGRhdGEubGVuZ3RoO1xuXHRcdFx0c29ja2V0LnNlbmQoZGF0YSwgZmFsc2UpO1xuXHRcdH1cblxuXHRcdG9iai5sYXN0U2VuZFRpbWUgPSBEYXRlLm5vdygpO1xuXHR9XG5cblx0Y29uc3QgaGFuZGxlUmVzdWx0MjogSGFuZGxlUmVzdWx0ID0gKGZ1bmNJZCwgZnVuZE5hbWUsIHJlc3VsdCwgbWVzc2FnZUlkKSA9PiB7XG5cdFx0aGFuZGxlUmVzdWx0KHNlbmQsIG9iaiwgZnVuY0lkLCBmdW5kTmFtZSwgcmVzdWx0LCBtZXNzYWdlSWQpO1xuXHR9O1xuXG5cdGZ1bmN0aW9uIHNlcnZlckFjdGlvbnNDcmVhdGVkKHNlcnZlckFjdGlvbnM6IFNvY2tldFNlcnZlcikge1xuXHRcdHV3c1NvY2tldEV2ZW50cy5vbk1lc3NhZ2UgPSAobWVzc2FnZSwgaXNCaW5hcnkpID0+IHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGxldCBkYXRhOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmICghaXNCaW5hcnkpIHtcblx0XHRcdFx0XHRkYXRhID0gQnVmZmVyLmZyb20obWVzc2FnZSkudG9TdHJpbmcoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodHJhbnNmZXJMaW1pdEV4Y2VlZGVkIHx8ICFpc0Nvbm5lY3RlZClcblx0XHRcdFx0XHRyZXR1cm47XG5cblx0XHRcdFx0Y29uc3QgbWVzc2FnZUxlbmd0aCA9IGdldExlbmd0aChkYXRhIHx8IG1lc3NhZ2UpO1xuXHRcdFx0XHRieXRlc1JlY2VpdmVkICs9IG1lc3NhZ2VMZW5ndGg7XG5cdFx0XHRcdHNlcnZlci50b3RhbFJlY2VpdmVkICs9IGJ5dGVzUmVjZWl2ZWQ7XG5cblx0XHRcdFx0bGV0IHJlYWRlcjogQmluYXJ5UmVhZGVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0XHRcdGlmIChtZXNzYWdlTGVuZ3RoKSB7XG5cdFx0XHRcdFx0aWYgKGlzQmluYXJ5KSB7XG5cdFx0XHRcdFx0XHRyZWFkZXIgPSBjcmVhdGVCaW5hcnlSZWFkZXJGcm9tQnVmZmVyKG1lc3NhZ2UsIDAsIG1lc3NhZ2UuYnl0ZUxlbmd0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblx0XHRcdFx0Y29uc3QgZGlmZiA9IG5vdyAtIGJ5dGVzUmVzZXQ7XG5cdFx0XHRcdGNvbnN0IGJ5dGVzUGVyU2Vjb25kID0gYnl0ZXNSZWNlaXZlZCAqIDEwMDAgLyBNYXRoLm1heCgxMDAwLCBkaWZmKTtcblx0XHRcdFx0Y29uc3QgdHJhbnNmZXJMaW1pdCA9IG9iai5jbGllbnQudHJhbnNmZXJMaW1pdDtcblxuXHRcdFx0XHRpZiAodHJhbnNmZXJMaW1pdCAmJiB0cmFuc2ZlckxpbWl0IDwgYnl0ZXNQZXJTZWNvbmQpIHtcblx0XHRcdFx0XHR0cmFuc2ZlckxpbWl0RXhjZWVkZWQgPSB0cnVlO1xuXHRcdFx0XHRcdG9iai5jbGllbnQuZGlzY29ubmVjdCh0cnVlLCB0cnVlLCAndHJhbnNmZXIgbGltaXQnKTtcblx0XHRcdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlUmVjdkVycm9yKFxuXHRcdFx0XHRcdFx0b2JqLmNsaWVudCwgbmV3IEVycm9yKGBUcmFuc2ZlciBsaW1pdCBleGNlZWRlZCAke2J5dGVzUGVyU2Vjb25kLnRvRml4ZWQoMCl9LyR7dHJhbnNmZXJMaW1pdH0gKCR7ZGlmZn1tcylgKSxcblx0XHRcdFx0XHRcdHJlYWRlciA/IGdldEJpbmFyeVJlYWRlckJ1ZmZlcihyZWFkZXIpIDogZGF0YSEpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChzZXJ2ZXIuZm9yY2VCaW5hcnkgJiYgZGF0YSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0b2JqLmNsaWVudC5kaXNjb25uZWN0KHRydWUsIHRydWUsICdub24tYmluYXJ5IG1lc3NhZ2UnKTtcblx0XHRcdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlUmVjdkVycm9yKG9iai5jbGllbnQsIG5ldyBFcnJvcihgU3RyaW5nIG1lc3NhZ2Ugd2hpbGUgZm9yY2VkIGJpbmFyeWApLFxuXHRcdFx0XHRcdFx0cmVhZGVyID8gZ2V0QmluYXJ5UmVhZGVyQnVmZmVyKHJlYWRlcikgOiBkYXRhISk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0b2JqLmxhc3RNZXNzYWdlVGltZSA9IERhdGUubm93KCk7XG5cdFx0XHRcdG9iai5zdXBwb3J0c0JpbmFyeSA9IG9iai5zdXBwb3J0c0JpbmFyeSB8fCAhIShpc0JpbmFyeSk7XG5cblx0XHRcdFx0aWYgKHJlYWRlciB8fCBkYXRhKSB7XG5cdFx0XHRcdFx0b2JqLmxhc3RNZXNzYWdlSWQrKztcblx0XHRcdFx0XHRjb25zdCBtZXNzYWdlSWQgPSBvYmoubGFzdE1lc3NhZ2VJZDtcblxuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHQvLyBUT0RPOiBvcHRpb25zLm9uUGFja2V0Py4ob2JqLmNsaWVudClcblxuXHRcdFx0XHRcdFx0aWYgKGRhdGEgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0XHRzZXJ2ZXIucGFja2V0SGFuZGxlci5yZWN2U3RyaW5nKGRhdGEsIHNlcnZlckFjdGlvbnMsIHt9LCAoZnVuY0lkLCBmdW5jTmFtZSwgZnVuYywgZnVuY09iaiwgYXJncykgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IHJhdGUgPSBzZXJ2ZXIucmF0ZUxpbWl0c1tmdW5jSWRdO1xuXG5cdFx0XHRcdFx0XHRcdFx0Ly8gVE9ETzogbW92ZSByYXRlIGxpbWl0cyB0byBwYWNrZXQgaGFuZGxlclxuXHRcdFx0XHRcdFx0XHRcdGlmIChjaGVja1JhdGVMaW1pdDIoZnVuY0lkLCBjYWxsc0xpc3QsIHNlcnZlci5yYXRlTGltaXRzKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0aGFuZGxlUmVzdWx0KHNlbmQsIG9iaiwgZnVuY0lkLCBmdW5jTmFtZSwgZnVuYy5hcHBseShmdW5jT2JqLCBhcmdzKSwgbWVzc2FnZUlkKTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2UgaWYgKHJhdGUgJiYgcmF0ZS5wcm9taXNlKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRoYW5kbGVSZXN1bHQoc2VuZCwgb2JqLCBmdW5jSWQsIGZ1bmNOYW1lLCBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ1JhdGUgbGltaXQgZXhjZWVkZWQnKSksIG1lc3NhZ2VJZCk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihgUmF0ZSBsaW1pdCBleGNlZWRlZCAoJHtmdW5jTmFtZX0pYCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHNlcnZlci5wYWNrZXRIYW5kbGVyLnJlY3ZCaW5hcnkoc2VydmVyQWN0aW9ucywgcmVhZGVyISwgY2FsbHNMaXN0LCBtZXNzYWdlSWQsIGhhbmRsZVJlc3VsdDIpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdGVycm9ySGFuZGxlci5oYW5kbGVSZWN2RXJyb3Iob2JqLmNsaWVudCwgZSwgcmVhZGVyID8gZ2V0QmluYXJ5UmVhZGVyQnVmZmVyKHJlYWRlcikgOiBkYXRhISk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGRpZmYgPiAxMDAwKSB7XG5cdFx0XHRcdFx0Ynl0ZXNSZWNlaXZlZCA9IDA7XG5cdFx0XHRcdFx0Ynl0ZXNSZXNldCA9IG5vdztcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3Iob2JqLmNsaWVudCwgZSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHNlcnZlci5wYWNrZXRIYW5kbGVyLmNyZWF0ZVJlbW90ZShvYmouY2xpZW50LCBzZW5kLCBvYmopO1xuXG5cdFx0aWYgKHNlcnZlci5kZWJ1ZykgbG9nKCdjbGllbnQgY29ubmVjdGVkJyk7XG5cblx0XHRzZXJ2ZXIucGFja2V0SGFuZGxlci5zZW5kU3RyaW5nKHNlbmQsICcqdmVyc2lvbicsIE1lc3NhZ2VUeXBlLlZlcnNpb24sIFtzZXJ2ZXIuaGFzaF0pO1xuXHRcdHNlcnZlci5jbGllbnRzLnB1c2gob2JqKTtcblxuXHRcdGlmIChzZXJ2ZXJBY3Rpb25zLmNvbm5lY3RlZCkge1xuXHRcdFx0Y2FsbFdpdGhFcnJvckhhbmRsaW5nKCgpID0+IHNlcnZlckFjdGlvbnMuY29ubmVjdGVkISgpLCAoKSA9PiB7IH0sIGUgPT4ge1xuXHRcdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3Iob2JqLmNsaWVudCwgZSk7XG5cdFx0XHRcdG9iai5jbGllbnQuZGlzY29ubmVjdChmYWxzZSwgZmFsc2UsICdlcnJvciBvbiBjb25uZWN0ZWQoKScpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0bGV0IGNsb3NlZCA9IGZhbHNlO1xuXG5cdHV3c1NvY2tldEV2ZW50cy5vbkNsb3NlID0gKGNvZGUsIHJlYXNvbikgPT4ge1xuXHRcdGlmIChjbG9zZWQpIHJldHVybjtcblxuXHRcdHRyeSB7XG5cdFx0XHRjbG9zZWQgPSB0cnVlO1xuXHRcdFx0aXNDb25uZWN0ZWQgPSBmYWxzZTtcblxuXHRcdFx0Ly8gcmVtb3ZlIGNsaWVudFxuXHRcdFx0Y29uc3QgaW5kZXggPSBzZXJ2ZXIuY2xpZW50cy5pbmRleE9mKG9iaik7XG5cdFx0XHRpZiAoaW5kZXggIT09IC0xKSB7XG5cdFx0XHRcdHNlcnZlci5jbGllbnRzW2luZGV4XSA9IHNlcnZlci5jbGllbnRzW3NlcnZlci5jbGllbnRzLmxlbmd0aCAtIDFdO1xuXHRcdFx0XHRzZXJ2ZXIuY2xpZW50cy5wb3AoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHNlcnZlci5kZWJ1ZykgbG9nKCdjbGllbnQgZGlzY29ubmVjdGVkJyk7XG5cblx0XHRcdGlmIChzZXJ2ZXJBY3Rpb25zPy5kaXNjb25uZWN0ZWQpIHtcblx0XHRcdFx0Y29uc3QgZGVjb2RlZFJlYXNvbiA9IEJ1ZmZlci5mcm9tKHJlYXNvbikudG9TdHJpbmcoKTtcblx0XHRcdFx0Y2FsbFdpdGhFcnJvckhhbmRsaW5nKCgpID0+IHNlcnZlckFjdGlvbnMhLmRpc2Nvbm5lY3RlZCEoY29kZSwgY2xvc2VSZWFzb24gfHwgZGVjb2RlZFJlYXNvbiksICgpID0+IHsgfSxcblx0XHRcdFx0XHRlID0+IGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihvYmouY2xpZW50LCBlKSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChvYmoudG9rZW4pIHtcblx0XHRcdFx0b2JqLnRva2VuLmV4cGlyZSA9IERhdGUubm93KCkgKyBzZXJ2ZXIudG9rZW5MaWZldGltZTtcblxuXHRcdFx0XHRpZiAoc2VydmVyLmNsaWVudHNCeVRva2VuLmdldChvYmoudG9rZW4uaWQpID09PSBvYmopIHtcblx0XHRcdFx0XHRzZXJ2ZXIuY2xpZW50c0J5VG9rZW4uZGVsZXRlKG9iai50b2tlbi5pZCk7XG5cdFx0XHRcdFx0c2VydmVyLmZyZWVUb2tlbnMuc2V0KG9iai50b2tlbi5pZCwgb2JqLnRva2VuKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihvYmouY2xpZW50LCBlKTtcblx0XHR9XG5cdH07XG5cblxuXHRQcm9taXNlLnJlc29sdmUoc2VydmVyLmNyZWF0ZVNlcnZlcihvYmouY2xpZW50KSlcblx0XHQudGhlbihhY3Rpb25zID0+IHtcblx0XHRcdGlmIChpc0Nvbm5lY3RlZCkge1xuXHRcdFx0XHRzZXJ2ZXJBY3Rpb25zID0gYWN0aW9ucztcblx0XHRcdFx0c2VydmVyQWN0aW9uc0NyZWF0ZWQoc2VydmVyQWN0aW9ucyk7XG5cdFx0XHR9XG5cdFx0fSlcblx0XHQuY2F0Y2goZSA9PiB7XG5cdFx0XHRzb2NrZXQudGVybWluYXRlKCk7XG5cdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3Iob2JqLmNsaWVudCwgZSk7XG5cdFx0fSk7XG59XG4iXSwic291cmNlUm9vdCI6Ii9ob21lL2FscGhhL0Rlc2t0b3AvZGV2L3RjLXNvY2tldHMvc3JjIn0=
