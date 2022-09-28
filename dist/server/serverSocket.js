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
                close: function (force, code, shortMessage) {
                    if (force) {
                        ws.close();
                    }
                    else {
                        ws.end(code, shortMessage);
                    }
                },
                onClose: utils_1.noop,
                onMessage: utils_1.noop,
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
                events.close = utils_1.noop;
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
        connectedSockets.forEach(function (event) { return event.close(true); });
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
            socketEvents.close(true);
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
        uwsSocketEvents.close(true);
        return;
    }
    if (server.connectionTokens && !token) {
        errorHandler.handleError({ originalRequest: originalRequest }, new Error("Invalid token: ".concat(t)));
        uwsSocketEvents.close(true);
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
                    uwsSocketEvents.close(true);
                }
                else {
                    closeReason = reason;
                    uwsSocketEvents.close(false /* code?, reason*/);
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
        uwsSocketEvents.close(true);
        errorHandler.handleError(obj.client, e);
    });
}

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvc2VydmVyU29ja2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBQUEsbURBQXFGO0FBQ3JGLHlDQUE4RTtBQUU5RSx5REFBK0c7QUFJL0csNkNBR3VCO0FBQ3ZCLHVEQUEyRztBQUMzRyxpREFBc0o7QUFDdEosMkJBQTZCO0FBRTdCLFNBQWdCLFlBQVksQ0FDM0IsVUFBMkMsRUFDM0MsVUFBMkMsRUFDM0MsWUFBNEMsRUFDNUMsT0FBdUIsRUFDdkIsWUFBMkIsRUFDM0IsR0FBWTtJQUVaLE9BQU8sZUFBZSxDQUFDLFlBQWtDLEVBQUUsSUFBQSxpQ0FBbUIsRUFBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLE9BQU8sQ0FBQyxFQUFFLFlBQVksRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNySSxDQUFDO0FBVEQsb0NBU0M7QUFFRCxTQUFnQixlQUFlLENBQzlCLFlBQWdDLEVBQUUsT0FBc0IsRUFDeEQsWUFBMkIsRUFBRSxHQUFZO0lBRXpDLElBQU0sSUFBSSxHQUFHLGdCQUFnQixDQUFDO1FBQzdCLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTtRQUNsQixZQUFZLGNBQUE7UUFDWixHQUFHLEtBQUE7UUFDSCxJQUFJLEVBQUcsT0FBc0IsQ0FBQyxJQUFJO1FBQ2xDLEdBQUcsRUFBRyxPQUEyQixDQUFDLEdBQUc7UUFDckMsaUJBQWlCLEVBQUUsT0FBTyxDQUFDLGlCQUFpQjtRQUM1QyxXQUFXLEVBQUUsT0FBTyxDQUFDLFdBQVc7S0FDaEMsQ0FBQyxDQUFDO0lBQ0gsSUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLGFBQUksRUFBRSxFQUFFLFFBQVEsSUFBSyxPQUFPLEVBQUcsQ0FBQztJQUMxRSxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDMUIsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBaEJELDBDQWdCQztBQUVELFNBQWdCLGdCQUFnQixDQUFD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QyxNQUFNLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7aUJBQy9DO2FBQ0Q7U0FDRDtRQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1gsWUFBWSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1NBQ3hDO0lBQ0YsQ0FBQyxDQUFDO0lBR0YsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUM5QyxJQUFJLENBQUMsVUFBQSxPQUFPO1FBQ1osSUFBSSxXQUFXLEVBQUU7WUFDaEIsYUFBYSxHQUFHLE9BQU8sQ0FBQztZQUN4QixvQkFBb0IsQ0FBQyxhQUFhLENBQUMsQ0FBQztTQUNwQztJQUNGLENBQUMsQ0FBQztTQUNELEtBQUssQ0FBQyxVQUFBLENBQUM7UUFDUCxlQUFlLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzVCLFlBQVksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN6QyxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMiLCJmaWxlIjoic2VydmVyL3NlcnZlclNvY2tldC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENsaWVudE9wdGlvbnMsIGdldE5hbWVzLCBTb2NrZXRTZXJ2ZXIsIExvZ2dlciB9IGZyb20gJy4uL2NvbW1vbi9pbnRlcmZhY2VzJztcbmltcG9ydCB7IGdldExlbmd0aCwgY2xvbmVEZWVwLCBjaGVja1JhdGVMaW1pdDIsIG5vb3AgfSBmcm9tICcuLi9jb21tb24vdXRpbHMnO1xuaW1wb3J0IHsgRXJyb3JIYW5kbGVyLCBPcmlnaW5hbFJlcXVlc3QgfSBmcm9tICcuL3NlcnZlcic7XG5pbXBvcnQgeyBNZXNzYWdlVHlwZSwgU2VuZCwgY3JlYXRlUGFja2V0SGFuZGxlciwgSGFuZGxlUmVzdWx0LCBIYW5kbGVyT3B0aW9ucyB9IGZyb20gJy4uL3BhY2tldC9wYWNrZXRIYW5kbGVyJztcbmltcG9ydCB7XG5cdFNlcnZlciwgQ2xpZW50U3RhdGUsIEludGVybmFsU2VydmVyLCBHbG9iYWxDb25maWcsIFNlcnZlckhvc3QsIENyZWF0ZVNlcnZlck1ldGhvZCwgQ3JlYXRlU2VydmVyLCBTZXJ2ZXJPcHRpb25zLCBVV1NTb2NrZXRFdmVudHMsIFNlcnZlckFwcE9wdGlvbiwgUG9ydE9wdGlvblxufSBmcm9tICcuL3NlcnZlckludGVyZmFjZXMnO1xuaW1wb3J0IHtcblx0aGFzVG9rZW4sIGNyZWF0ZVRva2VuLCBnZXRUb2tlbiwgZ2V0VG9rZW5Gcm9tQ2xpZW50LCByZXR1cm5UcnVlLCBjcmVhdGVPcmlnaW5hbFJlcXVlc3QsIGRlZmF1bHRFcnJvckhhbmRsZXIsXG5cdGNyZWF0ZVNlcnZlck9wdGlvbnMsIG9wdGlvbnNXaXRoRGVmYXVsdHMsIHRvQ2xpZW50T3B0aW9ucywgZ2V0UXVlcnksIGNhbGxXaXRoRXJyb3JIYW5kbGluZywgcGFyc2VSYXRlTGltaXREZWYsIGdldEZ1bGxVcmwsXG59IGZyb20gJy4vc2VydmVyVXRpbHMnO1xuaW1wb3J0IHsgQmluYXJ5UmVhZGVyLCBjcmVhdGVCaW5hcnlSZWFkZXJGcm9tQnVmZmVyLCBnZXRCaW5hcnlSZWFkZXJCdWZmZXIgfSBmcm9tICcuLi9wYWNrZXQvYmluYXJ5UmVhZGVyJztcbmltcG9ydCB7IEFwcCwgRElTQUJMRUQsIEh0dHBSZXF1ZXN0LCBSZWNvZ25pemVkU3RyaW5nLCBTSEFSRURfQ09NUFJFU1NPUiwgdXNfbGlzdGVuX3NvY2tldCwgdXNfbGlzdGVuX3NvY2tldF9jbG9zZSwgV2ViU29ja2V0IH0gZnJvbSAndVdlYlNvY2tldHMuanMnO1xuaW1wb3J0ICogYXMgSFRUUCBmcm9tICdodHRwJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNlcnZlcjxUU2VydmVyLCBUQ2xpZW50Pihcblx0c2VydmVyVHlwZTogbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gVFNlcnZlcixcblx0Y2xpZW50VHlwZTogbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gVENsaWVudCxcblx0Y3JlYXRlU2VydmVyOiBDcmVhdGVTZXJ2ZXI8VFNlcnZlciwgVENsaWVudD4sXG5cdG9wdGlvbnM/OiBTZXJ2ZXJPcHRpb25zLFxuXHRlcnJvckhhbmRsZXI/OiBFcnJvckhhbmRsZXIsXG5cdGxvZz86IExvZ2dlclxuKSB7XG5cdHJldHVybiBjcmVhdGVTZXJ2ZXJSYXcoY3JlYXRlU2VydmVyIGFzIENyZWF0ZVNlcnZlck1ldGhvZCwgY3JlYXRlU2VydmVyT3B0aW9ucyhzZXJ2ZXJUeXBlLCBjbGllbnRUeXBlLCBvcHRpb25zKSwgZXJyb3JIYW5kbGVyLCBsb2cpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2VydmVyUmF3KFxuXHRjcmVhdGVTZXJ2ZXI6IENyZWF0ZVNlcnZlck1ldGhvZCwgb3B0aW9uczogU2VydmVyT3B0aW9ucyxcblx0ZXJyb3JIYW5kbGVyPzogRXJyb3JIYW5kbGVyLCBsb2c/OiBMb2dnZXJcbik6IFNlcnZlciB7XG5cdGNvbnN0IGhvc3QgPSBjcmVhdGVTZXJ2ZXJIb3N0KHtcblx0XHRwYXRoOiBvcHRpb25zLnBhdGgsXG5cdFx0ZXJyb3JIYW5kbGVyLFxuXHRcdGxvZyxcblx0XHRwb3J0OiAob3B0aW9ucyBhcyBQb3J0T3B0aW9uKS5wb3J0LFxuXHRcdGFwcDogKG9wdGlvbnMgYXMgU2VydmVyQXBwT3B0aW9uKS5hcHAsXG5cdFx0cGVyTWVzc2FnZURlZmxhdGU6IG9wdGlvbnMucGVyTWVzc2FnZURlZmxhdGUsXG5cdFx0Y29tcHJlc3Npb246IG9wdGlvbnMuY29tcHJlc3Npb24sXG5cdH0pO1xuXHRjb25zdCBzb2NrZXQgPSBob3N0LnNvY2tldFJhdyhjcmVhdGVTZXJ2ZXIsIHsgaWQ6ICdzb2NrZXQnLCAuLi5vcHRpb25zIH0pO1xuXHRzb2NrZXQuY2xvc2UgPSBob3N0LmNsb3NlO1xuXHRyZXR1cm4gc29ja2V0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlU2VydmVySG9zdChnbG9iYWxDb25maWc6IEdsb2JhbENvbmZpZyk6IFNlcnZlckhvc3Qge1xuXHRpZighKGdsb2JhbENvbmZpZyBhcyBTZXJ2ZXJBcHBPcHRpb24pLmFwcCAmJiAhKGdsb2JhbENvbmZpZyBhcyBQb3J0T3B0aW9uKS5wb3J0KSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdQb3J0IG9yIHVXZWJTb2NrZXRzLmpzIGFwcCBub3QgcHJvdmlkZWQnKTtcblx0fVxuXHRpZigoZ2xvYmFsQ29uZmlnIGFzIFNlcnZlckFwcE9wdGlvbikuYXBwICYmIChnbG9iYWxDb25maWcgYXMgUG9ydE9wdGlvbikucG9ydCkge1xuXHRcdHRocm93IG5ldyBFcnJvcignUHJvdmlkZSBwb3J0IG9yIHVXZWJTb2NrZXRzLmpzIGFwcCBidXQgbm90IGJvdGgnKTtcblx0fVxuXHRjb25zdCB1d3NBcHAgPSAoZ2xvYmFsQ29uZmlnIGFzIFNlcnZlckFwcE9wdGlvbikuYXBwIHx8IEFwcCgpO1xuXHRjb25zdCB7XG5cdFx0cGF0aCA9ICcvd3MnLFxuXHRcdGxvZyA9IGNvbnNvbGUubG9nLmJpbmQoY29uc29sZSksXG5cdFx0ZXJyb3JIYW5kbGVyID0gZGVmYXVsdEVycm9ySGFuZGxlcixcblx0XHRwZXJNZXNzYWdlRGVmbGF0ZSA9IHRydWUsXG5cdFx0ZXJyb3JDb2RlID0gNDAwLFxuXHRcdGVycm9yTmFtZSA9IEhUVFAuU1RBVFVTX0NPREVTWzQwMF0gYXMgc3RyaW5nLFxuXHRcdG5hdGl2ZVBpbmcgPSAwLFxuXHR9ID0gZ2xvYmFsQ29uZmlnO1xuXHRjb25zdCBzZXJ2ZXJzOiBJbnRlcm5hbFNlcnZlcltdID0gW107XG5cblx0bGV0IHVwZ3JhZGVSZXE6IE9yaWdpbmFsUmVxdWVzdCB8IHVuZGVmaW5lZDtcblx0bGV0IGNvbm5lY3RlZFNvY2tldHMgPSBuZXcgTWFwPFdlYlNvY2tldCwgVVdTU29ja2V0RXZlbnRzPigpO1xuXHR1d3NBcHAud3MocGF0aCwge1xuXHRcdGNvbXByZXNzaW9uOiBnbG9iYWxDb25maWcuY29tcHJlc3Npb24gPyBnbG9iYWxDb25maWcuY29tcHJlc3Npb24gOiAocGVyTWVzc2FnZURlZmxhdGUgPyBTSEFSRURfQ09NUFJFU1NPUiA6IERJU0FCTEVEKSxcblx0XHRzZW5kUGluZ3NBdXRvbWF0aWNhbGx5OiAhIW5hdGl2ZVBpbmcsXG5cdFx0aWRsZVRpbWVvdXQ6IG5hdGl2ZVBpbmcgPyBuYXRpdmVQaW5nIDogdW5kZWZpbmVkLFxuXG5cdFx0dXBncmFkZTogKHJlcywgcmVxLCBjb250ZXh0KSA9PiB7XG5cdFx0XHRpZiAodXBncmFkZVJlcSkge1xuXHRcdFx0XHRyZXMuZW5kKGBIVFRQLzEuMSAkezUwM30gJHtIVFRQLlNUQVRVU19DT0RFU1s1MDNdfVxcclxcblxcclxcbmApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRsZXQgYWJvcnRlZCA9IGZhbHNlO1xuXHRcdFx0cmVzLm9uQWJvcnRlZCgoKSA9PiB7XG5cdFx0XHRcdGFib3J0ZWQgPSB0cnVlO1xuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCB1cmwgPSByZXEuZ2V0VXJsKCk7XG5cdFx0XHRjb25zdCBzZWNXZWJTb2NrZXRLZXkgPSByZXEuZ2V0SGVhZGVyKCdzZWMtd2Vic29ja2V0LWtleScpO1xuXHRcdFx0Y29uc3Qgc2VjV2ViU29ja2V0UHJvdG9jb2wgPSByZXEuZ2V0SGVhZGVyKCdzZWMtd2Vic29ja2V0LXByb3RvY29sJyk7XG5cdFx0XHRjb25zdCBzZWNXZWJTb2NrZXRFeHRlbnNpb25zID0gcmVxLmdldEhlYWRlcignc2VjLXdlYnNvY2tldC1leHRlbnNpb25zJyk7XG5cblx0XHRcdGlmIChnbG9iYWxDb25maWcucGF0aCAmJiBnbG9iYWxDb25maWcucGF0aCAhPT0gdXJsLnNwbGl0KCc/JylbMF0uc3BsaXQoJyMnKVswXSkge1xuXHRcdFx0XHRyZXMuZW5kKGBIVFRQLzEuMSAkezQwMH0gJHtIVFRQLlNUQVRVU19DT0RFU1s0MDBdfVxcclxcblxcclxcbmApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG9yaWdpbmFsUmVxdWVzdCA9IGNyZWF0ZU9yaWdpbmFsUmVxdWVzdChyZXEpO1xuXHRcdFx0dmVyaWZ5Q2xpZW50KHJlcSwgKHJlc3VsdCwgY29kZSwgbmFtZSkgPT4ge1xuXHRcdFx0XHRpZiAoYWJvcnRlZCkgcmV0dXJuO1xuXHRcdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdFx0dXBncmFkZVJlcSA9IG9yaWdpbmFsUmVxdWVzdDtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0cmVzLnVwZ3JhZGUoe3VybH0sXG5cdFx0XHRcdFx0XHRcdHNlY1dlYlNvY2tldEtleSxcblx0XHRcdFx0XHRcdFx0c2VjV2ViU29ja2V0UHJvdG9jb2wsXG5cdFx0XHRcdFx0XHRcdHNlY1dlYlNvY2tldEV4dGVuc2lvbnMsXG5cdFx0XHRcdFx0XHRcdGNvbnRleHQpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmVycm9yKGVycm9yKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVzLmVuZChgSFRUUC8xLjEgJHtjb2RlfSAke25hbWV9XFxyXFxuXFxyXFxuYCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0sXG5cdFx0b3BlbjogKHdzKSA9PiB7XG5cdFx0XHRpZiAoIXVwZ3JhZGVSZXEpIHtcblx0XHRcdFx0d3MuY2xvc2UoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgdXdzU29ja2V0RXZlbnRzOiBVV1NTb2NrZXRFdmVudHMgPSB7XG5cdFx0XHRcdHNvY2tldDogd3MsXG5cdFx0XHRcdGNsb3NlOiAoZm9yY2U6IGJvb2xlYW4sIGNvZGU/OiBudW1iZXIgfCB1bmRlZmluZWQsIHNob3J0TWVzc2FnZT86IFJlY29nbml6ZWRTdHJpbmcgfCB1bmRlZmluZWQpID0+IHtcblx0XHRcdFx0XHRpZiAoZm9yY2UpIHtcblx0XHRcdFx0XHRcdHdzLmNsb3NlKCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHdzLmVuZChjb2RlLCBzaG9ydE1lc3NhZ2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0b25DbG9zZTogbm9vcCxcblx0XHRcdFx0b25NZXNzYWdlOiBub29wLFxuXHRcdFx0fTtcblx0XHRcdGNvbm5lY3RTb2NrZXQodXBncmFkZVJlcSwgdXdzU29ja2V0RXZlbnRzKTtcblxuXHRcdFx0Y29ubmVjdGVkU29ja2V0cy5zZXQod3MsIHV3c1NvY2tldEV2ZW50cyk7XG5cdFx0XHR1cGdyYWRlUmVxID0gdW5kZWZpbmVkO1xuXHRcdH0sXG5cdFx0bWVzc2FnZSh3cywgbWVzc2FnZSwgaXNCaW5hcnkpIHtcblx0XHRcdGNvbm5lY3RlZFNvY2tldHMuZ2V0KHdzKSEub25NZXNzYWdlKG1lc3NhZ2UsIGlzQmluYXJ5KTtcblx0XHR9LFxuXHRcdGNsb3NlKHdzLCBjb2RlLCBtZXNzYWdlKSB7XG5cdFx0XHRjb25zdCBldmVudHMgPSBjb25uZWN0ZWRTb2NrZXRzLmdldCh3cykhO1xuXHRcdFx0aWYgKGV2ZW50cykge1xuXHRcdFx0XHRldmVudHMuY2xvc2UgPSBub29wO1xuXHRcdFx0XHRldmVudHMub25DbG9zZShjb2RlLCBtZXNzYWdlKTtcblx0XHRcdFx0Y29ubmVjdGVkU29ja2V0cy5kZWxldGUod3MpO1xuXHRcdFx0fVxuXHRcdH0sXG5cdH0pO1xuXG5cdGxldCBzb2NrZXRUb2tlbjogdXNfbGlzdGVuX3NvY2tldCB8IHVuZGVmaW5lZDtcblx0aWYgKChnbG9iYWxDb25maWcgYXMgUG9ydE9wdGlvbikucG9ydCkge1xuXHRcdGNvbnN0IHBvcnQgPSAoZ2xvYmFsQ29uZmlnIGFzIFBvcnRPcHRpb24pLnBvcnQ7XG5cdFx0dXdzQXBwLmxpc3Rlbihwb3J0LCB0b2tlbiA9PiB7XG5cdFx0XHRpZiAodG9rZW4pIHtcblx0XHRcdFx0c29ja2V0VG9rZW4gPSB0b2tlbjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihudWxsLCBuZXcgRXJyb3IoYEZhaWxlZCB0byBsaXN0ZW4gdG8gcG9ydCAke3BvcnR9YCkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0U2VydmVyKGlkOiBhbnkpIHtcblx0XHRpZiAoc2VydmVycy5sZW5ndGggPT09IDEpIHJldHVybiBzZXJ2ZXJzWzBdO1xuXG5cdFx0Zm9yIChjb25zdCBzZXJ2ZXIgb2Ygc2VydmVycykge1xuXHRcdFx0aWYgKHNlcnZlci5pZCA9PT0gaWQpIHJldHVybiBzZXJ2ZXI7XG5cdFx0fVxuXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBObyBzZXJ2ZXIgZm9yIGdpdmVuIGlkICgke2lkfSlgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHZlcmlmeUNsaWVudChyZXE6IEh0dHBSZXF1ZXN0LCBuZXh0OiAocmVzdWx0OiBhbnksIGNvZGU6IG51bWJlciwgbmFtZTogc3RyaW5nKSA9PiB2b2lkKSB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHF1ZXJ5ID0gZ2V0UXVlcnkoZ2V0RnVsbFVybChyZXEpKTtcblx0XHRcdGNvbnN0IHNlcnZlciA9IGdldFNlcnZlcihxdWVyeS5pZCk7XG5cblx0XHRcdGlmICghc2VydmVyLnZlcmlmeUNsaWVudChyZXEpKSB7XG5cdFx0XHRcdG5leHQoZmFsc2UsIGVycm9yQ29kZSwgZXJyb3JOYW1lKTtcblx0XHRcdH0gZWxzZSBpZiAoc2VydmVyLmNsaWVudExpbWl0ICE9PSAwICYmIHNlcnZlci5jbGllbnRMaW1pdCA8PSBzZXJ2ZXIuY2xpZW50cy5sZW5ndGgpIHtcblx0XHRcdFx0bmV4dChmYWxzZSwgZXJyb3JDb2RlLCBlcnJvck5hbWUpO1xuXHRcdFx0fSBlbHNlIGlmIChzZXJ2ZXIuY29ubmVjdGlvblRva2Vucykge1xuXHRcdFx0XHRpZiAoaGFzVG9rZW4oc2VydmVyLCBxdWVyeS50KSkge1xuXHRcdFx0XHRcdG5leHQodHJ1ZSwgMjAwLCAnT0snKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRuZXh0KGZhbHNlLCBlcnJvckNvZGUsIGVycm9yTmFtZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG5leHQodHJ1ZSwgMjAwLCAnT0snKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3IobnVsbCwgZSk7XG5cdFx0XHRuZXh0KGZhbHNlLCBlcnJvckNvZGUsIGVycm9yTmFtZSk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gY2xvc2UoKSB7XG5cdFx0c2VydmVycy5mb3JFYWNoKGNsb3NlU2VydmVyKTtcblx0XHRjb25uZWN0ZWRTb2NrZXRzLmZvckVhY2goKGV2ZW50KSA9PiBldmVudC5jbG9zZSh0cnVlKSk7XG5cdFx0aWYgKHNvY2tldFRva2VuKSB7XG5cdFx0XHR1c19saXN0ZW5fc29ja2V0X2Nsb3NlKHNvY2tldFRva2VuKTtcblx0XHRcdHNvY2tldFRva2VuID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGNsb3NlQW5kUmVtb3ZlU2VydmVyKHNlcnZlcjogSW50ZXJuYWxTZXJ2ZXIpIHtcblx0XHRjbG9zZVNlcnZlcihzZXJ2ZXIpO1xuXHRcdGNvbnN0IGluZGV4ID0gc2VydmVycy5pbmRleE9mKHNlcnZlcik7XG5cdFx0aWYgKGluZGV4ICE9PSAtMSkgc2VydmVycy5zcGxpY2UoaW5kZXgsIDEpO1xuXHR9XG5cblx0ZnVuY3Rpb24gc29ja2V0PFRTZXJ2ZXIsIFRDbGllbnQ+KFxuXHRcdHNlcnZlclR5cGU6IG5ldyAoLi4uYXJnczogYW55W10pID0+IFRTZXJ2ZXIsXG5cdFx0Y2xpZW50VHlwZTogbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gVENsaWVudCxcblx0XHRjcmVhdGVTZXJ2ZXI6IENyZWF0ZVNlcnZlcjxUU2VydmVyLCBUQ2xpZW50Pixcblx0XHRiYXNlT3B0aW9ucz86IFNlcnZlck9wdGlvbnNcblx0KTogU2VydmVyIHtcblx0XHRjb25zdCBvcHRpb25zID0gY3JlYXRlU2VydmVyT3B0aW9ucyhzZXJ2ZXJUeXBlLCBjbGllbnRUeXBlLCBiYXNlT3B0aW9ucyk7XG5cdFx0cmV0dXJuIHNvY2tldFJhdyhjcmVhdGVTZXJ2ZXIgYXMgQ3JlYXRlU2VydmVyTWV0aG9kLCBvcHRpb25zKTtcblx0fVxuXG5cdGZ1bmN0aW9uIHNvY2tldFJhdyhjcmVhdGVTZXJ2ZXI6IENyZWF0ZVNlcnZlck1ldGhvZCwgb3B0aW9uczogU2VydmVyT3B0aW9ucyk6IFNlcnZlciB7XG5cdFx0Y29uc3QgaW50ZXJuYWxTZXJ2ZXIgPSBjcmVhdGVJbnRlcm5hbFNlcnZlcihjcmVhdGVTZXJ2ZXIsIHsgLi4ub3B0aW9ucywgcGF0aCB9LCBlcnJvckhhbmRsZXIsIGxvZyk7XG5cblx0XHRpZiAoc2VydmVycy5zb21lKHMgPT4gcy5pZCA9PT0gaW50ZXJuYWxTZXJ2ZXIuaWQpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBvcGVuIHR3byBzb2NrZXRzIHdpdGggdGhlIHNhbWUgaWQnKTtcblx0XHR9XG5cblx0XHRzZXJ2ZXJzLnB1c2goaW50ZXJuYWxTZXJ2ZXIpO1xuXHRcdGludGVybmFsU2VydmVyLnNlcnZlci5jbG9zZSA9ICgpID0+IGNsb3NlQW5kUmVtb3ZlU2VydmVyKGludGVybmFsU2VydmVyKTtcblx0XHRyZXR1cm4gaW50ZXJuYWxTZXJ2ZXIuc2VydmVyO1xuXHR9XG5cblx0ZnVuY3Rpb24gY29ubmVjdFNvY2tldChvcmlnaW5hbFJlcXVlc3Q6IE9yaWdpbmFsUmVxdWVzdCwgc29ja2V0RXZlbnRzOiBVV1NTb2NrZXRFdmVudHMpIHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcXVlcnkgPSBnZXRRdWVyeShvcmlnaW5hbFJlcXVlc3QudXJsKTtcblx0XHRcdGNvbnN0IHNlcnZlciA9IGdldFNlcnZlcihxdWVyeS5pZCk7XG5cblx0XHRcdGNvbm5lY3RDbGllbnQoc2VydmVyLCBvcmlnaW5hbFJlcXVlc3QsIGVycm9ySGFuZGxlciwgbG9nLCBzb2NrZXRFdmVudHMpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHNvY2tldEV2ZW50cy5jbG9zZSh0cnVlKTtcblx0XHRcdGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihudWxsLCBlKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4geyBjbG9zZSwgc29ja2V0LCBzb2NrZXRSYXcsIGFwcDogdXdzQXBwIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUludGVybmFsU2VydmVyKFxuXHRjcmVhdGVTZXJ2ZXI6IENyZWF0ZVNlcnZlck1ldGhvZCwgb3B0aW9uczogU2VydmVyT3B0aW9ucywgZXJyb3JIYW5kbGVyOiBFcnJvckhhbmRsZXIsIGxvZzogTG9nZ2VyLFxuKTogSW50ZXJuYWxTZXJ2ZXIge1xuXHRvcHRpb25zID0gb3B0aW9uc1dpdGhEZWZhdWx0cyhvcHRpb25zKTtcblxuXHRjb25zdCBvblNlbmQgPSBvcHRpb25zLm9uU2VuZDtcblx0Y29uc3QgaGFuZGxlck9wdGlvbnM6IEhhbmRsZXJPcHRpb25zID0ge1xuXHRcdGRlYnVnOiBvcHRpb25zLmRlYnVnLFxuXHRcdGRldmVsb3BtZW50OiBvcHRpb25zLmRldmVsb3BtZW50LFxuXHRcdGZvcmNlQmluYXJ5OiBvcHRpb25zLmZvcmNlQmluYXJ5LFxuXHRcdGZvcmNlQmluYXJ5UGFja2V0czogb3B0aW9ucy5mb3JjZUJpbmFyeVBhY2tldHMsXG5cdFx0b25TZW5kLFxuXHRcdG9uUmVjdjogb3B0aW9ucy5vblJlY3YsXG5cdFx0dXNlQnVmZmVyOiB0cnVlLFxuXHR9O1xuXG5cdGNvbnN0IHBhY2tldEhhbmRsZXIgPSBjcmVhdGVQYWNrZXRIYW5kbGVyKG9wdGlvbnMuc2VydmVyLCBvcHRpb25zLmNsaWVudCwgaGFuZGxlck9wdGlvbnMsIGxvZyk7XG5cdGNvbnN0IGNsaWVudE9wdGlvbnMgPSB0b0NsaWVudE9wdGlvbnMob3B0aW9ucyk7XG5cdGNvbnN0IGNsaWVudE1ldGhvZHMgPSBnZXROYW1lcyhvcHRpb25zLmNsaWVudCEpO1xuXHRjb25zdCBzZXJ2ZXI6IEludGVybmFsU2VydmVyID0ge1xuXHRcdGlkOiBvcHRpb25zLmlkID8/ICdzb2NrZXQnLFxuXHRcdGNsaWVudHM6IFtdLFxuXHRcdGZyZWVUb2tlbnM6IG5ldyBNYXAoKSxcblx0XHRjbGllbnRzQnlUb2tlbjogbmV3IE1hcCgpLFxuXHRcdHRvdGFsU2VudDogMCxcblx0XHR0b3RhbFJlY2VpdmVkOiAwLFxuXHRcdGN1cnJlbnRDbGllbnRJZDogb3B0aW9ucy5jbGllbnRCYXNlSWQgPz8gMSxcblx0XHRwYXRoOiBvcHRpb25zLnBhdGggPz8gJycsXG5cdFx0aGFzaDogb3B0aW9ucy5oYXNoID8/ICcnLFxuXHRcdGRlYnVnOiAhIW9wdGlvbnMuZGVidWcsXG5cdFx0Zm9yY2VCaW5hcnk6ICEhb3B0aW9ucy5mb3JjZUJpbmFyeSxcblx0XHRjb25uZWN0aW9uVG9rZW5zOiAhIW9wdGlvbnMuY29ubmVjdGlvblRva2Vucyxcblx0XHRrZWVwT3JpZ2luYWxSZXF1ZXN0OiAhIW9wdGlvbnMua2VlcE9yaWdpbmFsUmVxdWVzdCxcblx0XHRlcnJvcklmTm90Q29ubmVjdGVkOiAhIW9wdGlvbnMuZXJyb3JJZk5vdENvbm5lY3RlZCxcblx0XHR0b2tlbkxpZmV0aW1lOiBvcHRpb25zLnRva2VuTGlmZXRpbWUgPz8gMCxcblx0XHRjbGllbnRMaW1pdDogb3B0aW9ucy5jbGllbnRMaW1pdCA/PyAwLFxuXHRcdHRyYW5zZmVyTGltaXQ6IG9wdGlvbnMudHJhbnNmZXJMaW1pdCA/PyAwLFxuXHRcdGJhY2twcmVzc3VyZUxpbWl0OiBvcHRpb25zLmJhY2twcmVzc3VyZUxpbWl0ID8/IDEwMjQsXG5cdFx0dmVyaWZ5Q2xpZW50OiBvcHRpb25zLnZlcmlmeUNsaWVudCA/PyByZXR1cm5UcnVlLFxuXHRcdGNyZWF0ZUNsaWVudDogb3B0aW9ucy5jcmVhdGVDbGllbnQsXG5cdFx0c2VydmVyTWV0aG9kczogb3B0aW9ucy5zZXJ2ZXIhLFxuXHRcdGNsaWVudE1ldGhvZHMsXG5cdFx0cmF0ZUxpbWl0czogb3B0aW9ucy5zZXJ2ZXIhLm1hcChwYXJzZVJhdGVMaW1pdERlZiksXG5cdFx0aGFuZGxlUmVzdWx0LFxuXHRcdGNyZWF0ZVNlcnZlcixcblx0XHRwYWNrZXRIYW5kbGVyLFxuXHRcdHNlcnZlcjoge30gYXMgYW55LFxuXHRcdHBpbmdJbnRlcnZhbDogdW5kZWZpbmVkLFxuXHRcdHRva2VuSW50ZXJ2YWw6IHVuZGVmaW5lZCxcblx0fTtcblxuXHRmdW5jdGlvbiBoYW5kbGVSZXN1bHQoc2VuZDogU2VuZCwgb2JqOiBDbGllbnRTdGF0ZSwgZnVuY0lkOiBudW1iZXIsIGZ1bmNOYW1lOiBzdHJpbmcsIHJlc3VsdDogUHJvbWlzZTxhbnk+LCBtZXNzYWdlSWQ6IG51bWJlcikge1xuXHRcdGlmIChyZXN1bHQgJiYgdHlwZW9mIHJlc3VsdC50aGVuID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRyZXN1bHQudGhlbihyZXN1bHQgPT4ge1xuXHRcdFx0XHRpZiAob2JqLmNsaWVudC5pc0Nvbm5lY3RlZCgpKSB7XG5cdFx0XHRcdFx0cGFja2V0SGFuZGxlci5zZW5kU3RyaW5nKHNlbmQsIGAqcmVzb2x2ZToke2Z1bmNOYW1lfWAsIE1lc3NhZ2VUeXBlLlJlc29sdmVkLCBbZnVuY0lkLCBtZXNzYWdlSWQsIHJlc3VsdF0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCAoZTogRXJyb3IpID0+IHtcblx0XHRcdFx0ZSA9IGVycm9ySGFuZGxlci5oYW5kbGVSZWplY3Rpb24ob2JqLmNsaWVudCwgZSkgfHwgZTtcblx0XHRcdFx0aWYgKG9iai5jbGllbnQuaXNDb25uZWN0ZWQoKSkge1xuXHRcdFx0XHRcdHBhY2tldEhhbmRsZXIuc2VuZFN0cmluZyhzZW5kLCBgKnJlamVjdDoke2Z1bmNOYW1lfWAsIE1lc3NhZ2VUeXBlLlJlamVjdGVkLCBbZnVuY0lkLCBtZXNzYWdlSWQsIGUgPyBlLm1lc3NhZ2UgOiAnZXJyb3InXSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pLmNhdGNoKChlOiBFcnJvcikgPT4gZXJyb3JIYW5kbGVyLmhhbmRsZUVycm9yKG9iai5jbGllbnQsIGUpKTtcblx0XHR9XG5cdH1cblxuXHRjb25zdCBwaW5nSW50ZXJ2YWwgPSBvcHRpb25zLnBpbmdJbnRlcnZhbDtcblxuXHRpZiAocGluZ0ludGVydmFsKSB7XG5cdFx0c2VydmVyLnBpbmdJbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcblx0XHRcdGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cdFx0XHRjb25zdCB0aHJlc2hvbGQgPSBub3cgLSBwaW5nSW50ZXJ2YWw7XG5cdFx0XHRjb25zdCB0aW1lb3V0VGhyZXNob2xkID0gbm93IC0gb3B0aW9ucy5jb25uZWN0aW9uVGltZW91dCE7XG5cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc2VydmVyLmNsaWVudHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgYyA9IHNlcnZlci5jbGllbnRzW2ldO1xuXG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0aWYgKGMubGFzdE1lc3NhZ2VUaW1lIDwgdGltZW91dFRocmVzaG9sZCkge1xuXHRcdFx0XHRcdFx0Yy5jbGllbnQuZGlzY29ubmVjdCh0cnVlLCBmYWxzZSwgJ3RpbWVvdXQnKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKGMubGFzdFNlbmRUaW1lIDwgdGhyZXNob2xkKSB7XG5cdFx0XHRcdFx0XHRjLnBpbmcoKTtcblx0XHRcdFx0XHRcdGlmIChvblNlbmQpIG9uU2VuZCgtMSwgJ1BJTkcnLCAwLCBmYWxzZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIHsgfVxuXHRcdFx0fVxuXHRcdH0sIHBpbmdJbnRlcnZhbCk7XG5cdH1cblxuXHRpZiAob3B0aW9ucy5jb25uZWN0aW9uVG9rZW5zKSB7XG5cdFx0c2VydmVyLnRva2VuSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHRjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXHRcdFx0Y29uc3QgaWRzOiBzdHJpbmdbXSA9IFtdO1xuXG5cdFx0XHRzZXJ2ZXIuZnJlZVRva2Vucy5mb3JFYWNoKHRva2VuID0+IHtcblx0XHRcdFx0aWYgKHRva2VuLmV4cGlyZSA8IG5vdykge1xuXHRcdFx0XHRcdGlkcy5wdXNoKHRva2VuLmlkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGZvciAoY29uc3QgaWQgb2YgaWRzKSB7XG5cdFx0XHRcdHNlcnZlci5mcmVlVG9rZW5zLmRlbGV0ZShpZCk7XG5cdFx0XHR9XG5cdFx0fSwgMTAwMDApO1xuXHR9XG5cblx0c2VydmVyLnNlcnZlciA9IHtcblx0XHRnZXQgY2xpZW50cygpIHtcblx0XHRcdHJldHVybiBzZXJ2ZXIuY2xpZW50cztcblx0XHR9LFxuXHRcdGNsb3NlKCkge1xuXHRcdFx0Y2xvc2VTZXJ2ZXIoc2VydmVyKTtcblx0XHR9LFxuXHRcdG9wdGlvbnMoKTogQ2xpZW50T3B0aW9ucyB7XG5cdFx0XHRyZXR1cm4gY2xvbmVEZWVwKGNsaWVudE9wdGlvbnMpO1xuXHRcdH0sXG5cdFx0dG9rZW4oZGF0YT86IGFueSkge1xuXHRcdFx0cmV0dXJuIGNyZWF0ZVRva2VuKHNlcnZlciwgZGF0YSkuaWQ7XG5cdFx0fSxcblx0XHRjbGVhclRva2VuKGlkOiBzdHJpbmcpIHtcblx0XHRcdHNlcnZlci5mcmVlVG9rZW5zLmRlbGV0ZShpZCk7XG5cdFx0XHRzZXJ2ZXIuY2xpZW50c0J5VG9rZW4uZ2V0KGlkKT8uY2xpZW50LmRpc2Nvbm5lY3QodHJ1ZSwgdHJ1ZSwgJ2NsZWFyIHRva2VucycpO1xuXHRcdH0sXG5cdFx0Y2xlYXJUb2tlbnModGVzdDogKGlkOiBzdHJpbmcsIGRhdGE/OiBhbnkpID0+IGJvb2xlYW4pIHtcblx0XHRcdGNvbnN0IGlkczogc3RyaW5nW10gPSBbXTtcblxuXHRcdFx0c2VydmVyLmZyZWVUb2tlbnMuZm9yRWFjaCh0b2tlbiA9PiB7XG5cdFx0XHRcdGlmICh0ZXN0KHRva2VuLmlkLCB0b2tlbi5kYXRhKSkge1xuXHRcdFx0XHRcdGlkcy5wdXNoKHRva2VuLmlkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdHNlcnZlci5jbGllbnRzQnlUb2tlbi5mb3JFYWNoKCh7IHRva2VuIH0pID0+IHtcblx0XHRcdFx0aWYgKHRva2VuICYmIHRlc3QodG9rZW4uaWQsIHRva2VuLmRhdGEpKSB7XG5cdFx0XHRcdFx0aWRzLnB1c2godG9rZW4uaWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Zm9yIChjb25zdCBpZCBvZiBpZHMpIHtcblx0XHRcdFx0dGhpcy5jbGVhclRva2VuKGlkKTtcblx0XHRcdH1cblx0XHR9LFxuXHRcdGluZm8oKSB7XG5cdFx0XHRjb25zdCB3cml0ZXJCdWZmZXJTaXplID0gcGFja2V0SGFuZGxlci53cml0ZXJCdWZmZXJTaXplKCk7XG5cdFx0XHRjb25zdCBmcmVlVG9rZW5zID0gc2VydmVyLmZyZWVUb2tlbnMuc2l6ZTtcblx0XHRcdGNvbnN0IGNsaWVudHNCeVRva2VuID0gc2VydmVyLmNsaWVudHNCeVRva2VuLnNpemU7XG5cdFx0XHRyZXR1cm4geyB3cml0ZXJCdWZmZXJTaXplLCBmcmVlVG9rZW5zLCBjbGllbnRzQnlUb2tlbiB9O1xuXHRcdH0sXG5cdH07XG5cblx0cmV0dXJuIHNlcnZlcjtcbn1cblxuZnVuY3Rpb24gY2xvc2VTZXJ2ZXIoc2VydmVyOiBJbnRlcm5hbFNlcnZlcikge1xuXHRpZiAoc2VydmVyLnBpbmdJbnRlcnZhbCkge1xuXHRcdGNsZWFySW50ZXJ2YWwoc2VydmVyLnBpbmdJbnRlcnZhbCk7XG5cdFx0c2VydmVyLnBpbmdJbnRlcnZhbCA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdGlmIChzZXJ2ZXIudG9rZW5JbnRlcnZhbCkge1xuXHRcdGNsZWFySW50ZXJ2YWwoc2VydmVyLnRva2VuSW50ZXJ2YWwpO1xuXHRcdHNlcnZlci50b2tlbkludGVydmFsID0gdW5kZWZpbmVkO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGNvbm5lY3RDbGllbnQoXG5cdHNlcnZlcjogSW50ZXJuYWxTZXJ2ZXIsIG9yaWdpbmFsUmVxdWVzdDogT3JpZ2luYWxSZXF1ZXN0LCBlcnJvckhhbmRsZXI6IEVycm9ySGFuZGxlciwgbG9nOiBMb2dnZXIsXG5cdHV3c1NvY2tldEV2ZW50czogVVdTU29ja2V0RXZlbnRzXG4pIHtcblx0Y29uc3Qgc29ja2V0ID0gdXdzU29ja2V0RXZlbnRzLnNvY2tldDtcblx0Y29uc3QgcXVlcnkgPSBnZXRRdWVyeShvcmlnaW5hbFJlcXVlc3QudXJsKTtcblx0Y29uc3QgdCA9IChxdWVyeS50IHx8ICcnKSBhcyBzdHJpbmc7XG5cdGNvbnN0IHRva2VuID0gc2VydmVyLmNvbm5lY3Rpb25Ub2tlbnMgPyBnZXRUb2tlbihzZXJ2ZXIsIHQpIHx8IGdldFRva2VuRnJvbUNsaWVudChzZXJ2ZXIsIHQpIDogdW5kZWZpbmVkO1xuXG5cdGlmIChzZXJ2ZXIuaGFzaCAmJiBxdWVyeS5oYXNoICE9PSBzZXJ2ZXIuaGFzaCkge1xuXHRcdGlmIChzZXJ2ZXIuZGVidWcpIGxvZygnY2xpZW50IGRpc2Nvbm5lY3RlZCAoaGFzaCBtaXNtYXRjaCknKTtcblxuXHRcdHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KFtNZXNzYWdlVHlwZS5WZXJzaW9uLCBzZXJ2ZXIuaGFzaF0pKTtcblx0XHR1d3NTb2NrZXRFdmVudHMuY2xvc2UodHJ1ZSk7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0aWYgKHNlcnZlci5jb25uZWN0aW9uVG9rZW5zICYmICF0b2tlbikge1xuXHRcdGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcih7IG9yaWdpbmFsUmVxdWVzdCB9IGFzIGFueSwgbmV3IEVycm9yKGBJbnZhbGlkIHRva2VuOiAke3R9YCkpO1xuXHRcdHV3c1NvY2tldEV2ZW50cy5jbG9zZSh0cnVlKTtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRjb25zdCBjYWxsc0xpc3Q6IG51bWJlcltdID0gW107XG5cdGNvbnN0IHsgaGFuZGxlUmVzdWx0LCBjcmVhdGVDbGllbnQgPSB4ID0+IHggfSA9IHNlcnZlcjtcblxuXHRsZXQgYnl0ZXNSZXNldCA9IERhdGUubm93KCk7XG5cdGxldCBieXRlc1JlY2VpdmVkID0gMDtcblx0bGV0IHRyYW5zZmVyTGltaXRFeGNlZWRlZCA9IGZhbHNlO1xuXHRsZXQgaXNDb25uZWN0ZWQgPSB0cnVlO1xuXHRsZXQgc2VydmVyQWN0aW9uczogU29ja2V0U2VydmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRsZXQgY2xvc2VSZWFzb246IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRjb25zdCBvYmo6IENsaWVudFN0YXRlID0ge1xuXHRcdGxhc3RNZXNzYWdlVGltZTogRGF0ZS5ub3coKSxcblx0XHRsYXN0TWVzc2FnZUlkOiAwLFxuXHRcdGxhc3RTZW5kVGltZTogRGF0ZS5ub3coKSxcblx0XHRzZW50U2l6ZTogMCxcblx0XHRzdXBwb3J0c0JpbmFyeTogISFzZXJ2ZXIuZm9yY2VCaW5hcnkgfHwgISEocXVlcnkgJiYgcXVlcnkuYmluID09PSAndHJ1ZScpLFxuXHRcdHRva2VuLFxuXHRcdHBpbmcoKSB7XG5cdFx0XHRzb2NrZXQuc2VuZCgnJyk7XG5cdFx0fSxcblx0XHRjbGllbnQ6IGNyZWF0ZUNsaWVudCh7XG5cdFx0XHRpZDogc2VydmVyLmN1cnJlbnRDbGllbnRJZCsrLFxuXHRcdFx0dG9rZW5JZDogdG9rZW4gPyB0b2tlbi5pZCA6IHVuZGVmaW5lZCxcblx0XHRcdHRva2VuRGF0YTogdG9rZW4gPyB0b2tlbi5kYXRhIDogdW5kZWZpbmVkLFxuXHRcdFx0b3JpZ2luYWxSZXF1ZXN0OiBzZXJ2ZXIua2VlcE9yaWdpbmFsUmVxdWVzdCA/IG9yaWdpbmFsUmVxdWVzdCA6IHVuZGVmaW5lZCxcblx0XHRcdHRyYW5zZmVyTGltaXQ6IHNlcnZlci50cmFuc2ZlckxpbWl0LFxuXHRcdFx0YmFja3ByZXNzdXJlTGltaXQ6IHNlcnZlci5iYWNrcHJlc3N1cmVMaW1pdCxcblx0XHRcdGlzQ29ubmVjdGVkKCkge1xuXHRcdFx0XHRyZXR1cm4gaXNDb25uZWN0ZWQ7XG5cdFx0XHR9LFxuXHRcdFx0bGFzdE1lc3NhZ2VUaW1lKCkge1xuXHRcdFx0XHRyZXR1cm4gb2JqLmxhc3RNZXNzYWdlVGltZTtcblx0XHRcdH0sXG5cdFx0XHRkaXNjb25uZWN0KGZvcmNlID0gZmFsc2UsIGludmFsaWRhdGVUb2tlbiA9IGZhbHNlLCByZWFzb24gPSAnJykge1xuXHRcdFx0XHRpc0Nvbm5lY3RlZCA9IGZhbHNlO1xuXG5cdFx0XHRcdGlmIChpbnZhbGlkYXRlVG9rZW4gJiYgb2JqLnRva2VuKSB7XG5cdFx0XHRcdFx0aWYgKHNlcnZlci5jbGllbnRzQnlUb2tlbi5nZXQob2JqLnRva2VuLmlkKSA9PT0gb2JqKSB7XG5cdFx0XHRcdFx0XHRzZXJ2ZXIuY2xpZW50c0J5VG9rZW4uZGVsZXRlKG9iai50b2tlbi5pZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG9iai50b2tlbiA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChmb3JjZSkge1xuXHRcdFx0XHRcdHV3c1NvY2tldEV2ZW50cy5jbG9zZSh0cnVlKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjbG9zZVJlYXNvbiA9IHJlYXNvbjtcblx0XHRcdFx0XHR1d3NTb2NrZXRFdmVudHMuY2xvc2UoZmFsc2UvKiBjb2RlPywgcmVhc29uKi8pO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdH0sIHNlbmQpLFxuXHR9O1xuXG5cdGlmIChvYmoudG9rZW4pIHtcblx0XHRzZXJ2ZXIuY2xpZW50c0J5VG9rZW4uc2V0KG9iai50b2tlbi5pZCwgb2JqKTtcblx0fVxuXG5cdC8vIFRPRE86IHJlbW92ZSBVaW50OEFycmF5IGZyb20gaGVyZVxuXHRmdW5jdGlvbiBzZW5kKGRhdGE6IHN0cmluZyB8IFVpbnQ4QXJyYXkgfCBCdWZmZXIpIHtcblx0XHRpZiAoc2VydmVyLmVycm9ySWZOb3RDb25uZWN0ZWQgJiYgIWlzQ29ubmVjdGVkKSB7XG5cdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3Iob2JqLmNsaWVudCwgbmV3IEVycm9yKCdOb3QgQ29ubmVjdGVkJykpO1xuXHRcdH1cblxuXHRcdGlmIChzb2NrZXQuZ2V0QnVmZmVyZWRBbW91bnQoKSA+IG9iai5jbGllbnQuYmFja3ByZXNzdXJlTGltaXQpIHtcblx0XHRcdG9iai5jbGllbnQuZGlzY29ubmVjdCh0cnVlLCBmYWxzZSwgJ0V4Y2VlZGVkIGJ1ZmZlcmVkIGFtb3VudCcpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChkYXRhIGluc3RhbmNlb2YgQnVmZmVyKSB7XG5cdFx0XHRzZXJ2ZXIudG90YWxTZW50ICs9IGRhdGEuYnl0ZUxlbmd0aDtcblx0XHRcdHNvY2tldC5zZW5kKGRhdGEsIHRydWUpO1xuXHRcdH0gZWxzZSBpZiAodHlwZW9mIGRhdGEgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRzZXJ2ZXIudG90YWxTZW50ICs9IGRhdGEuYnl0ZUxlbmd0aDtcblx0XHRcdHNvY2tldC5zZW5kKEJ1ZmZlci5mcm9tKGRhdGEuYnVmZmVyLCBkYXRhLmJ5dGVPZmZzZXQsIGRhdGEuYnl0ZUxlbmd0aCksIHRydWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzZXJ2ZXIudG90YWxTZW50ICs9IGRhdGEubGVuZ3RoO1xuXHRcdFx0c29ja2V0LnNlbmQoZGF0YSwgZmFsc2UpO1xuXHRcdH1cblxuXHRcdG9iai5sYXN0U2VuZFRpbWUgPSBEYXRlLm5vdygpO1xuXHR9XG5cblx0Y29uc3QgaGFuZGxlUmVzdWx0MjogSGFuZGxlUmVzdWx0ID0gKGZ1bmNJZCwgZnVuZE5hbWUsIHJlc3VsdCwgbWVzc2FnZUlkKSA9PiB7XG5cdFx0aGFuZGxlUmVzdWx0KHNlbmQsIG9iaiwgZnVuY0lkLCBmdW5kTmFtZSwgcmVzdWx0LCBtZXNzYWdlSWQpO1xuXHR9O1xuXG5cdGZ1bmN0aW9uIHNlcnZlckFjdGlvbnNDcmVhdGVkKHNlcnZlckFjdGlvbnM6IFNvY2tldFNlcnZlcikge1xuXHRcdHV3c1NvY2tldEV2ZW50cy5vbk1lc3NhZ2UgPSAobWVzc2FnZSwgaXNCaW5hcnkpID0+IHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGxldCBkYXRhOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmICghaXNCaW5hcnkpIHtcblx0XHRcdFx0XHRkYXRhID0gQnVmZmVyLmZyb20obWVzc2FnZSkudG9TdHJpbmcoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodHJhbnNmZXJMaW1pdEV4Y2VlZGVkIHx8ICFpc0Nvbm5lY3RlZClcblx0XHRcdFx0XHRyZXR1cm47XG5cblx0XHRcdFx0Y29uc3QgbWVzc2FnZUxlbmd0aCA9IGdldExlbmd0aChkYXRhIHx8IG1lc3NhZ2UpO1xuXHRcdFx0XHRieXRlc1JlY2VpdmVkICs9IG1lc3NhZ2VMZW5ndGg7XG5cdFx0XHRcdHNlcnZlci50b3RhbFJlY2VpdmVkICs9IGJ5dGVzUmVjZWl2ZWQ7XG5cblx0XHRcdFx0bGV0IHJlYWRlcjogQmluYXJ5UmVhZGVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0XHRcdGlmIChtZXNzYWdlTGVuZ3RoKSB7XG5cdFx0XHRcdFx0aWYgKGlzQmluYXJ5KSB7XG5cdFx0XHRcdFx0XHRyZWFkZXIgPSBjcmVhdGVCaW5hcnlSZWFkZXJGcm9tQnVmZmVyKG1lc3NhZ2UsIDAsIG1lc3NhZ2UuYnl0ZUxlbmd0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblx0XHRcdFx0Y29uc3QgZGlmZiA9IG5vdyAtIGJ5dGVzUmVzZXQ7XG5cdFx0XHRcdGNvbnN0IGJ5dGVzUGVyU2Vjb25kID0gYnl0ZXNSZWNlaXZlZCAqIDEwMDAgLyBNYXRoLm1heCgxMDAwLCBkaWZmKTtcblx0XHRcdFx0Y29uc3QgdHJhbnNmZXJMaW1pdCA9IG9iai5jbGllbnQudHJhbnNmZXJMaW1pdDtcblxuXHRcdFx0XHRpZiAodHJhbnNmZXJMaW1pdCAmJiB0cmFuc2ZlckxpbWl0IDwgYnl0ZXNQZXJTZWNvbmQpIHtcblx0XHRcdFx0XHR0cmFuc2ZlckxpbWl0RXhjZWVkZWQgPSB0cnVlO1xuXHRcdFx0XHRcdG9iai5jbGllbnQuZGlzY29ubmVjdCh0cnVlLCB0cnVlLCAndHJhbnNmZXIgbGltaXQnKTtcblx0XHRcdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlUmVjdkVycm9yKFxuXHRcdFx0XHRcdFx0b2JqLmNsaWVudCwgbmV3IEVycm9yKGBUcmFuc2ZlciBsaW1pdCBleGNlZWRlZCAke2J5dGVzUGVyU2Vjb25kLnRvRml4ZWQoMCl9LyR7dHJhbnNmZXJMaW1pdH0gKCR7ZGlmZn1tcylgKSxcblx0XHRcdFx0XHRcdHJlYWRlciA/IGdldEJpbmFyeVJlYWRlckJ1ZmZlcihyZWFkZXIpIDogZGF0YSEpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChzZXJ2ZXIuZm9yY2VCaW5hcnkgJiYgZGF0YSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0b2JqLmNsaWVudC5kaXNjb25uZWN0KHRydWUsIHRydWUsICdub24tYmluYXJ5IG1lc3NhZ2UnKTtcblx0XHRcdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlUmVjdkVycm9yKG9iai5jbGllbnQsIG5ldyBFcnJvcihgU3RyaW5nIG1lc3NhZ2Ugd2hpbGUgZm9yY2VkIGJpbmFyeWApLFxuXHRcdFx0XHRcdFx0cmVhZGVyID8gZ2V0QmluYXJ5UmVhZGVyQnVmZmVyKHJlYWRlcikgOiBkYXRhISk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0b2JqLmxhc3RNZXNzYWdlVGltZSA9IERhdGUubm93KCk7XG5cdFx0XHRcdG9iai5zdXBwb3J0c0JpbmFyeSA9IG9iai5zdXBwb3J0c0JpbmFyeSB8fCAhIShpc0JpbmFyeSk7XG5cblx0XHRcdFx0aWYgKHJlYWRlciB8fCBkYXRhKSB7XG5cdFx0XHRcdFx0b2JqLmxhc3RNZXNzYWdlSWQrKztcblx0XHRcdFx0XHRjb25zdCBtZXNzYWdlSWQgPSBvYmoubGFzdE1lc3NhZ2VJZDtcblxuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHQvLyBUT0RPOiBvcHRpb25zLm9uUGFja2V0Py4ob2JqLmNsaWVudClcblxuXHRcdFx0XHRcdFx0aWYgKGRhdGEgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0XHRzZXJ2ZXIucGFja2V0SGFuZGxlci5yZWN2U3RyaW5nKGRhdGEsIHNlcnZlckFjdGlvbnMsIHt9LCAoZnVuY0lkLCBmdW5jTmFtZSwgZnVuYywgZnVuY09iaiwgYXJncykgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IHJhdGUgPSBzZXJ2ZXIucmF0ZUxpbWl0c1tmdW5jSWRdO1xuXG5cdFx0XHRcdFx0XHRcdFx0Ly8gVE9ETzogbW92ZSByYXRlIGxpbWl0cyB0byBwYWNrZXQgaGFuZGxlclxuXHRcdFx0XHRcdFx0XHRcdGlmIChjaGVja1JhdGVMaW1pdDIoZnVuY0lkLCBjYWxsc0xpc3QsIHNlcnZlci5yYXRlTGltaXRzKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0aGFuZGxlUmVzdWx0KHNlbmQsIG9iaiwgZnVuY0lkLCBmdW5jTmFtZSwgZnVuYy5hcHBseShmdW5jT2JqLCBhcmdzKSwgbWVzc2FnZUlkKTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2UgaWYgKHJhdGUgJiYgcmF0ZS5wcm9taXNlKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRoYW5kbGVSZXN1bHQoc2VuZCwgb2JqLCBmdW5jSWQsIGZ1bmNOYW1lLCBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ1JhdGUgbGltaXQgZXhjZWVkZWQnKSksIG1lc3NhZ2VJZCk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihgUmF0ZSBsaW1pdCBleGNlZWRlZCAoJHtmdW5jTmFtZX0pYCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHNlcnZlci5wYWNrZXRIYW5kbGVyLnJlY3ZCaW5hcnkoc2VydmVyQWN0aW9ucywgcmVhZGVyISwgY2FsbHNMaXN0LCBtZXNzYWdlSWQsIGhhbmRsZVJlc3VsdDIpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdGVycm9ySGFuZGxlci5oYW5kbGVSZWN2RXJyb3Iob2JqLmNsaWVudCwgZSwgcmVhZGVyID8gZ2V0QmluYXJ5UmVhZGVyQnVmZmVyKHJlYWRlcikgOiBkYXRhISk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGRpZmYgPiAxMDAwKSB7XG5cdFx0XHRcdFx0Ynl0ZXNSZWNlaXZlZCA9IDA7XG5cdFx0XHRcdFx0Ynl0ZXNSZXNldCA9IG5vdztcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3Iob2JqLmNsaWVudCwgZSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHNlcnZlci5wYWNrZXRIYW5kbGVyLmNyZWF0ZVJlbW90ZShvYmouY2xpZW50LCBzZW5kLCBvYmopO1xuXG5cdFx0aWYgKHNlcnZlci5kZWJ1ZykgbG9nKCdjbGllbnQgY29ubmVjdGVkJyk7XG5cblx0XHRzZXJ2ZXIucGFja2V0SGFuZGxlci5zZW5kU3RyaW5nKHNlbmQsICcqdmVyc2lvbicsIE1lc3NhZ2VUeXBlLlZlcnNpb24sIFtzZXJ2ZXIuaGFzaF0pO1xuXHRcdHNlcnZlci5jbGllbnRzLnB1c2gob2JqKTtcblxuXHRcdGlmIChzZXJ2ZXJBY3Rpb25zLmNvbm5lY3RlZCkge1xuXHRcdFx0Y2FsbFdpdGhFcnJvckhhbmRsaW5nKCgpID0+IHNlcnZlckFjdGlvbnMuY29ubmVjdGVkISgpLCAoKSA9PiB7IH0sIGUgPT4ge1xuXHRcdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3Iob2JqLmNsaWVudCwgZSk7XG5cdFx0XHRcdG9iai5jbGllbnQuZGlzY29ubmVjdChmYWxzZSwgZmFsc2UsICdlcnJvciBvbiBjb25uZWN0ZWQoKScpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0bGV0IGNsb3NlZCA9IGZhbHNlO1xuXG5cdHV3c1NvY2tldEV2ZW50cy5vbkNsb3NlID0gKGNvZGUsIHJlYXNvbikgPT4ge1xuXHRcdGlmIChjbG9zZWQpIHJldHVybjtcblxuXHRcdHRyeSB7XG5cdFx0XHRjbG9zZWQgPSB0cnVlO1xuXHRcdFx0aXNDb25uZWN0ZWQgPSBmYWxzZTtcblxuXHRcdFx0Ly8gcmVtb3ZlIGNsaWVudFxuXHRcdFx0Y29uc3QgaW5kZXggPSBzZXJ2ZXIuY2xpZW50cy5pbmRleE9mKG9iaik7XG5cdFx0XHRpZiAoaW5kZXggIT09IC0xKSB7XG5cdFx0XHRcdHNlcnZlci5jbGllbnRzW2luZGV4XSA9IHNlcnZlci5jbGllbnRzW3NlcnZlci5jbGllbnRzLmxlbmd0aCAtIDFdO1xuXHRcdFx0XHRzZXJ2ZXIuY2xpZW50cy5wb3AoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHNlcnZlci5kZWJ1ZykgbG9nKCdjbGllbnQgZGlzY29ubmVjdGVkJyk7XG5cblx0XHRcdGlmIChzZXJ2ZXJBY3Rpb25zPy5kaXNjb25uZWN0ZWQpIHtcblx0XHRcdFx0Y29uc3QgZGVjb2RlZFJlYXNvbiA9IEJ1ZmZlci5mcm9tKHJlYXNvbikudG9TdHJpbmcoKTtcblx0XHRcdFx0Y2FsbFdpdGhFcnJvckhhbmRsaW5nKCgpID0+IHNlcnZlckFjdGlvbnMhLmRpc2Nvbm5lY3RlZCEoY29kZSwgY2xvc2VSZWFzb24gfHwgZGVjb2RlZFJlYXNvbiksICgpID0+IHsgfSxcblx0XHRcdFx0XHRlID0+IGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihvYmouY2xpZW50LCBlKSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChvYmoudG9rZW4pIHtcblx0XHRcdFx0b2JqLnRva2VuLmV4cGlyZSA9IERhdGUubm93KCkgKyBzZXJ2ZXIudG9rZW5MaWZldGltZTtcblxuXHRcdFx0XHRpZiAoc2VydmVyLmNsaWVudHNCeVRva2VuLmdldChvYmoudG9rZW4uaWQpID09PSBvYmopIHtcblx0XHRcdFx0XHRzZXJ2ZXIuY2xpZW50c0J5VG9rZW4uZGVsZXRlKG9iai50b2tlbi5pZCk7XG5cdFx0XHRcdFx0c2VydmVyLmZyZWVUb2tlbnMuc2V0KG9iai50b2tlbi5pZCwgb2JqLnRva2VuKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGVycm9ySGFuZGxlci5oYW5kbGVFcnJvcihvYmouY2xpZW50LCBlKTtcblx0XHR9XG5cdH07XG5cblxuXHRQcm9taXNlLnJlc29sdmUoc2VydmVyLmNyZWF0ZVNlcnZlcihvYmouY2xpZW50KSlcblx0XHQudGhlbihhY3Rpb25zID0+IHtcblx0XHRcdGlmIChpc0Nvbm5lY3RlZCkge1xuXHRcdFx0XHRzZXJ2ZXJBY3Rpb25zID0gYWN0aW9ucztcblx0XHRcdFx0c2VydmVyQWN0aW9uc0NyZWF0ZWQoc2VydmVyQWN0aW9ucyk7XG5cdFx0XHR9XG5cdFx0fSlcblx0XHQuY2F0Y2goZSA9PiB7XG5cdFx0XHR1d3NTb2NrZXRFdmVudHMuY2xvc2UodHJ1ZSk7XG5cdFx0XHRlcnJvckhhbmRsZXIuaGFuZGxlRXJyb3Iob2JqLmNsaWVudCwgZSk7XG5cdFx0fSk7XG59XG4iXSwic291cmNlUm9vdCI6Ii9ob21lL2FscGhhL0Rlc2t0b3AvZGV2L3RjLXNvY2tldHMvc3JjIn0=
