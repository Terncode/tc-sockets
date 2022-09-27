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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvc2VydmVyU29ja2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBQUEsbURBQXFGO0FBQ3JGLHlDQUF3RTtBQUV4RSx5REFBK0c7QUFJL0csNkNBR3VCO0FBQ3ZCLHVEQUF1SDtBQUN2SCxpREFBb0k7QUFDcEksMkJBQTZCO0FBRTdCLFNBQWdCLFlBQVksQ0FDM0IsVUFBMkMsRUFDM0MsVUFBMkMsRUFDM0MsWUFBNEMsRUFDNUMsT0FBdUIsRUFDdkIsWUFBMkIsRUFDM0IsR0FBWTtJQUVaLE9BQU8sZUFBZSxDQUFDLFlBQWtDLEVBQUUsSUFBQSxpQ0FBbUIsRUFBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLE9BQU8sQ0FBQyxFQUFFLFlBQVksRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNySSxDQUFDO0FBVEQsb0NBU0M7QUFFRCxTQUFnQixlQUFlLENBQzlCLFlBQWdDLEVBQUUsT0FBc0IsRUFDeEQsWUFBMkIsRUFBRSxHQUFZO0lBRXpDLElBQU0sSUFBSSxHQUFHLGdCQUFnQixDQUFDO1FBQzdCLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTtRQUNsQixZQUFZLGNBQUE7UUFDWixHQUFHLEtBQUE7UUFDSCxJQUFJLEVBQUcsT0FBc0IsQ0FBQyxJQUFJO1FBQ2xDLEdBQUcsRUFBRyxPQUEyQixDQUFDLEdBQUc7UUFDckMsaUJBQWlCLEVBQUUsT0FBTyxDQUFDLGlCQUFpQjtRQUM1QyxXQUFXLEVBQUUsT0FBTyxDQUFDLFdBQVc7S0FDaEMsQ0FBQyxDQUFDO0lBQ0gsSUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLGFBQUksRUFBRSxFQUFFLFFBQVEsSUFBSyxPQUFPLEVBQUcsQ0FBQztJQUMxRSxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDMUIsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBaEJELDBDQWdCQztBQUVELFNBQWdCLGdCQUFnQixDQUFD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QyxDQUFDO0lBR0YsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUM5QyxJQUFJLENBQUMsVUFBQSxPQUFPO1FBQ1osSUFBSSxXQUFXLEVBQUU7WUFDaEIsYUFBYSxHQUFHLE9BQU8sQ0FBQztZQUN4QixvQkFBb0IsQ0FBQyxhQUFhLENBQUMsQ0FBQztTQUNwQztJQUNGLENBQUMsQ0FBQztTQUNELEtBQUssQ0FBQyxVQUFBLENBQUM7UUFDUCxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDbkIsWUFBWSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3pDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyIsImZpbGUiOiJzZXJ2ZXIvc2VydmVyU29ja2V0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ2xpZW50T3B0aW9ucywgZ2V0TmFtZXMsIFNvY2tldFNlcnZlciwgTG9nZ2VyIH0gZnJvbSAnLi4vY29tbW9uL2ludGVyZmFjZXMnO1xuaW1wb3J0IHsgZ2V0TGVuZ3RoLCBjbG9uZURlZXAsIGNoZWNrUmF0ZUxpbWl0MiB9IGZyb20gJy4uL2NvbW1vbi91dGlscyc7XG5pbXBvcnQgeyBFcnJvckhhbmRsZXIsIE9yaWdpbmFsUmVxdWVzdCB9IGZyb20gJy4vc2VydmVyJztcbmltcG9ydCB7IE1lc3NhZ2VUeXBlLCBTZW5kLCBjcmVhdGVQYWNrZXRIYW5kbGVyLCBIYW5kbGVSZXN1bHQsIEhhbmRsZXJPcHRpb25zIH0gZnJvbSAnLi4vcGFja2V0L3BhY2tldEhhbmRsZXInO1xuaW1wb3J0IHtcblx0U2VydmVyLCBDbGllbnRTdGF0ZSwgSW50ZXJuYWxTZXJ2ZXIsIEdsb2JhbENvbmZpZywgU2VydmVySG9zdCwgQ3JlYXRlU2VydmVyTWV0aG9kLCBDcmVhdGVTZXJ2ZXIsIFNlcnZlck9wdGlvbnMsIFVXU1NvY2tldEV2ZW50cywgU2VydmVyQXBwT3B0aW9uLCBQb3J0T3B0aW9uXG59IGZyb20gJy4vc2VydmVySW50ZXJmYWNlcyc7XG5pbXBvcnQge1xuXHRoYXNUb2tlbiwgY3JlYXRlVG9rZW4sIGdldFRva2VuLCBnZXRUb2tlbkZyb21DbGllbnQsIHJldHVyblRydWUsIGNyZWF0ZU9yaWdpbmFsUmVxdWVzdCwgZGVmYXVsdEVycm9ySGFuZGxlcixcblx0Y3JlYXRlU2VydmVyT3B0aW9ucywgb3B0aW9uc1dpdGhEZWZhdWx0cywgdG9DbGllbnRPcHRpb25zLCBnZXRRdWVyeSwgY2FsbFdpdGhFcnJvckhhbmRsaW5nLCBwYXJzZVJhdGVMaW1pdERlZiwgZ2V0RnVsbFVybCxcbn0gZnJvbSAnLi9zZXJ2ZXJVdGlscyc7XG5pbXBvcnQgeyBCaW5hcnlSZWFkZXIsIGNyZWF0ZUJpbmFyeVJlYWRlckZyb21CdWZmZXIsIGdldEJpbmFyeVJlYWRlckJ1ZmZlciwgcmVhZFN0cmluZyB9IGZyb20gJy4uL3BhY2tldC9iaW5hcnlSZWFkZXInO1xuaW1wb3J0IHsgQXBwLCBESVNBQkxFRCwgSHR0cFJlcXVlc3QsIFNIQVJFRF9DT01QUkVTU09SLCB1c19saXN0ZW5fc29ja2V0LCB1c19saXN0ZW5fc29ja2V0X2Nsb3NlLCBXZWJTb2NrZXQgfSBmcm9tICd1V2ViU29ja2V0cy5qcyc7XG5pbXBvcnQgKiBhcyBIVFRQIGZyb20gJ2h0dHAnO1xuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2VydmVyPFRTZXJ2ZXIsIFRDbGllbnQ+KFxuXHRzZXJ2ZXJUeXBlOiBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBUU2VydmVyLFxuXHRjbGllbnRUeXBlOiBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBUQ2xpZW50LFxuXHRjcmVhdGVTZXJ2ZXI6IENyZWF0ZVNlcnZlcjxUU2VydmVyLCBUQ2xpZW50Pixcblx0b3B0aW9ucz86IFNlcnZlck9wdGlvbnMsXG5cdGVycm9ySGFuZGxlcj86IEVycm9ySGFuZGxlcixcblx0bG9nPzogTG9nZ2VyXG4pIHtcblx0cmV0dXJuIGNyZWF0ZVNlcnZlclJhdyhjcmVhdGVTZXJ2ZXIgYXMgQ3JlYXRlU2VydmVyTWV0aG9kLCBjcmVhdGVTZXJ2ZXJPcHRpb25zKHNlcnZlclR5cGUsIGNsaWVudFR5cGUsIG9wdGlvbnMpLCBlcnJvckhhbmRsZXIsIGxvZyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTZXJ2ZXJSYXcoXG5cdGNyZWF0ZVNlcnZlcjogQ3JlYXRlU2VydmVyTWV0aG9kLCBvcHRpb25zOiBTZXJ2ZXJPcHRpb25zLFxuXHRlcnJvckhhbmRsZXI/OiBFcnJvckhhbmRsZXIsIGxvZz86IExvZ2dlclxuKTogU2VydmVyIHtcblx0Y29uc3QgaG9zdCA9IGNyZWF0ZVNlcnZlckhvc3Qoe1xuXHRcdHBhdGg6IG9wdGlvbnMucGF0aCxcblx0XHRlcnJvckhhbmRsZXIsXG5cdFx0bG9nLFxuXHRcdHBvcnQ6IChvcHRpb25zIGFzIFBvcnRPcHRpb24pLnBvcnQsXG5cdFx0YXBwOiAob3B0aW9ucyBhcyBTZXJ2ZXJBcHBPcHRpb24pLmFwcCxcblx0XHRwZXJNZXNzYWdlRGVmbGF0ZTogb3B0aW9ucy5wZXJNZXNzYWdlRGVmbGF0ZSxcblx0XHRjb21wcmVzc2lvbjogb3B0aW9ucy5jb21wcmVzc2lvbixcblx0fSk7XG5cdGNvbnN0IHNvY2tldCA9IGhvc3Quc29ja2V0UmF3KGNyZWF0ZVNlcnZlciwgeyBpZDogJ3NvY2tldCcsIC4uLm9wdGlvbnMgfSk7XG5cdHNvY2tldC5jbG9zZSA9IGhvc3QuY2xvc2U7XG5cdHJldHVybiBzb2NrZXQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTZXJ2ZXJIb3N0KGdsb2JhbENvbmZpZzogR2xvYmFsQ29uZmlnKTogU2VydmVySG9zdCB7XG5cdGlmKCEoZ2xvYmFsQ29uZmlnIGFzIFNlcnZlckFwcE9wdGlvbikuYXBwICYmICEoZ2xvYmFsQ29uZmlnIGFzIFBvcnRPcHRpb24pLnBvcnQpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ1BvcnQgb3IgdVdlYlNvY2tldHMuanMgYXBwIG5vdCBwcm92aWRlZCcpO1xuXHR9XG5cdGlmKChnbG9iYWxDb25maWcgYXMgU2VydmVyQXBwT3B0aW9uKS5hcHAgJiYgKGdsb2JhbENvbmZpZyBhcyBQb3J0T3B0aW9uKS5wb3J0KSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdQcm92aWRlIHBvcnQgb3IgdVdlYlNvY2tldHMuanMgYXBwIGJ1dCBub3QgYm90aCcpO1xuXHR9XG5cdGNvbnN0IHV3c0FwcCA9IChnbG9iYWxDb25maWcgYXMgU2VydmVyQXBwT3B0aW9uKS5hcHAgfHwgQXBwKCk7XG5cdGNvbnN0IHtcblx0XHRwYXRoID0gJy93cycsXG5cdFx0bG9nID0gY29uc29sZS5sb2cuYmluZChjb25zb2xlKSxcblx0XHRlcnJvckhhbmRsZXIgPSBkZWZhdWx0RXJyb3JIYW5kbGVyLFxuXHRcdHBlck1lc3NhZ2VEZWZsYXRlID0gdHJ1ZSxcblx0XHRlcnJvckNvZGUgPSA0MDAsXG5cdFx0ZXJyb3JOYW1lID0gSFRUUC5TVEFUVVNfQ09ERVNbNDAwXSBhcyBzdHJpbmcsXG5cdFx0bmF0aXZlUGluZyA9IDAsXG5cdH0gPSBnbG9iYWxDb25maWc7XG5cdGNvbnN0IHNlcnZlcnM6IEludGVybmFsU2VydmVyW10gPSBbXTtcblxuXHRsZXQgdXBncmFkZVJlcTogT3JpZ2luYWxSZXF1ZXN0IHwgdW5kZWZpbmVkO1xuXHRsZXQgY29ubmVjdGVkU29ja2V0cyA9IG5ldyBNYXA8V2ViU29ja2V0LCBVV1NTb2NrZXRFdmVudHM+KCk7XG5cdHV3c0FwcC53cyhwYXRoLCB7XG5cdFx0Y29tcHJlc3Npb246IGdsb2JhbENvbmZpZy5jb21wcmVzc2lvbiA/IGdsb2JhbENvbmZpZy5jb21wcmVzc2lvbiA6IChwZXJNZXNzYWdlRGVmbGF0ZSA/IFNIQVJFRF9DT01QUkVTU09SIDogRElTQUJMRUQpLFxuXHRcdHNlbmRQaW5nc0F1dG9tYXRpY2FsbHk6ICEhbmF0aXZlUGluZyxcblx0XHRpZGxlVGltZW91dDogbmF0aXZlUGluZyA/IG5hdGl2ZVBpbmcgOiB1bmRlZmluZWQsXG5cblx0XHR1cGdyYWRlOiAocmVzLCByZXEsIGNvbnRleHQpID0+IHtcblx0XHRcdGlmICh1cGdyYWRlUmVxKSB7XG5cdFx0XHRcdHJlcy5lbmQoYEhUVFAvMS4xICR7NTAzfSAke0hUVFAuU1RBVFVTX0NPREVTWzUwM119XFxyXFxuXFxyXFxuYCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGxldCBhYm9ydGVkID0gZmFsc2U7XG5cdFx0XHRyZXMub25BYm9ydGVkKCgpID0+IHtcblx0XHRcdFx0YWJvcnRlZCA9IHRydWU7XG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IHVybCA9IHJlcS5nZXRVcmwoKTtcblx0XHRcdGNvbnN0IHNlY1dlYlNvY2tldEtleSA9IHJlcS5nZXRIZWFkZXIoJ3NlYy13ZWJzb2NrZXQta2V5Jyk7XG5cdFx0XHRjb25zdCBzZWNXZWJTb2NrZXRQcm90b2NvbCA9IHJlcS5nZXRIZWFkZXIoJ3NlYy13ZWJzb2NrZXQtcHJvdG9jb2wnKTtcblx0XHRcdGNvbnN0IHNlY1dlYlNvY2tldEV4dGVuc2lvbnMgPSByZXEuZ2V0SGVhZGVyKCdzZWMtd2Vic29ja2V0LWV4dGVuc2lvbnMnKTtcblxuXHRcdFx0aWYgKGdsb2JhbENvbmZpZy5wYXRoICYmIGdsb2JhbENvbmZpZy5wYXRoICE9PSB1cmwuc3BsaXQoJz8nKVswXS5zcGxpdCgnIycpWzBdKSB7XG5cdFx0XHRcdHJlcy5lbmQoYEhUVFAvMS4xICR7NDAwfSAke0hUVFAuU1RBVFVTX0NPREVTWzQwMF19XFxyXFxuXFxyXFxuYCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgb3JpZ2luYWxSZXF1ZXN0ID0gY3JlYXRlT3JpZ2luYWxSZXF1ZXN0KHJlcSk7XG5cdFx0XHR2ZXJpZnlDbGllbnQocmVxLCAocmVzdWx0LCBjb2RlLCBuYW1lKSA9PiB7XG5cdFx0XHRcdGlmIChhYm9ydGVkKSByZXR1cm47XG5cdFx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0XHR1cGdyYWRlUmVxID0gb3JpZ2luYWxSZXF1ZXN0O1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRyZXMudXBncmFkZSh7dXJsfSxcblx0XHRcdFx0XHRcdFx0c2VjV2ViU29ja2V0S2V5LFxuXHRcdFx0XHRcdFx0XHRzZWNXZWJTb2NrZXRQcm90b2NvbCxcblx0XHRcdFx0XHRcdFx0c2VjV2ViU29ja2V0RXh0ZW5zaW9ucyxcblx0XHRcdFx0XHRcdFx0Y29udGV4dCk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXMuZW5kKGBIVFRQLzEuMSAke2NvZGV9ICR7bmFtZX1cXHJcXG5cXHJcXG5gKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSxcblx0XHRvcGVuOiAod3MpID0+IHtcblx0XHRcdGlmICghdXBncmFkZVJlcSkge1xuXHRcdFx0XHR3cy5jbG9zZSgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB1d3NTb2NrZXRFdmVudHM6IFVXU1NvY2tldEV2ZW50cyA9IHtcblx0XHRcdFx0c29ja2V0OiB3cyxcblx0XHRcdFx0b25DbG9zZTogKCkgPT4ge30sXG5cdFx0XHRcdG9uTWVzc2FnZTogKCkgPT4ge30sXG5cdFx0XHRcdGlzQ2xvc2VkOiBmYWxzZSxcblx0XHRcdH07XG5cdFx0XHRjb25uZWN0U29ja2V0KHVwZ3JhZGVSZXEsIHV3c1NvY2tldEV2ZW50cyk7XG5cblx0XHRcdGNvbm5lY3RlZFNvY2tldHMuc2V0KHdzLCB1d3NTb2NrZXRFdmVudHMpO1xuXHRcdFx0dXBncmFkZVJlcSA9IHVuZGVmaW5lZDtcblx0XHR9LFxuXHRcdG1lc3NhZ2Uod3MsIG1lc3NhZ2UsIGlzQmluYXJ5KSB7XG5cdFx0XHRjb25uZWN0ZWRTb2NrZXRzLmdldCh3cykhLm9uTWVzc2FnZShtZXNzYWdlLCBpc0JpbmFyeSk7XG5cdFx0fSxcblx0XHRjbG9zZSh3cywgY29kZSwgbWVzc2FnZSkge1xuXHRcdFx0Y29uc3QgZXZlbnRzID0gY29ubmVjdGVkU29ja2V0cy5nZXQod3MpITtcblx0XHRcdGlmIChldmVudHMpIHtcblx0XHRcdFx0ZXZlbnRzLmlzQ2xvc2VkID0gdHJ1ZTsvL1xuXHRcdFx0XHRldmVudHMub25DbG9zZShjb2RlLCBtZXNzYWdlKTtcblx0XHRcdFx0Y29ubmVjdGVkU29ja2V0cy5kZWxldGUod3MpO1xuXHRcdFx0fVxuXHRcdH0sXG5cdH0pO1xuXG5cdGxldCBzb2NrZXRUb2tlbjogdXNfbGlzdGVuX3NvY2tldCB8IHVuZGVmaW5lZDtcblx0aWYgKChnbG9iYWxDb25maWcgYXMgUG9ydE9wdGlvbikucG9ydCkge1xuXHRcdGNvbnN0IHBvcnQgPSAoZ2xvYmFsQ29uZmlnIGFzIFBvcnRPcHRpb24pLnBvcnQ7XG5cdFx0dXdzQXBwLmxpc3Rlbihwb3J0LCB0b2tlbiA9PiB7XG5cdFx0XHRpZiAodG9rZW4pIHtcblx0XHRcdFx0c29ja2V0VG9rZW4gPSB0b2tlbjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihudWxsLCBuZXcgRXJyb3IoYEZhaWxlZCB0byBsaXN0ZW4gdG8gcG9ydCAke3BvcnR9YCkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0U2VydmVyKGlkOiBhbnkpIHtcblx0XHRpZiAoc2VydmVycy5sZW5ndGggPT09IDEpIHJldHVybiBzZXJ2ZXJzWzBdO1xuXG5cdFx0Zm9yIChjb25zdCBzZXJ2ZXIgb2Ygc2VydmVycykge1xuXHRcdFx0aWYgKHNlcnZlci5pZCA9PT0gaWQpIHJldHVybiBzZXJ2ZXI7XG5cdFx0fVxuXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBObyBzZXJ2ZXIgZm9yIGdpdmVuIGlkICgke2lkfSlgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHZlcmlmeUNsaWVudChyZXE6IEh0dHBSZXF1ZXN0LCBuZXh0OiAocmVzdWx0OiBhbnksIGNvZGU6IG51bWJlciwgbmFtZTogc3RyaW5nKSA9PiB2b2lkKSB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHF1ZXJ5ID0gZ2V0UXVlcnkoZ2V0RnVsbFVybChyZXEpKTtcblx0XHRcdGNvbnN0IHNlcnZlciA9IGdldFNlcnZlcihxdWVyeS5pZCk7XG5cblx0XHRcdGlmICghc2VydmVyLnZlcmlmeUNsaWVudChyZXEpKSB7XG5cdFx0XHRcdG5leHQoZmFsc2UsIGVycm9yQ29kZSwgZXJyb3JOYW1lKTtcblx0XHRcdH0gZWxzZSBpZiAoc2VydmVyLmNsaWVudExpbWl0ICE9PSAwICYmIHNlcnZlci5jbGllbnRMaW1pdCA8PSBzZXJ2ZXIuY2xpZW50cy5sZW5ndGgpIHtcblx0XHRcdFx0bmV4dChmYWxzZSwgZXJyb3JDb2RlLCBlcnJvck5hbWUpO1xuXHRcdFx0fSBlbHNlIGlmIChzZXJ2ZXIuY29ubmVjdGlvblRva2Vucykge1xuXHRcdFx0XHRpZiAoaGFzVG9rZW4oc2VydmVyLCBxdWVyeS50KSkge1xuXHRcdFx0XHRcdG5leHQodHJ1ZSwgMjAwLCAnT0snKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRuZXh0KGZhbHNlLCBlcnJvckNvZGUsIGVycm9yTmFtZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG5leHQodHJ1ZSwgMjAwLCAnT0snKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3IobnVsbCwgZSk7XG5cdFx0XHRuZXh0KGZhbHNlLCBlcnJvckNvZGUsIGVycm9yTmFtZSk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gY2xvc2UoKSB7XG5cdFx0c2VydmVycy5mb3JFYWNoKGNsb3NlU2VydmVyKTtcblx0XHRjb25uZWN0ZWRTb2NrZXRzLmZvckVhY2goKF8sIHNvY2tldCkgPT4gc29ja2V0LmVuZCgpKTtcblx0XHRpZiAoc29ja2V0VG9rZW4pIHtcblx0XHRcdHVzX2xpc3Rlbl9zb2NrZXRfY2xvc2Uoc29ja2V0VG9rZW4pO1xuXHRcdFx0c29ja2V0VG9rZW4gPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gY2xvc2VBbmRSZW1vdmVTZXJ2ZXIoc2VydmVyOiBJbnRlcm5hbFNlcnZlcikge1xuXHRcdGNsb3NlU2VydmVyKHNlcnZlcik7XG5cdFx0Y29uc3QgaW5kZXggPSBzZXJ2ZXJzLmluZGV4T2Yoc2VydmVyKTtcblx0XHRpZiAoaW5kZXggIT09IC0xKSBzZXJ2ZXJzLnNwbGljZShpbmRleCwgMSk7XG5cdH1cblxuXHRmdW5jdGlvbiBzb2NrZXQ8VFNlcnZlciwgVENsaWVudD4oXG5cdFx0c2VydmVyVHlwZTogbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gVFNlcnZlcixcblx0XHRjbGllbnRUeXBlOiBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBUQ2xpZW50LFxuXHRcdGNyZWF0ZVNlcnZlcjogQ3JlYXRlU2VydmVyPFRTZXJ2ZXIsIFRDbGllbnQ+LFxuXHRcdGJhc2VPcHRpb25zPzogU2VydmVyT3B0aW9uc1xuXHQpOiBTZXJ2ZXIge1xuXHRcdGNvbnN0IG9wdGlvbnMgPSBjcmVhdGVTZXJ2ZXJPcHRpb25zKHNlcnZlclR5cGUsIGNsaWVudFR5cGUsIGJhc2VPcHRpb25zKTtcblx0XHRyZXR1cm4gc29ja2V0UmF3KGNyZWF0ZVNlcnZlciBhcyBDcmVhdGVTZXJ2ZXJNZXRob2QsIG9wdGlvbnMpO1xuXHR9XG5cblx0ZnVuY3Rpb24gc29ja2V0UmF3KGNyZWF0ZVNlcnZlcjogQ3JlYXRlU2VydmVyTWV0aG9kLCBvcHRpb25zOiBTZXJ2ZXJPcHRpb25zKTogU2VydmVyIHtcblx0XHRjb25zdCBpbnRlcm5hbFNlcnZlciA9IGNyZWF0ZUludGVybmFsU2VydmVyKGNyZWF0ZVNlcnZlciwgeyAuLi5vcHRpb25zLCBwYXRoIH0sIGVycm9ySGFuZGxlciwgbG9nKTtcblxuXHRcdGlmIChzZXJ2ZXJzLnNvbWUocyA9PiBzLmlkID09PSBpbnRlcm5hbFNlcnZlci5pZCkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IG9wZW4gdHdvIHNvY2tldHMgd2l0aCB0aGUgc2FtZSBpZCcpO1xuXHRcdH1cblxuXHRcdHNlcnZlcnMucHVzaChpbnRlcm5hbFNlcnZlcik7XG5cdFx0aW50ZXJuYWxTZXJ2ZXIuc2VydmVyLmNsb3NlID0gKCkgPT4gY2xvc2VBbmRSZW1vdmVTZXJ2ZXIoaW50ZXJuYWxTZXJ2ZXIpO1xuXHRcdHJldHVybiBpbnRlcm5hbFNlcnZlci5zZXJ2ZXI7XG5cdH1cblxuXHRmdW5jdGlvbiBjb25uZWN0U29ja2V0KG9yaWdpbmFsUmVxdWVzdDogT3JpZ2luYWxSZXF1ZXN0LCBzb2NrZXRFdmVudHM6IFVXU1NvY2tldEV2ZW50cykge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBxdWVyeSA9IGdldFF1ZXJ5KG9yaWdpbmFsUmVxdWVzdC51cmwpO1xuXHRcdFx0Y29uc3Qgc2VydmVyID0gZ2V0U2VydmVyKHF1ZXJ5LmlkKTtcblxuXHRcdFx0Y29ubmVjdENsaWVudChzZXJ2ZXIsIG9yaWdpbmFsUmVxdWVzdCwgZXJyb3JIYW5kbGVyLCBsb2csIHNvY2tldEV2ZW50cyk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0aWYgKCFzb2NrZXRFdmVudHMuaXNDbG9zZWQpIHtcblx0XHRcdFx0c29ja2V0RXZlbnRzLnNvY2tldC5lbmQoKTtcblx0XHRcdH1cblx0XHRcdGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihudWxsLCBlKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4geyBjbG9zZSwgc29ja2V0LCBzb2NrZXRSYXcsIGFwcDogdXdzQXBwIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUludGVybmFsU2VydmVyKFxuXHRjcmVhdGVTZXJ2ZXI6IENyZWF0ZVNlcnZlck1ldGhvZCwgb3B0aW9uczogU2VydmVyT3B0aW9ucywgZXJyb3JIYW5kbGVyOiBFcnJvckhhbmRsZXIsIGxvZzogTG9nZ2VyLFxuKTogSW50ZXJuYWxTZXJ2ZXIge1xuXHRvcHRpb25zID0gb3B0aW9uc1dpdGhEZWZhdWx0cyhvcHRpb25zKTtcblxuXHRjb25zdCBvblNlbmQgPSBvcHRpb25zLm9uU2VuZDtcblx0Y29uc3QgaGFuZGxlck9wdGlvbnM6IEhhbmRsZXJPcHRpb25zID0ge1xuXHRcdGRlYnVnOiBvcHRpb25zLmRlYnVnLFxuXHRcdGRldmVsb3BtZW50OiBvcHRpb25zLmRldmVsb3BtZW50LFxuXHRcdGZvcmNlQmluYXJ5OiBvcHRpb25zLmZvcmNlQmluYXJ5LFxuXHRcdGZvcmNlQmluYXJ5UGFja2V0czogb3B0aW9ucy5mb3JjZUJpbmFyeVBhY2tldHMsXG5cdFx0b25TZW5kLFxuXHRcdG9uUmVjdjogb3B0aW9ucy5vblJlY3YsXG5cdFx0dXNlQnVmZmVyOiB0cnVlLFxuXHR9O1xuXG5cdGNvbnN0IHBhY2tldEhhbmRsZXIgPSBjcmVhdGVQYWNrZXRIYW5kbGVyKG9wdGlvbnMuc2VydmVyLCBvcHRpb25zLmNsaWVudCwgaGFuZGxlck9wdGlvbnMsIGxvZyk7XG5cdGNvbnN0IGNsaWVudE9wdGlvbnMgPSB0b0NsaWVudE9wdGlvbnMob3B0aW9ucyk7XG5cdGNvbnN0IGNsaWVudE1ldGhvZHMgPSBnZXROYW1lcyhvcHRpb25zLmNsaWVudCEpO1xuXHRjb25zdCBzZXJ2ZXI6IEludGVybmFsU2VydmVyID0ge1xuXHRcdGlkOiBvcHRpb25zLmlkID8/ICdzb2NrZXQnLFxuXHRcdGNsaWVudHM6IFtdLFxuXHRcdGZyZWVUb2tlbnM6IG5ldyBNYXAoKSxcblx0XHRjbGllbnRzQnlUb2tlbjogbmV3IE1hcCgpLFxuXHRcdHRvdGFsU2VudDogMCxcblx0XHR0b3RhbFJlY2VpdmVkOiAwLFxuXHRcdGN1cnJlbnRDbGllbnRJZDogb3B0aW9ucy5jbGllbnRCYXNlSWQgPz8gMSxcblx0XHRwYXRoOiBvcHRpb25zLnBhdGggPz8gJycsXG5cdFx0aGFzaDogb3B0aW9ucy5oYXNoID8/ICcnLFxuXHRcdGRlYnVnOiAhIW9wdGlvbnMuZGVidWcsXG5cdFx0Zm9yY2VCaW5hcnk6ICEhb3B0aW9ucy5mb3JjZUJpbmFyeSxcblx0XHRjb25uZWN0aW9uVG9rZW5zOiAhIW9wdGlvbnMuY29ubmVjdGlvblRva2Vucyxcblx0XHRrZWVwT3JpZ2luYWxSZXF1ZXN0OiAhIW9wdGlvbnMua2VlcE9yaWdpbmFsUmVxdWVzdCxcblx0XHRlcnJvcklmTm90Q29ubmVjdGVkOiAhIW9wdGlvbnMuZXJyb3JJZk5vdENvbm5lY3RlZCxcblx0XHR0b2tlbkxpZmV0aW1lOiBvcHRpb25zLnRva2VuTGlmZXRpbWUgPz8gMCxcblx0XHRjbGllbnRMaW1pdDogb3B0aW9ucy5jbGllbnRMaW1pdCA/PyAwLFxuXHRcdHRyYW5zZmVyTGltaXQ6IG9wdGlvbnMudHJhbnNmZXJMaW1pdCA/PyAwLFxuXHRcdHZlcmlmeUNsaWVudDogb3B0aW9ucy52ZXJpZnlDbGllbnQgPz8gcmV0dXJuVHJ1ZSxcblx0XHRjcmVhdGVDbGllbnQ6IG9wdGlvbnMuY3JlYXRlQ2xpZW50LFxuXHRcdHNlcnZlck1ldGhvZHM6IG9wdGlvbnMuc2VydmVyISxcblx0XHRjbGllbnRNZXRob2RzLFxuXHRcdHJhdGVMaW1pdHM6IG9wdGlvbnMuc2VydmVyIS5tYXAocGFyc2VSYXRlTGltaXREZWYpLFxuXHRcdGhhbmRsZVJlc3VsdCxcblx0XHRjcmVhdGVTZXJ2ZXIsXG5cdFx0cGFja2V0SGFuZGxlcixcblx0XHRzZXJ2ZXI6IHt9IGFzIGFueSxcblx0XHRwaW5nSW50ZXJ2YWw6IHVuZGVmaW5lZCxcblx0XHR0b2tlbkludGVydmFsOiB1bmRlZmluZWQsXG5cdH07XG5cblx0ZnVuY3Rpb24gaGFuZGxlUmVzdWx0KHNlbmQ6IFNlbmQsIG9iajogQ2xpZW50U3RhdGUsIGZ1bmNJZDogbnVtYmVyLCBmdW5jTmFtZTogc3RyaW5nLCByZXN1bHQ6IFByb21pc2U8YW55PiwgbWVzc2FnZUlkOiBudW1iZXIpIHtcblx0XHRpZiAocmVzdWx0ICYmIHR5cGVvZiByZXN1bHQudGhlbiA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0cmVzdWx0LnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdFx0aWYgKG9iai5jbGllbnQuaXNDb25uZWN0ZWQoKSkge1xuXHRcdFx0XHRcdHBhY2tldEhhbmRsZXIuc2VuZFN0cmluZyhzZW5kLCBgKnJlc29sdmU6JHtmdW5jTmFtZX1gLCBNZXNzYWdlVHlwZS5SZXNvbHZlZCwgW2Z1bmNJZCwgbWVzc2FnZUlkLCByZXN1bHRdKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgKGU6IEVycm9yKSA9PiB7XG5cdFx0XHRcdGUgPSBlcnJvckhhbmRsZXIuaGFuZGxlUmVqZWN0aW9uKG9iai5jbGllbnQsIGUpIHx8IGU7XG5cdFx0XHRcdGlmIChvYmouY2xpZW50LmlzQ29ubmVjdGVkKCkpIHtcblx0XHRcdFx0XHRwYWNrZXRIYW5kbGVyLnNlbmRTdHJpbmcoc2VuZCwgYCpyZWplY3Q6JHtmdW5jTmFtZX1gLCBNZXNzYWdlVHlwZS5SZWplY3RlZCwgW2Z1bmNJZCwgbWVzc2FnZUlkLCBlID8gZS5tZXNzYWdlIDogJ2Vycm9yJ10pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KS5jYXRjaCgoZTogRXJyb3IpID0+IGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihvYmouY2xpZW50LCBlKSk7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgcGluZ0ludGVydmFsID0gb3B0aW9ucy5waW5nSW50ZXJ2YWw7XG5cblx0aWYgKHBpbmdJbnRlcnZhbCkge1xuXHRcdHNlcnZlci5waW5nSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHRjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXHRcdFx0Y29uc3QgdGhyZXNob2xkID0gbm93IC0gcGluZ0ludGVydmFsO1xuXHRcdFx0Y29uc3QgdGltZW91dFRocmVzaG9sZCA9IG5vdyAtIG9wdGlvbnMuY29ubmVjdGlvblRpbWVvdXQhO1xuXG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHNlcnZlci5jbGllbnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGMgPSBzZXJ2ZXIuY2xpZW50c1tpXTtcblxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGlmIChjLmxhc3RNZXNzYWdlVGltZSA8IHRpbWVvdXRUaHJlc2hvbGQpIHtcblx0XHRcdFx0XHRcdGMuY2xpZW50LmRpc2Nvbm5lY3QodHJ1ZSwgZmFsc2UsICd0aW1lb3V0Jyk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChjLmxhc3RTZW5kVGltZSA8IHRocmVzaG9sZCkge1xuXHRcdFx0XHRcdFx0Yy5waW5nKCk7XG5cdFx0XHRcdFx0XHRpZiAob25TZW5kKSBvblNlbmQoLTEsICdQSU5HJywgMCwgZmFsc2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBjYXRjaCB7IH1cblx0XHRcdH1cblx0XHR9LCBwaW5nSW50ZXJ2YWwpO1xuXHR9XG5cblx0aWYgKG9wdGlvbnMuY29ubmVjdGlvblRva2Vucykge1xuXHRcdHNlcnZlci50b2tlbkludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXHRcdFx0Y29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblx0XHRcdGNvbnN0IGlkczogc3RyaW5nW10gPSBbXTtcblxuXHRcdFx0c2VydmVyLmZyZWVUb2tlbnMuZm9yRWFjaCh0b2tlbiA9PiB7XG5cdFx0XHRcdGlmICh0b2tlbi5leHBpcmUgPCBub3cpIHtcblx0XHRcdFx0XHRpZHMucHVzaCh0b2tlbi5pZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGlkIG9mIGlkcykge1xuXHRcdFx0XHRzZXJ2ZXIuZnJlZVRva2Vucy5kZWxldGUoaWQpO1xuXHRcdFx0fVxuXHRcdH0sIDEwMDAwKTtcblx0fVxuXG5cdHNlcnZlci5zZXJ2ZXIgPSB7XG5cdFx0Z2V0IGNsaWVudHMoKSB7XG5cdFx0XHRyZXR1cm4gc2VydmVyLmNsaWVudHM7XG5cdFx0fSxcblx0XHRjbG9zZSgpIHtcblx0XHRcdGNsb3NlU2VydmVyKHNlcnZlcik7XG5cdFx0fSxcblx0XHRvcHRpb25zKCk6IENsaWVudE9wdGlvbnMge1xuXHRcdFx0cmV0dXJuIGNsb25lRGVlcChjbGllbnRPcHRpb25zKTtcblx0XHR9LFxuXHRcdHRva2VuKGRhdGE/OiBhbnkpIHtcblx0XHRcdHJldHVybiBjcmVhdGVUb2tlbihzZXJ2ZXIsIGRhdGEpLmlkO1xuXHRcdH0sXG5cdFx0Y2xlYXJUb2tlbihpZDogc3RyaW5nKSB7XG5cdFx0XHRzZXJ2ZXIuZnJlZVRva2Vucy5kZWxldGUoaWQpO1xuXHRcdFx0c2VydmVyLmNsaWVudHNCeVRva2VuLmdldChpZCk/LmNsaWVudC5kaXNjb25uZWN0KHRydWUsIHRydWUsICdjbGVhciB0b2tlbnMnKTtcblx0XHR9LFxuXHRcdGNsZWFyVG9rZW5zKHRlc3Q6IChpZDogc3RyaW5nLCBkYXRhPzogYW55KSA9PiBib29sZWFuKSB7XG5cdFx0XHRjb25zdCBpZHM6IHN0cmluZ1tdID0gW107XG5cblx0XHRcdHNlcnZlci5mcmVlVG9rZW5zLmZvckVhY2godG9rZW4gPT4ge1xuXHRcdFx0XHRpZiAodGVzdCh0b2tlbi5pZCwgdG9rZW4uZGF0YSkpIHtcblx0XHRcdFx0XHRpZHMucHVzaCh0b2tlbi5pZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRzZXJ2ZXIuY2xpZW50c0J5VG9rZW4uZm9yRWFjaCgoeyB0b2tlbiB9KSA9PiB7XG5cdFx0XHRcdGlmICh0b2tlbiAmJiB0ZXN0KHRva2VuLmlkLCB0b2tlbi5kYXRhKSkge1xuXHRcdFx0XHRcdGlkcy5wdXNoKHRva2VuLmlkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGZvciAoY29uc3QgaWQgb2YgaWRzKSB7XG5cdFx0XHRcdHRoaXMuY2xlYXJUb2tlbihpZCk7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRpbmZvKCkge1xuXHRcdFx0Y29uc3Qgd3JpdGVyQnVmZmVyU2l6ZSA9IHBhY2tldEhhbmRsZXIud3JpdGVyQnVmZmVyU2l6ZSgpO1xuXHRcdFx0Y29uc3QgZnJlZVRva2VucyA9IHNlcnZlci5mcmVlVG9rZW5zLnNpemU7XG5cdFx0XHRjb25zdCBjbGllbnRzQnlUb2tlbiA9IHNlcnZlci5jbGllbnRzQnlUb2tlbi5zaXplO1xuXHRcdFx0cmV0dXJuIHsgd3JpdGVyQnVmZmVyU2l6ZSwgZnJlZVRva2VucywgY2xpZW50c0J5VG9rZW4gfTtcblx0XHR9LFxuXHR9O1xuXG5cdHJldHVybiBzZXJ2ZXI7XG59XG5cbmZ1bmN0aW9uIGNsb3NlU2VydmVyKHNlcnZlcjogSW50ZXJuYWxTZXJ2ZXIpIHtcblx0aWYgKHNlcnZlci5waW5nSW50ZXJ2YWwpIHtcblx0XHRjbGVhckludGVydmFsKHNlcnZlci5waW5nSW50ZXJ2YWwpO1xuXHRcdHNlcnZlci5waW5nSW50ZXJ2YWwgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRpZiAoc2VydmVyLnRva2VuSW50ZXJ2YWwpIHtcblx0XHRjbGVhckludGVydmFsKHNlcnZlci50b2tlbkludGVydmFsKTtcblx0XHRzZXJ2ZXIudG9rZW5JbnRlcnZhbCA9IHVuZGVmaW5lZDtcblx0fVxufVxuXG5mdW5jdGlvbiBjb25uZWN0Q2xpZW50KFxuXHRzZXJ2ZXI6IEludGVybmFsU2VydmVyLCBvcmlnaW5hbFJlcXVlc3Q6IE9yaWdpbmFsUmVxdWVzdCwgZXJyb3JIYW5kbGVyOiBFcnJvckhhbmRsZXIsIGxvZzogTG9nZ2VyLFxuXHR1d3NTb2NrZXRFdmVudHM6IFVXU1NvY2tldEV2ZW50c1xuKSB7XG5cdGNvbnN0IHNvY2tldCA9IHV3c1NvY2tldEV2ZW50cy5zb2NrZXQ7XG5cdGNvbnN0IHF1ZXJ5ID0gZ2V0UXVlcnkob3JpZ2luYWxSZXF1ZXN0LnVybCk7XG5cdGNvbnN0IHQgPSAocXVlcnkudCB8fCAnJykgYXMgc3RyaW5nO1xuXHRjb25zdCB0b2tlbiA9IHNlcnZlci5jb25uZWN0aW9uVG9rZW5zID8gZ2V0VG9rZW4oc2VydmVyLCB0KSB8fCBnZXRUb2tlbkZyb21DbGllbnQoc2VydmVyLCB0KSA6IHVuZGVmaW5lZDtcblxuXHRpZiAoc2VydmVyLmhhc2ggJiYgcXVlcnkuaGFzaCAhPT0gc2VydmVyLmhhc2gpIHtcblx0XHRpZiAoc2VydmVyLmRlYnVnKSBsb2coJ2NsaWVudCBkaXNjb25uZWN0ZWQgKGhhc2ggbWlzbWF0Y2gpJyk7XG5cblx0XHRzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeShbTWVzc2FnZVR5cGUuVmVyc2lvbiwgc2VydmVyLmhhc2hdKSk7XG5cdFx0aWYgKCF1d3NTb2NrZXRFdmVudHMuaXNDbG9zZWQpIHtcblx0XHRcdHNvY2tldC5lbmQoKTtcblx0XHR9XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0aWYgKHNlcnZlci5jb25uZWN0aW9uVG9rZW5zICYmICF0b2tlbikge1xuXHRcdGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcih7IG9yaWdpbmFsUmVxdWVzdCB9IGFzIGFueSwgbmV3IEVycm9yKGBJbnZhbGlkIHRva2VuOiAke3R9YCkpO1xuXHRcdGlmICghdXdzU29ja2V0RXZlbnRzLmlzQ2xvc2VkKSB7XG5cdFx0XHR1d3NTb2NrZXRFdmVudHMuc29ja2V0LmVuZCgpO1xuXHRcdH1cblx0XHRyZXR1cm47XG5cdH1cblxuXHRjb25zdCBjYWxsc0xpc3Q6IG51bWJlcltdID0gW107XG5cdGNvbnN0IHsgaGFuZGxlUmVzdWx0LCBjcmVhdGVDbGllbnQgPSB4ID0+IHggfSA9IHNlcnZlcjtcblxuXHRsZXQgYnl0ZXNSZXNldCA9IERhdGUubm93KCk7XG5cdGxldCBieXRlc1JlY2VpdmVkID0gMDtcblx0bGV0IHRyYW5zZmVyTGltaXRFeGNlZWRlZCA9IGZhbHNlO1xuXHRsZXQgaXNDb25uZWN0ZWQgPSB0cnVlO1xuXHRsZXQgc2VydmVyQWN0aW9uczogU29ja2V0U2VydmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRsZXQgY2xvc2VSZWFzb246IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRjb25zdCBvYmo6IENsaWVudFN0YXRlID0ge1xuXHRcdGxhc3RNZXNzYWdlVGltZTogRGF0ZS5ub3coKSxcblx0XHRsYXN0TWVzc2FnZUlkOiAwLFxuXHRcdGxhc3RTZW5kVGltZTogRGF0ZS5ub3coKSxcblx0XHRzZW50U2l6ZTogMCxcblx0XHRzdXBwb3J0c0JpbmFyeTogISFzZXJ2ZXIuZm9yY2VCaW5hcnkgfHwgISEocXVlcnkgJiYgcXVlcnkuYmluID09PSAndHJ1ZScpLFxuXHRcdHRva2VuLFxuXHRcdHBpbmcoKSB7XG5cdFx0XHRzb2NrZXQuc2VuZCgnJyk7XG5cdFx0fSxcblx0XHRjbGllbnQ6IGNyZWF0ZUNsaWVudCh7XG5cdFx0XHRpZDogc2VydmVyLmN1cnJlbnRDbGllbnRJZCsrLFxuXHRcdFx0dG9rZW5JZDogdG9rZW4gPyB0b2tlbi5pZCA6IHVuZGVmaW5lZCxcblx0XHRcdHRva2VuRGF0YTogdG9rZW4gPyB0b2tlbi5kYXRhIDogdW5kZWZpbmVkLFxuXHRcdFx0b3JpZ2luYWxSZXF1ZXN0OiBzZXJ2ZXIua2VlcE9yaWdpbmFsUmVxdWVzdCA/IG9yaWdpbmFsUmVxdWVzdCA6IHVuZGVmaW5lZCxcblx0XHRcdHRyYW5zZmVyTGltaXQ6IHNlcnZlci50cmFuc2ZlckxpbWl0LFxuXHRcdFx0aXNDb25uZWN0ZWQoKSB7XG5cdFx0XHRcdHJldHVybiBpc0Nvbm5lY3RlZDtcblx0XHRcdH0sXG5cdFx0XHRsYXN0TWVzc2FnZVRpbWUoKSB7XG5cdFx0XHRcdHJldHVybiBvYmoubGFzdE1lc3NhZ2VUaW1lO1xuXHRcdFx0fSxcblx0XHRcdGRpc2Nvbm5lY3QoZm9yY2UgPSBmYWxzZSwgaW52YWxpZGF0ZVRva2VuID0gZmFsc2UsIHJlYXNvbiA9ICcnKSB7XG5cdFx0XHRcdGlzQ29ubmVjdGVkID0gZmFsc2U7XG5cblx0XHRcdFx0aWYgKGludmFsaWRhdGVUb2tlbiAmJiBvYmoudG9rZW4pIHtcblx0XHRcdFx0XHRpZiAoc2VydmVyLmNsaWVudHNCeVRva2VuLmdldChvYmoudG9rZW4uaWQpID09PSBvYmopIHtcblx0XHRcdFx0XHRcdHNlcnZlci5jbGllbnRzQnlUb2tlbi5kZWxldGUob2JqLnRva2VuLmlkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0b2JqLnRva2VuID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGZvcmNlKSB7XG5cdFx0XHRcdFx0aWYgKCF1d3NTb2NrZXRFdmVudHMpIHtcblx0XHRcdFx0XHRcdHNvY2tldC5lbmQoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y2xvc2VSZWFzb24gPSByZWFzb247XG5cdFx0XHRcdFx0c29ja2V0LmNsb3NlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0fSwgc2VuZCksXG5cdH07XG5cblx0aWYgKG9iai50b2tlbikge1xuXHRcdHNlcnZlci5jbGllbnRzQnlUb2tlbi5zZXQob2JqLnRva2VuLmlkLCBvYmopO1xuXHR9XG5cblx0Ly8gVE9ETzogcmVtb3ZlIFVpbnQ4QXJyYXkgZnJvbSBoZXJlXG5cdGZ1bmN0aW9uIHNlbmQoZGF0YTogc3RyaW5nIHwgVWludDhBcnJheSB8IEJ1ZmZlcikge1xuXHRcdGlmIChzZXJ2ZXIuZXJyb3JJZk5vdENvbm5lY3RlZCAmJiAhaXNDb25uZWN0ZWQpIHtcblx0XHRcdGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihvYmouY2xpZW50LCBuZXcgRXJyb3IoJ05vdCBDb25uZWN0ZWQnKSk7XG5cdFx0fVxuXG5cdFx0aWYgKGRhdGEgaW5zdGFuY2VvZiBCdWZmZXIpIHtcblx0XHRcdHNlcnZlci50b3RhbFNlbnQgKz0gZGF0YS5ieXRlTGVuZ3RoO1xuXHRcdFx0c29ja2V0LnNlbmQoZGF0YSwgdHJ1ZSk7XG5cdFx0fSBlbHNlIGlmICh0eXBlb2YgZGF0YSAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHNlcnZlci50b3RhbFNlbnQgKz0gZGF0YS5ieXRlTGVuZ3RoO1xuXHRcdFx0c29ja2V0LnNlbmQoQnVmZmVyLmZyb20oZGF0YS5idWZmZXIsIGRhdGEuYnl0ZU9mZnNldCwgZGF0YS5ieXRlTGVuZ3RoKSwgdHJ1ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHNlcnZlci50b3RhbFNlbnQgKz0gZGF0YS5sZW5ndGg7XG5cdFx0XHRzb2NrZXQuc2VuZChkYXRhLCBmYWxzZSk7XG5cdFx0fVxuXG5cdFx0b2JqLmxhc3RTZW5kVGltZSA9IERhdGUubm93KCk7XG5cdH1cblxuXHRjb25zdCBoYW5kbGVSZXN1bHQyOiBIYW5kbGVSZXN1bHQgPSAoZnVuY0lkLCBmdW5kTmFtZSwgcmVzdWx0LCBtZXNzYWdlSWQpID0+IHtcblx0XHRoYW5kbGVSZXN1bHQoc2VuZCwgb2JqLCBmdW5jSWQsIGZ1bmROYW1lLCByZXN1bHQsIG1lc3NhZ2VJZCk7XG5cdH07XG5cblx0ZnVuY3Rpb24gc2VydmVyQWN0aW9uc0NyZWF0ZWQoc2VydmVyQWN0aW9uczogU29ja2V0U2VydmVyKSB7XG5cdFx0dXdzU29ja2V0RXZlbnRzLm9uTWVzc2FnZSA9IChtZXNzYWdlLCBpc0JpbmFyeSkgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0bGV0IGRhdGE6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0aWYgKCFpc0JpbmFyeSkge1xuXHRcdFx0XHRcdGRhdGEgPSBCdWZmZXIuZnJvbShtZXNzYWdlKS50b1N0cmluZygpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh0cmFuc2ZlckxpbWl0RXhjZWVkZWQgfHwgIWlzQ29ubmVjdGVkKVxuXHRcdFx0XHRcdHJldHVybjtcblxuXHRcdFx0XHRjb25zdCBtZXNzYWdlTGVuZ3RoID0gZ2V0TGVuZ3RoKGRhdGEgfHwgbWVzc2FnZSk7XG5cdFx0XHRcdGJ5dGVzUmVjZWl2ZWQgKz0gbWVzc2FnZUxlbmd0aDtcblx0XHRcdFx0c2VydmVyLnRvdGFsUmVjZWl2ZWQgKz0gYnl0ZXNSZWNlaXZlZDtcblxuXHRcdFx0XHRsZXQgcmVhZGVyOiBCaW5hcnlSZWFkZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRcdFx0aWYgKG1lc3NhZ2VMZW5ndGgpIHtcblx0XHRcdFx0XHRpZiAoaXNCaW5hcnkpIHtcblx0XHRcdFx0XHRcdHJlYWRlciA9IGNyZWF0ZUJpbmFyeVJlYWRlckZyb21CdWZmZXIobWVzc2FnZSwgMCwgbWVzc2FnZS5ieXRlTGVuZ3RoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXHRcdFx0XHRjb25zdCBkaWZmID0gbm93IC0gYnl0ZXNSZXNldDtcblx0XHRcdFx0Y29uc3QgYnl0ZXNQZXJTZWNvbmQgPSBieXRlc1JlY2VpdmVkICogMTAwMCAvIE1hdGgubWF4KDEwMDAsIGRpZmYpO1xuXHRcdFx0XHRjb25zdCB0cmFuc2ZlckxpbWl0ID0gb2JqLmNsaWVudC50cmFuc2ZlckxpbWl0O1xuXG5cdFx0XHRcdGlmICh0cmFuc2ZlckxpbWl0ICYmIHRyYW5zZmVyTGltaXQgPCBieXRlc1BlclNlY29uZCkge1xuXHRcdFx0XHRcdHRyYW5zZmVyTGltaXRFeGNlZWRlZCA9IHRydWU7XG5cdFx0XHRcdFx0b2JqLmNsaWVudC5kaXNjb25uZWN0KHRydWUsIHRydWUsICd0cmFuc2ZlciBsaW1pdCcpO1xuXHRcdFx0XHRcdGVycm9ySGFuZGxlci5oYW5kbGVSZWN2RXJyb3IoXG5cdFx0XHRcdFx0XHRvYmouY2xpZW50LCBuZXcgRXJyb3IoYFRyYW5zZmVyIGxpbWl0IGV4Y2VlZGVkICR7Ynl0ZXNQZXJTZWNvbmQudG9GaXhlZCgwKX0vJHt0cmFuc2ZlckxpbWl0fSAoJHtkaWZmfW1zKWApLFxuXHRcdFx0XHRcdFx0cmVhZGVyID8gZ2V0QmluYXJ5UmVhZGVyQnVmZmVyKHJlYWRlcikgOiBkYXRhISk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHNlcnZlci5mb3JjZUJpbmFyeSAmJiBkYXRhICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRvYmouY2xpZW50LmRpc2Nvbm5lY3QodHJ1ZSwgdHJ1ZSwgJ25vbi1iaW5hcnkgbWVzc2FnZScpO1xuXHRcdFx0XHRcdGVycm9ySGFuZGxlci5oYW5kbGVSZWN2RXJyb3Iob2JqLmNsaWVudCwgbmV3IEVycm9yKGBTdHJpbmcgbWVzc2FnZSB3aGlsZSBmb3JjZWQgYmluYXJ5YCksXG5cdFx0XHRcdFx0XHRyZWFkZXIgPyBnZXRCaW5hcnlSZWFkZXJCdWZmZXIocmVhZGVyKSA6IGRhdGEhKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRvYmoubGFzdE1lc3NhZ2VUaW1lID0gRGF0ZS5ub3coKTtcblx0XHRcdFx0b2JqLnN1cHBvcnRzQmluYXJ5ID0gb2JqLnN1cHBvcnRzQmluYXJ5IHx8ICEhKGlzQmluYXJ5KTtcblxuXHRcdFx0XHRpZiAocmVhZGVyIHx8IGRhdGEpIHtcblx0XHRcdFx0XHRvYmoubGFzdE1lc3NhZ2VJZCsrO1xuXHRcdFx0XHRcdGNvbnN0IG1lc3NhZ2VJZCA9IG9iai5sYXN0TWVzc2FnZUlkO1xuXG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdC8vIFRPRE86IG9wdGlvbnMub25QYWNrZXQ/LihvYmouY2xpZW50KVxuXG5cdFx0XHRcdFx0XHRpZiAoZGF0YSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRcdHNlcnZlci5wYWNrZXRIYW5kbGVyLnJlY3ZTdHJpbmcoZGF0YSwgc2VydmVyQWN0aW9ucywge30sIChmdW5jSWQsIGZ1bmNOYW1lLCBmdW5jLCBmdW5jT2JqLCBhcmdzKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgcmF0ZSA9IHNlcnZlci5yYXRlTGltaXRzW2Z1bmNJZF07XG5cblx0XHRcdFx0XHRcdFx0XHQvLyBUT0RPOiBtb3ZlIHJhdGUgbGltaXRzIHRvIHBhY2tldCBoYW5kbGVyXG5cdFx0XHRcdFx0XHRcdFx0aWYgKGNoZWNrUmF0ZUxpbWl0MihmdW5jSWQsIGNhbGxzTGlzdCwgc2VydmVyLnJhdGVMaW1pdHMpKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRoYW5kbGVSZXN1bHQoc2VuZCwgb2JqLCBmdW5jSWQsIGZ1bmNOYW1lLCBmdW5jLmFwcGx5KGZ1bmNPYmosIGFyZ3MpLCBtZXNzYWdlSWQpO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSBpZiAocmF0ZSAmJiByYXRlLnByb21pc2UpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGhhbmRsZVJlc3VsdChzZW5kLCBvYmosIGZ1bmNJZCwgZnVuY05hbWUsIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignUmF0ZSBsaW1pdCBleGNlZWRlZCcpKSwgbWVzc2FnZUlkKTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBSYXRlIGxpbWl0IGV4Y2VlZGVkICgke2Z1bmNOYW1lfSlgKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0c2VydmVyLnBhY2tldEhhbmRsZXIucmVjdkJpbmFyeShzZXJ2ZXJBY3Rpb25zLCByZWFkZXIhLCBjYWxsc0xpc3QsIG1lc3NhZ2VJZCwgaGFuZGxlUmVzdWx0Mik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdFx0ZXJyb3JIYW5kbGVyLmhhbmRsZVJlY3ZFcnJvcihvYmouY2xpZW50LCBlLCByZWFkZXIgPyBnZXRCaW5hcnlSZWFkZXJCdWZmZXIocmVhZGVyKSA6IGRhdGEhKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoZGlmZiA+IDEwMDApIHtcblx0XHRcdFx0XHRieXRlc1JlY2VpdmVkID0gMDtcblx0XHRcdFx0XHRieXRlc1Jlc2V0ID0gbm93O1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihvYmouY2xpZW50LCBlKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0c2VydmVyLnBhY2tldEhhbmRsZXIuY3JlYXRlUmVtb3RlKG9iai5jbGllbnQsIHNlbmQsIG9iaik7XG5cblx0XHRpZiAoc2VydmVyLmRlYnVnKSBsb2coJ2NsaWVudCBjb25uZWN0ZWQnKTtcblxuXHRcdHNlcnZlci5wYWNrZXRIYW5kbGVyLnNlbmRTdHJpbmcoc2VuZCwgJyp2ZXJzaW9uJywgTWVzc2FnZVR5cGUuVmVyc2lvbiwgW3NlcnZlci5oYXNoXSk7XG5cdFx0c2VydmVyLmNsaWVudHMucHVzaChvYmopO1xuXG5cdFx0aWYgKHNlcnZlckFjdGlvbnMuY29ubmVjdGVkKSB7XG5cdFx0XHRjYWxsV2l0aEVycm9ySGFuZGxpbmcoKCkgPT4gc2VydmVyQWN0aW9ucy5jb25uZWN0ZWQhKCksICgpID0+IHsgfSwgZSA9PiB7XG5cdFx0XHRcdGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihvYmouY2xpZW50LCBlKTtcblx0XHRcdFx0b2JqLmNsaWVudC5kaXNjb25uZWN0KGZhbHNlLCBmYWxzZSwgJ2Vycm9yIG9uIGNvbm5lY3RlZCgpJyk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRsZXQgY2xvc2VkID0gZmFsc2U7XG5cblx0dXdzU29ja2V0RXZlbnRzLm9uQ2xvc2UgPSAoY29kZSwgcmVhc29uKSA9PiB7XG5cdFx0aWYgKGNsb3NlZCkgcmV0dXJuO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNsb3NlZCA9IHRydWU7XG5cdFx0XHRpc0Nvbm5lY3RlZCA9IGZhbHNlO1xuXG5cdFx0XHQvLyByZW1vdmUgY2xpZW50XG5cdFx0XHRjb25zdCBpbmRleCA9IHNlcnZlci5jbGllbnRzLmluZGV4T2Yob2JqKTtcblx0XHRcdGlmIChpbmRleCAhPT0gLTEpIHtcblx0XHRcdFx0c2VydmVyLmNsaWVudHNbaW5kZXhdID0gc2VydmVyLmNsaWVudHNbc2VydmVyLmNsaWVudHMubGVuZ3RoIC0gMV07XG5cdFx0XHRcdHNlcnZlci5jbGllbnRzLnBvcCgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc2VydmVyLmRlYnVnKSBsb2coJ2NsaWVudCBkaXNjb25uZWN0ZWQnKTtcblxuXHRcdFx0aWYgKHNlcnZlckFjdGlvbnM/LmRpc2Nvbm5lY3RlZCkge1xuXHRcdFx0XHRjb25zdCByZWFkZXIgPSBjcmVhdGVCaW5hcnlSZWFkZXJGcm9tQnVmZmVyKHJlYXNvbiwgMCwgcmVhc29uLmJ5dGVMZW5ndGgpO1xuXHRcdFx0XHRjb25zdCBkZWNvZGVkUmVhc29uID0gcmVhZFN0cmluZyhyZWFkZXIpIHx8ICcnO1xuXHRcdFx0XHRjYWxsV2l0aEVycm9ySGFuZGxpbmcoKCkgPT4gc2VydmVyQWN0aW9ucyEuZGlzY29ubmVjdGVkIShjb2RlLCBjbG9zZVJlYXNvbiB8fCBkZWNvZGVkUmVhc29uKSwgKCkgPT4geyB9LFxuXHRcdFx0XHRcdGUgPT4gZXJyb3JIYW5kbGVyLmhhbmRsZUVycm9yKG9iai5jbGllbnQsIGUpKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG9iai50b2tlbikge1xuXHRcdFx0XHRvYmoudG9rZW4uZXhwaXJlID0gRGF0ZS5ub3coKSArIHNlcnZlci50b2tlbkxpZmV0aW1lO1xuXG5cdFx0XHRcdGlmIChzZXJ2ZXIuY2xpZW50c0J5VG9rZW4uZ2V0KG9iai50b2tlbi5pZCkgPT09IG9iaikge1xuXHRcdFx0XHRcdHNlcnZlci5jbGllbnRzQnlUb2tlbi5kZWxldGUob2JqLnRva2VuLmlkKTtcblx0XHRcdFx0XHRzZXJ2ZXIuZnJlZVRva2Vucy5zZXQob2JqLnRva2VuLmlkLCBvYmoudG9rZW4pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0ZXJyb3JIYW5kbGVyLmhhbmRsZUVycm9yKG9iai5jbGllbnQsIGUpO1xuXHRcdH1cblx0fTtcblxuXG5cdFByb21pc2UucmVzb2x2ZShzZXJ2ZXIuY3JlYXRlU2VydmVyKG9iai5jbGllbnQpKVxuXHRcdC50aGVuKGFjdGlvbnMgPT4ge1xuXHRcdFx0aWYgKGlzQ29ubmVjdGVkKSB7XG5cdFx0XHRcdHNlcnZlckFjdGlvbnMgPSBhY3Rpb25zO1xuXHRcdFx0XHRzZXJ2ZXJBY3Rpb25zQ3JlYXRlZChzZXJ2ZXJBY3Rpb25zKTtcblx0XHRcdH1cblx0XHR9KVxuXHRcdC5jYXRjaChlID0+IHtcblx0XHRcdHNvY2tldC50ZXJtaW5hdGUoKTtcblx0XHRcdGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihvYmouY2xpZW50LCBlKTtcblx0XHR9KTtcbn1cbiJdLCJzb3VyY2VSb290IjoiL2hvbWUvYWxwaGEvRGVza3RvcC9kZXYvdGMtc29ja2V0cy9zcmMifQ==
