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
function createServer(app, serverType, clientType, createServer, options, errorHandler, log, customPacketHandlers) {
    return createServerRaw(app, createServer, (0, serverUtils_1.createServerOptions)(serverType, clientType, options), errorHandler, log, customPacketHandlers);
}
exports.createServer = createServer;
function createServerRaw(app, createServer, options, errorHandler, log, customPacketHandlers) {
    var host = createServerHost(app, {
        path: options.path,
        errorHandler: errorHandler,
        log: log,
        port: options.port,
        perMessageDeflate: options.perMessageDeflate,
        compression: options.compression,
    }, customPacketHandlers);
    var socket = host.socketRaw(createServer, __assign({ id: 'socket' }, options));
    socket.close = host.close;
    return socket;
}
exports.createServerRaw = createServerRaw;
function createServerHost(uwsApp, globalConfig, customPacketHandlers) {
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
                        errorHandler.handleError(null, error);
                    }
                }
                else {
                    errorHandler.handleError(null, new Error("Verify client ".concat(code, " ").concat(name)));
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
            next(false, 500, HTTP.STATUS_CODES[500]);
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
        return socketRaw(createServer, options, customPacketHandlers);
    }
    function socketRaw(createServer, options, customPacketHandlers) {
        var internalServer = createInternalServer(createServer, __assign(__assign({}, options), { path: path }), errorHandler, log, customPacketHandlers);
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
    //@ts-ignore
    return { close: close, socket: socket, socketRaw: socketRaw, app: uwsApp };
}
exports.createServerHost = createServerHost;
function createInternalServer(createServer, options, errorHandler, log, customPacketHandlers) {
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
    var packetHandler = (0, packetHandler_1.createPacketHandler)(options.server, options.client, handlerOptions, log, customPacketHandlers);
    var clientOptions = (0, serverUtils_1.toClientOptions)(options);
    var clientMethods = (0, interfaces_1.getNames)(options.client);
    var serverMethodOptions = options.server.map(function (m) { return Array.isArray(m) ? m[1] : {}; });
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
        resultBinary: serverMethodOptions.map(function (m) { var _a, _b; return (_b = (_a = m.binaryResult) !== null && _a !== void 0 ? _a : options.useBinaryResultByDefault) !== null && _b !== void 0 ? _b : false; }),
        handleResult: handleResult,
        createServer: createServer,
        packetHandler: packetHandler,
        server: {},
        pingInterval: undefined,
        tokenInterval: undefined,
    };
    function handleResult(send, obj, funcId, funcName, funcBinary, result, messageId) {
        if (result && typeof result.then === 'function') {
            result.then(function (result) {
                if (!obj.client.isConnected())
                    return;
                if (funcBinary) {
                    packetHandler.sendBinary(send, "*resolve:".concat(funcName), 254 /* MessageType.Resolved */, funcId, messageId, result);
                }
                else {
                    packetHandler.sendString(send, "*resolve:".concat(funcName), 254 /* MessageType.Resolved */, funcId, messageId, result);
                }
            }, function (e) {
                e = errorHandler.handleRejection(obj.client, e) || e;
                if (!obj.client.isConnected())
                    return;
                if (funcBinary) {
                    packetHandler.sendBinary(send, "*reject:".concat(funcName), 253 /* MessageType.Rejected */, funcId, messageId, e ? e.message : 'error');
                }
                else {
                    packetHandler.sendString(send, "*reject:".concat(funcName), 253 /* MessageType.Rejected */, funcId, messageId, e ? e.message : 'error');
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
    var handleResult2 = function (funcId, funcName, funcBinary, result, messageId) {
        handleResult(send, obj, funcId, funcName, funcBinary, result, messageId);
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
                                var funcBinary = server.resultBinary[funcId];
                                // TODO: move rate limits to packet handler
                                if ((0, utils_1.checkRateLimit2)(funcId, callsList, server.rateLimits)) {
                                    handleResult(send, obj, funcId, funcName, funcBinary, func.apply(funcObj, args), messageId_1);
                                }
                                else if (rate && rate.promise) {
                                    handleResult(send, obj, funcId, funcName, funcBinary, Promise.reject(new Error('Rate limit exceeded')), messageId_1);
                                }
                                else {
                                    throw new Error("Rate limit exceeded (".concat(funcName, ")"));
                                }
                            });
                        }
                        else {
                            server.packetHandler.recvBinary(reader, serverActions, {}, callsList, messageId_1, handleResult2);
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
        server.packetHandler.sendString(send, '*version', 255 /* MessageType.Version */, 0, 0, server.hash);
        server.clients.push(obj);
        if (serverActions.connected) {
            (0, serverUtils_1.callWithErrorHandling)(function () { return serverActions.connected(); }, function () { }, function (e) {
                errorHandler.handleError(obj.client, e);
                obj.client.disconnect(false, false, 'error on connected()');
                uwsSocketEvents.close(true);
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
