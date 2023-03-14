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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callWithErrorHandling = exports.getQuery = exports.createRateLimit = exports.parseRateLimitDef = exports.parseRateLimitDefOptions = exports.toClientOptions = exports.getBinaryOnlyPackets = exports.optionsWithDefaults = exports.createServerOptions = exports.createClientOptions = exports.getFullUrl = exports.createOriginalRequest = exports.hasToken = exports.getTokenFromClient = exports.getToken = exports.createToken = exports.returnTrue = exports.getMethodsFromType = exports.defaultErrorHandler = exports.randomString = void 0;
var url_1 = require("url");
var utils_1 = require("../common/utils");
var method_1 = require("../common/method");
var serverMethod_1 = require("./serverMethod");
var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
function randomString(length) {
    var result = '';
    for (var i = 0; i < length; i++) {
        result += characters[Math.floor(Math.random() * characters.length)];
    }
    return result;
}
exports.randomString = randomString;
exports.defaultErrorHandler = {
    handleError: function () { },
    handleRejection: function () { },
    handleRecvError: function () { },
};
function getMethodsFromType(ctor) {
    return (0, method_1.getMethods)(ctor).map(function (m) { return Object.keys(m.options).length ? [m.name, m.options] : m.name; });
}
exports.getMethodsFromType = getMethodsFromType;
function returnTrue() {
    return true;
}
exports.returnTrue = returnTrue;
function createToken(server, data) {
    var token = {
        id: randomString(16),
        data: data,
        expire: Date.now() + server.tokenLifetime,
    };
    server.freeTokens.set(token.id, token);
    return token;
}
exports.createToken = createToken;
function getToken(server, id) {
    var token = server.freeTokens.get(id);
    if (token) {
        server.freeTokens.delete(id);
        if (token.expire > Date.now())
            return token;
    }
    return null;
}
exports.getToken = getToken;
function getTokenFromClient(server, id) {
    var client = server.clientsByToken.get(id);
    if (!client)
        return undefined;
    var token = client.token;
    client.client.disconnect(true);
    server.clientsByToken.delete(id);
    client.token = undefined;
    return token;
}
exports.getTokenFromClient = getTokenFromClient;
function hasToken(server, id) {
    return server.freeTokens.has(id) || server.clientsByToken.has(id);
}
exports.hasToken = hasToken;
function createOriginalRequest(request) {
    var originalRequest = {
        url: getFullUrl(request),
        headers: {}
    };
    request.forEach(function (key, value) {
        originalRequest.headers[key] = value;
    });
    return originalRequest;
}
exports.createOriginalRequest = createOriginalRequest;
function getFullUrl(request) {
    return "".concat(request.getUrl(), "/?").concat(request.getQuery());
}
exports.getFullUrl = getFullUrl;
function createClientOptions(serverType, clientType, options) {
    return toClientOptions(optionsWithDefaults(createServerOptions(serverType, clientType, options)));
}
exports.createClientOptions = createClientOptions;
function createServerOptions(serverType, clientType, options) {
    var client = getMethodsFromType(clientType);
    var server = getMethodsFromType(serverType);
    return __assign(__assign({ client: client, server: server }, (0, serverMethod_1.getSocketMetadata)(serverType)), options);
}
exports.createServerOptions = createServerOptions;
function optionsWithDefaults(options) {
    return __assign({ hash: "".concat(Date.now()), path: '/ws', tokenLifetime: 3600 * 1000, reconnectTimeout: 500, connectionTimeout: 10000, perMessageDeflate: true }, options);
}
exports.optionsWithDefaults = optionsWithDefaults;
function getBinaryOnlyPackets(client) {
    var result = {};
    client
        .filter(utils_1.isBinaryOnlyPacket)
        .map(function (x) { return x[0]; })
        .forEach(function (key) { return result[key] = true; });
    return result;
}
exports.getBinaryOnlyPackets = getBinaryOnlyPackets;
function clearMethodOptions(_a) {
    var _b = _a, name = _b[0], _c = _b[1], _ = _c.serverRateLimit, options = __rest(_c, ["serverRateLimit"]);
    return [name, options];
}
function toClientOptions(options) {
    return {
        id: options.id,
        host: options.host,
        path: options.path,
        ssl: options.ssl,
        clientPingInterval: options.clientPingInterval,
        reconnectTimeout: options.reconnectTimeout,
        clientConnectionTimeout: options.clientConnectionTimeout,
        debug: options.debug,
        hash: options.hash,
        requestParams: options.requestParams,
        copySendBuffer: options.copySendBuffer,
        client: options.client,
        server: options.server.map(function (x) { return typeof x === 'string' ? x : clearMethodOptions(x); }),
        tokenLifetime: options.tokenLifetime,
        useBinaryByDefault: options.useBinaryByDefault,
    };
}
exports.toClientOptions = toClientOptions;
function parseRateLimitDefOptions(method) {
    return Array.isArray(method) && method[1].rateLimit ? __assign({ promise: !!method[1].promise }, (method[1].serverRateLimit ?
        (0, utils_1.parseRateLimit)(method[1].serverRateLimit, false) :
        (0, utils_1.parseRateLimit)(method[1].rateLimit, true))) : undefined;
}
exports.parseRateLimitDefOptions = parseRateLimitDefOptions;
function parseRateLimitDef(method) {
    return Array.isArray(method) && method[1].rateLimit ? __assign({ promise: !!method[1].promise }, (method[1].serverRateLimit ?
        (0, utils_1.parseRateLimit)(method[1].serverRateLimit, false) :
        (0, utils_1.parseRateLimit)(method[1].rateLimit, true))) : undefined;
}
exports.parseRateLimitDef = parseRateLimitDef;
// TODO: remove
function createRateLimit(def) {
    return def ? {
        calls: [],
        promise: def.promise,
        limit: def.limit,
        frame: def.frame,
    } : undefined;
}
exports.createRateLimit = createRateLimit;
function getQuery(url) {
    return (0, url_1.parse)(url || '', true).query || {};
}
exports.getQuery = getQuery;
function callWithErrorHandling(action, onSuccess, onError) {
    try {
        var result = action();
        if (result && result.then) {
            result.then(onSuccess, onError);
        }
        else {
            onSuccess();
        }
    }
    catch (e) {
        onError(e);
    }
}
exports.callWithErrorHandling = callWithErrorHandling;
