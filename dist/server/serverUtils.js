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
exports.callWithErrorHandling = exports.getQuery = exports.createRateLimit = exports.parseRateLimitDef = exports.parseRateLimitDefOptions = exports.toClientOptions = exports.getBinaryOnlyPackets = exports.optionsWithDefaults = exports.createServerOptions = exports.createClientOptions = exports.createOriginalRequest = exports.hasToken = exports.getTokenFromClient = exports.getToken = exports.createToken = exports.returnTrue = exports.getMethodsFromType = exports.defaultErrorHandler = exports.randomString = void 0;
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
        url: "".concat(request.getUrl(), "?").concat(request.getQuery()),
        headers: {}
    };
    request.forEach(function (key, value) {
        originalRequest.headers[key] = value;
    });
    return originalRequest;
}
exports.createOriginalRequest = createOriginalRequest;
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
        pingInterval: options.pingInterval,
        reconnectTimeout: options.reconnectTimeout,
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvc2VydmVyVXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDJCQUF3QztBQUV4Qyx5Q0FBcUU7QUFFckUsMkNBQThDO0FBRTlDLCtDQUFtRDtBQUduRCxJQUFNLFVBQVUsR0FBRyxpRUFBaUUsQ0FBQztBQUVyRixTQUFnQixZQUFZLENBQUMsTUFBYztJQUMxQyxJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7SUFFaEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNoQyxNQUFNLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0tBQ3BFO0lBRUQsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBUkQsb0NBUUM7QUFFWSxRQUFBLG1CQUFtQixHQUFpQjtJQUNoRCxXQUFXLGdCQUFLLENBQUM7SUFDakIsZUFBZSxnQkFBSyxDQUFDO0lBQ3JCLGVBQWUsZ0JBQUssQ0FBQztDQUNyQixDQUFDO0FBRUYsU0FBZ0Isa0JBQWtCLENBQUMsSUFBYztJQUNoRCxPQUFPLElBQUEsbUJBQVUsRUFBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQVksVUFBQSxDQUFDLElBQUksT0FBQSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQTVELENBQTRELENBQUMsQ0FBQztBQUMzRyxDQUFDO0FBRkQsZ0RBRUM7QUFFRCxTQUFnQixVQUFVO0lBQ3pCLE9BQU8sSUFBSSxDQUFDO0FBQ2IsQ0FBQztBQUZE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QU0sQ0FBQyxJQUFJLEVBQUU7WUFDMUIsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7U0FDaEM7YUFBTTtZQUNOLFNBQVMsRUFBRSxDQUFDO1NBQ1o7S0FDRDtJQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQ1gsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ1g7QUFDRixDQUFDO0FBWkQsc0RBWUMiLCJmaWxlIjoic2VydmVyL3NlcnZlclV0aWxzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGFyc2UgYXMgcGFyc2VVcmwgfSBmcm9tICd1cmwnO1xuaW1wb3J0IHsgSW50ZXJuYWxTZXJ2ZXIsIFNlcnZlck9wdGlvbnMsIFRva2VuIH0gZnJvbSAnLi9zZXJ2ZXJJbnRlcmZhY2VzJztcbmltcG9ydCB7IHBhcnNlUmF0ZUxpbWl0LCBpc0JpbmFyeU9ubHlQYWNrZXQgfSBmcm9tICcuLi9jb21tb24vdXRpbHMnO1xuaW1wb3J0IHsgT3JpZ2luYWxSZXF1ZXN0LCBFcnJvckhhbmRsZXIgfSBmcm9tICcuL3NlcnZlcic7XG5pbXBvcnQgeyBnZXRNZXRob2RzIH0gZnJvbSAnLi4vY29tbW9uL21ldGhvZCc7XG5pbXBvcnQgeyBNZXRob2REZWYsIE1ldGhvZE9wdGlvbnMsIENsaWVudE9wdGlvbnMsIFJhdGVMaW1pdERlZiwgUmF0ZUxpbWl0IH0gZnJvbSAnLi4vY29tbW9uL2ludGVyZmFjZXMnO1xuaW1wb3J0IHsgZ2V0U29ja2V0TWV0YWRhdGEgfSBmcm9tICcuL3NlcnZlck1ldGhvZCc7XG5pbXBvcnQgeyBIdHRwUmVxdWVzdCB9IGZyb20gJ3VXZWJTb2NrZXRzLmpzJztcblxuY29uc3QgY2hhcmFjdGVycyA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OV8nO1xuXG5leHBvcnQgZnVuY3Rpb24gcmFuZG9tU3RyaW5nKGxlbmd0aDogbnVtYmVyKSB7XG5cdGxldCByZXN1bHQgPSAnJztcblxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdFx0cmVzdWx0ICs9IGNoYXJhY3RlcnNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogY2hhcmFjdGVycy5sZW5ndGgpXTtcblx0fVxuXG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmV4cG9ydCBjb25zdCBkZWZhdWx0RXJyb3JIYW5kbGVyOiBFcnJvckhhbmRsZXIgPSB7XG5cdGhhbmRsZUVycm9yKCkgeyB9LFxuXHRoYW5kbGVSZWplY3Rpb24oKSB7IH0sXG5cdGhhbmRsZVJlY3ZFcnJvcigpIHsgfSxcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRNZXRob2RzRnJvbVR5cGUoY3RvcjogRnVuY3Rpb24pIHtcblx0cmV0dXJuIGdldE1ldGhvZHMoY3RvcikubWFwPE1ldGhvZERlZj4obSA9PiBPYmplY3Qua2V5cyhtLm9wdGlvbnMpLmxlbmd0aCA/IFttLm5hbWUsIG0ub3B0aW9uc10gOiBtLm5hbWUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmV0dXJuVHJ1ZSgpIHtcblx0cmV0dXJuIHRydWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVUb2tlbihzZXJ2ZXI6IEludGVybmFsU2VydmVyLCBkYXRhPzogYW55KTogVG9rZW4ge1xuXHRjb25zdCB0b2tlbiA9IHtcblx0XHRpZDogcmFuZG9tU3RyaW5nKDE2KSxcblx0XHRkYXRhLFxuXHRcdGV4cGlyZTogRGF0ZS5ub3coKSArIHNlcnZlci50b2tlbkxpZmV0aW1lISxcblx0fTtcblx0c2VydmVyLmZyZWVUb2tlbnMuc2V0KHRva2VuLmlkLCB0b2tlbik7XG5cdHJldHVybiB0b2tlbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFRva2VuKHNlcnZlcjogSW50ZXJuYWxTZXJ2ZXIsIGlkOiBzdHJpbmcpOiBUb2tlbiB8IG51bGwge1xuXHRjb25zdCB0b2tlbiA9IHNlcnZlci5mcmVlVG9rZW5zLmdldChpZCk7XG5cblx0aWYgKHRva2VuKSB7XG5cdFx0c2VydmVyLmZyZWVUb2tlbnMuZGVsZXRlKGlkKTtcblx0XHRpZiAodG9rZW4uZXhwaXJlID4gRGF0ZS5ub3coKSkgcmV0dXJuIHRva2VuO1xuXHR9XG5cblx0cmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRUb2tlbkZyb21DbGllbnQoc2VydmVyOiBJbnRlcm5hbFNlcnZlciwgaWQ6IHN0cmluZyk6IFRva2VuIHwgdW5kZWZpbmVkIHtcblx0Y29uc3QgY2xpZW50ID0gc2VydmVyLmNsaWVudHNCeVRva2VuLmdldChpZCk7XG5cdGlmICghY2xpZW50KSByZXR1cm4gdW5kZWZpbmVkO1xuXG5cdGNvbnN0IHRva2VuID0gY2xpZW50LnRva2VuO1xuXHRjbGllbnQuY2xpZW50LmRpc2Nvbm5lY3QodHJ1ZSk7XG5cdHNlcnZlci5jbGllbnRzQnlUb2tlbi5kZWxldGUoaWQpO1xuXHRjbGllbnQudG9rZW4gPSB1bmRlZmluZWQ7XG5cdHJldHVybiB0b2tlbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhhc1Rva2VuKHNlcnZlcjogSW50ZXJuYWxTZXJ2ZXIsIGlkOiBhbnkpIHtcblx0cmV0dXJuIHNlcnZlci5mcmVlVG9rZW5zLmhhcyhpZCkgfHwgc2VydmVyLmNsaWVudHNCeVRva2VuLmhhcyhpZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVPcmlnaW5hbFJlcXVlc3QocmVxdWVzdDogSHR0cFJlcXVlc3QpOiBPcmlnaW5hbFJlcXVlc3Qge1xuXHRjb25zdCBvcmlnaW5hbFJlcXVlc3Q6IE9yaWdpbmFsUmVxdWVzdCA9IHtcblx0XHR1cmw6IGAke3JlcXVlc3QuZ2V0VXJsKCl9PyR7cmVxdWVzdC5nZXRRdWVyeSgpfWAsXG5cdFx0aGVhZGVyczoge31cblx0fTtcblx0cmVxdWVzdC5mb3JFYWNoKChrZXksIHZhbHVlKSA9PiB7XG5cdFx0b3JpZ2luYWxSZXF1ZXN0LmhlYWRlcnNba2V5XSA9IHZhbHVlO1xuXHR9KTtcblx0cmV0dXJuIG9yaWdpbmFsUmVxdWVzdDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNsaWVudE9wdGlvbnM8VFNlcnZlciwgVENsaWVudD4oXG5cdHNlcnZlclR5cGU6IG5ldyAoLi4uYXJnczogYW55W10pID0+IFRTZXJ2ZXIsXG5cdGNsaWVudFR5cGU6IG5ldyAoLi4uYXJnczogYW55W10pID0+IFRDbGllbnQsXG5cdG9wdGlvbnM/OiBTZXJ2ZXJPcHRpb25zXG4pIHtcblx0cmV0dXJuIHRvQ2xpZW50T3B0aW9ucyhvcHRpb25zV2l0aERlZmF1bHRzKGNyZWF0ZVNlcnZlck9wdGlvbnMoc2VydmVyVHlwZSwgY2xpZW50VHlwZSwgb3B0aW9ucyBhcyBhbnkpKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTZXJ2ZXJPcHRpb25zKHNlcnZlclR5cGU6IEZ1bmN0aW9uLCBjbGllbnRUeXBlOiBGdW5jdGlvbiwgb3B0aW9ucz86IFNlcnZlck9wdGlvbnMpIHtcblx0Y29uc3QgY2xpZW50ID0gZ2V0TWV0aG9kc0Zyb21UeXBlKGNsaWVudFR5cGUpO1xuXHRjb25zdCBzZXJ2ZXIgPSBnZXRNZXRob2RzRnJvbVR5cGUoc2VydmVyVHlwZSk7XG5cdHJldHVybiB7IGNsaWVudCwgc2VydmVyLCAuLi5nZXRTb2NrZXRNZXRhZGF0YShzZXJ2ZXJUeXBlKSwgLi4ub3B0aW9ucyB9IGFzIFNlcnZlck9wdGlvbnM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBvcHRpb25zV2l0aERlZmF1bHRzKG9wdGlvbnM6IFNlcnZlck9wdGlvbnMpOiBTZXJ2ZXJPcHRpb25zIHtcblx0cmV0dXJuIHtcblx0XHRoYXNoOiBgJHtEYXRlLm5vdygpfWAsXG5cdFx0cGF0aDogJy93cycsXG5cdFx0dG9rZW5MaWZldGltZTogMzYwMCAqIDEwMDAsIC8vIDEgaG91clxuXHRcdHJlY29ubmVjdFRpbWVvdXQ6IDUwMCwgLy8gMC41IHNlY1xuXHRcdGNvbm5lY3Rpb25UaW1lb3V0OiAxMDAwMCwgLy8gMTAgc2VjXG5cdFx0cGVyTWVzc2FnZURlZmxhdGU6IHRydWUsXG5cdFx0Li4ub3B0aW9ucyxcblx0fTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEJpbmFyeU9ubHlQYWNrZXRzKGNsaWVudDogTWV0aG9kRGVmW10pIHtcblx0Y29uc3QgcmVzdWx0OiBhbnkgPSB7fTtcblxuXHRjbGllbnRcblx0XHQuZmlsdGVyKGlzQmluYXJ5T25seVBhY2tldClcblx0XHQubWFwKHggPT4geFswXSBhcyBzdHJpbmcpXG5cdFx0LmZvckVhY2goa2V5ID0+IHJlc3VsdFtrZXldID0gdHJ1ZSk7XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gY2xlYXJNZXRob2RPcHRpb25zKFtuYW1lLCB7IHNlcnZlclJhdGVMaW1pdDogXywgLi4ub3B0aW9ucyB9XTogW3N0cmluZywgTWV0aG9kT3B0aW9uc10pIHtcblx0cmV0dXJuIFtuYW1lLCBvcHRpb25zXSBhcyBbc3RyaW5nLCBNZXRob2RPcHRpb25zXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRvQ2xpZW50T3B0aW9ucyhvcHRpb25zOiBTZXJ2ZXJPcHRpb25zKTogQ2xpZW50T3B0aW9ucyB7XG5cdHJldHVybiB7XG5cdFx0aWQ6IG9wdGlvbnMuaWQsXG5cdFx0aG9zdDogb3B0aW9ucy5ob3N0LFxuXHRcdHBhdGg6IG9wdGlvbnMucGF0aCxcblx0XHRzc2w6IG9wdGlvbnMuc3NsLFxuXHRcdHBpbmdJbnRlcnZhbDogb3B0aW9ucy5waW5nSW50ZXJ2YWwsXG5cdFx0cmVjb25uZWN0VGltZW91dDogb3B0aW9ucy5yZWNvbm5lY3RUaW1lb3V0LFxuXHRcdGRlYnVnOiBvcHRpb25zLmRlYnVnLFxuXHRcdGhhc2g6IG9wdGlvbnMuaGFzaCxcblx0XHRyZXF1ZXN0UGFyYW1zOiBvcHRpb25zLnJlcXVlc3RQYXJhbXMsXG5cdFx0Y29weVNlbmRCdWZmZXI6IG9wdGlvbnMuY29weVNlbmRCdWZmZXIsXG5cdFx0Y2xpZW50OiBvcHRpb25zLmNsaWVudCEsXG5cdFx0c2VydmVyOiBvcHRpb25zLnNlcnZlciEubWFwKHggPT4gdHlwZW9mIHggPT09ICdzdHJpbmcnID8geCA6IGNsZWFyTWV0aG9kT3B0aW9ucyh4KSksXG5cdFx0dG9rZW5MaWZldGltZTogb3B0aW9ucy50b2tlbkxpZmV0aW1lLFxuXHRcdHVzZUJpbmFyeUJ5RGVmYXVsdDogb3B0aW9ucy51c2VCaW5hcnlCeURlZmF1bHQsXG5cdH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVJhdGVMaW1pdERlZk9wdGlvbnMobWV0aG9kOiBNZXRob2REZWYpOiBSYXRlTGltaXREZWYgfCB1bmRlZmluZWQge1xuXHRyZXR1cm4gQXJyYXkuaXNBcnJheShtZXRob2QpICYmIG1ldGhvZFsxXS5yYXRlTGltaXQgPyB7XG5cdFx0cHJvbWlzZTogISFtZXRob2RbMV0ucHJvbWlzZSxcblx0XHQuLi4obWV0aG9kWzFdLnNlcnZlclJhdGVMaW1pdCA/XG5cdFx0XHRwYXJzZVJhdGVMaW1pdChtZXRob2RbMV0uc2VydmVyUmF0ZUxpbWl0ISwgZmFsc2UpIDpcblx0XHRcdHBhcnNlUmF0ZUxpbWl0KG1ldGhvZFsxXS5yYXRlTGltaXQhLCB0cnVlKSksXG5cdH0gOiB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVJhdGVMaW1pdERlZihtZXRob2Q6IE1ldGhvZERlZik6IFJhdGVMaW1pdERlZiB8IHVuZGVmaW5lZCB7XG5cdHJldHVybiBBcnJheS5pc0FycmF5KG1ldGhvZCkgJiYgbWV0aG9kWzFdLnJhdGVMaW1pdCA/IHtcblx0XHRwcm9taXNlOiAhIW1ldGhvZFsxXS5wcm9taXNlLFxuXHRcdC4uLihtZXRob2RbMV0uc2VydmVyUmF0ZUxpbWl0ID9cblx0XHRcdHBhcnNlUmF0ZUxpbWl0KG1ldGhvZFsxXS5zZXJ2ZXJSYXRlTGltaXQhLCBmYWxzZSkgOlxuXHRcdFx0cGFyc2VSYXRlTGltaXQobWV0aG9kWzFdLnJhdGVMaW1pdCEsIHRydWUpKSxcblx0fSA6IHVuZGVmaW5lZDtcbn1cblxuLy8gVE9ETzogcmVtb3ZlXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUmF0ZUxpbWl0KGRlZjogUmF0ZUxpbWl0RGVmIHwgdW5kZWZpbmVkKTogUmF0ZUxpbWl0IHwgdW5kZWZpbmVkIHtcblx0cmV0dXJuIGRlZiA/IHtcblx0XHRjYWxsczogW10sXG5cdFx0cHJvbWlzZTogZGVmLnByb21pc2UsXG5cdFx0bGltaXQ6IGRlZi5saW1pdCxcblx0XHRmcmFtZTogZGVmLmZyYW1lLFxuXHR9IDogdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UXVlcnkodXJsOiBzdHJpbmcgfCB1bmRlZmluZWQpOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB8IHN0cmluZ1tdIHwgdW5kZWZpbmVkOyB9IHtcblx0cmV0dXJuIHBhcnNlVXJsKHVybCB8fCAnJywgdHJ1ZSkucXVlcnkgfHwge307XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjYWxsV2l0aEVycm9ySGFuZGxpbmcoYWN0aW9uOiAoKSA9PiBhbnksIG9uU3VjY2VzczogKCkgPT4gdm9pZCwgb25FcnJvcjogKGU6IEVycm9yKSA9PiB2b2lkKSB7XG5cdHRyeSB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYWN0aW9uKCk7XG5cblx0XHRpZiAocmVzdWx0ICYmIHJlc3VsdC50aGVuKSB7XG5cdFx0XHRyZXN1bHQudGhlbihvblN1Y2Nlc3MsIG9uRXJyb3IpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRvblN1Y2Nlc3MoKTtcblx0XHR9XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHRvbkVycm9yKGUpO1xuXHR9XG59XG4iXSwic291cmNlUm9vdCI6Ii9ob21lL2FscGhhL0Rlc2t0b3AvZGV2L3RjLXNvY2tldHMvc3JjIn0=
