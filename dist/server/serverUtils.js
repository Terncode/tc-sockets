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
    return "".concat(request.getUrl(), "?").concat(request.getQuery());
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zZXJ2ZXIvc2VydmVyVXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDJCQUF3QztBQUV4Qyx5Q0FBcUU7QUFFckUsMkNBQThDO0FBRTlDLCtDQUFtRDtBQUduRCxJQUFNLFVBQVUsR0FBRyxpRUFBaUUsQ0FBQztBQUVyRixTQUFnQixZQUFZLENBQUMsTUFBYztJQUMxQyxJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7SUFFaEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUNoQyxNQUFNLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0tBQ3BFO0lBRUQsT0FBTyxNQUFNLENBQUM7QUFDZixDQUFDO0FBUkQsb0NBUUM7QUFFWSxRQUFBLG1CQUFtQixHQUFpQjtJQUNoRCxXQUFXLGdCQUFLLENBQUM7SUFDakIsZUFBZSxnQkFBSyxDQUFDO0lBQ3JCLGVBQWUsZ0JBQUssQ0FBQztDQUNyQixDQUFDO0FBRUYsU0FBZ0Isa0JBQWtCLENBQUMsSUFBYztJQUNoRCxPQUFPLElBQUEsbUJBQVUsRUFBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQVksVUFBQSxDQUFDLElBQUksT0FBQSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQTVELENBQTRELENBQUMsQ0FBQztBQUMzRyxDQUFDO0FBRkQsZ0RBRUM7QUFFRCxTQUFnQixVQUFVO0lBQ3pCLE9BQU8sSUFBSSxDQUFDO0FBQ2IsQ0FBQztBQUZE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QUFxQixFQUFFLE9BQTJCO0lBQzFHLElBQUk7UUFDSCxJQUFNLE1BQU0sR0FBRyxNQUFNLEVBQUUsQ0FBQztRQUV4QixJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFO1lBQzFCLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1NBQ2hDO2FBQU07WUFDTixTQUFTLEVBQUUsQ0FBQztTQUNaO0tBQ0Q7SUFBQyxPQUFPLENBQUMsRUFBRTtRQUNYLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNYO0FBQ0YsQ0FBQztBQVpELHNEQVlDIiwiZmlsZSI6InNlcnZlci9zZXJ2ZXJVdGlscy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHBhcnNlIGFzIHBhcnNlVXJsIH0gZnJvbSAndXJsJztcbmltcG9ydCB7IEludGVybmFsU2VydmVyLCBTZXJ2ZXJPcHRpb25zLCBUb2tlbiB9IGZyb20gJy4vc2VydmVySW50ZXJmYWNlcyc7XG5pbXBvcnQgeyBwYXJzZVJhdGVMaW1pdCwgaXNCaW5hcnlPbmx5UGFja2V0IH0gZnJvbSAnLi4vY29tbW9uL3V0aWxzJztcbmltcG9ydCB7IE9yaWdpbmFsUmVxdWVzdCwgRXJyb3JIYW5kbGVyIH0gZnJvbSAnLi9zZXJ2ZXInO1xuaW1wb3J0IHsgZ2V0TWV0aG9kcyB9IGZyb20gJy4uL2NvbW1vbi9tZXRob2QnO1xuaW1wb3J0IHsgTWV0aG9kRGVmLCBNZXRob2RPcHRpb25zLCBDbGllbnRPcHRpb25zLCBSYXRlTGltaXREZWYsIFJhdGVMaW1pdCB9IGZyb20gJy4uL2NvbW1vbi9pbnRlcmZhY2VzJztcbmltcG9ydCB7IGdldFNvY2tldE1ldGFkYXRhIH0gZnJvbSAnLi9zZXJ2ZXJNZXRob2QnO1xuaW1wb3J0IHsgSHR0cFJlcXVlc3QgfSBmcm9tICd1V2ViU29ja2V0cy5qcyc7XG5cbmNvbnN0IGNoYXJhY3RlcnMgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODlfJztcblxuZXhwb3J0IGZ1bmN0aW9uIHJhbmRvbVN0cmluZyhsZW5ndGg6IG51bWJlcikge1xuXHRsZXQgcmVzdWx0ID0gJyc7XG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuXHRcdHJlc3VsdCArPSBjaGFyYWN0ZXJzW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGNoYXJhY3RlcnMubGVuZ3RoKV07XG5cdH1cblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgY29uc3QgZGVmYXVsdEVycm9ySGFuZGxlcjogRXJyb3JIYW5kbGVyID0ge1xuXHRoYW5kbGVFcnJvcigpIHsgfSxcblx0aGFuZGxlUmVqZWN0aW9uKCkgeyB9LFxuXHRoYW5kbGVSZWN2RXJyb3IoKSB7IH0sXG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0TWV0aG9kc0Zyb21UeXBlKGN0b3I6IEZ1bmN0aW9uKSB7XG5cdHJldHVybiBnZXRNZXRob2RzKGN0b3IpLm1hcDxNZXRob2REZWY+KG0gPT4gT2JqZWN0LmtleXMobS5vcHRpb25zKS5sZW5ndGggPyBbbS5uYW1lLCBtLm9wdGlvbnNdIDogbS5uYW1lKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJldHVyblRydWUoKSB7XG5cdHJldHVybiB0cnVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVG9rZW4oc2VydmVyOiBJbnRlcm5hbFNlcnZlciwgZGF0YT86IGFueSk6IFRva2VuIHtcblx0Y29uc3QgdG9rZW4gPSB7XG5cdFx0aWQ6IHJhbmRvbVN0cmluZygxNiksXG5cdFx0ZGF0YSxcblx0XHRleHBpcmU6IERhdGUubm93KCkgKyBzZXJ2ZXIudG9rZW5MaWZldGltZSEsXG5cdH07XG5cdHNlcnZlci5mcmVlVG9rZW5zLnNldCh0b2tlbi5pZCwgdG9rZW4pO1xuXHRyZXR1cm4gdG9rZW47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRUb2tlbihzZXJ2ZXI6IEludGVybmFsU2VydmVyLCBpZDogc3RyaW5nKTogVG9rZW4gfCBudWxsIHtcblx0Y29uc3QgdG9rZW4gPSBzZXJ2ZXIuZnJlZVRva2Vucy5nZXQoaWQpO1xuXG5cdGlmICh0b2tlbikge1xuXHRcdHNlcnZlci5mcmVlVG9rZW5zLmRlbGV0ZShpZCk7XG5cdFx0aWYgKHRva2VuLmV4cGlyZSA+IERhdGUubm93KCkpIHJldHVybiB0b2tlbjtcblx0fVxuXG5cdHJldHVybiBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VG9rZW5Gcm9tQ2xpZW50KHNlcnZlcjogSW50ZXJuYWxTZXJ2ZXIsIGlkOiBzdHJpbmcpOiBUb2tlbiB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IGNsaWVudCA9IHNlcnZlci5jbGllbnRzQnlUb2tlbi5nZXQoaWQpO1xuXHRpZiAoIWNsaWVudCkgcmV0dXJuIHVuZGVmaW5lZDtcblxuXHRjb25zdCB0b2tlbiA9IGNsaWVudC50b2tlbjtcblx0Y2xpZW50LmNsaWVudC5kaXNjb25uZWN0KHRydWUpO1xuXHRzZXJ2ZXIuY2xpZW50c0J5VG9rZW4uZGVsZXRlKGlkKTtcblx0Y2xpZW50LnRva2VuID0gdW5kZWZpbmVkO1xuXHRyZXR1cm4gdG9rZW47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBoYXNUb2tlbihzZXJ2ZXI6IEludGVybmFsU2VydmVyLCBpZDogYW55KSB7XG5cdHJldHVybiBzZXJ2ZXIuZnJlZVRva2Vucy5oYXMoaWQpIHx8IHNlcnZlci5jbGllbnRzQnlUb2tlbi5oYXMoaWQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlT3JpZ2luYWxSZXF1ZXN0KHJlcXVlc3Q6IEh0dHBSZXF1ZXN0KTogT3JpZ2luYWxSZXF1ZXN0IHtcblx0Y29uc3Qgb3JpZ2luYWxSZXF1ZXN0OiBPcmlnaW5hbFJlcXVlc3QgPSB7XG5cdFx0dXJsOiBnZXRGdWxsVXJsKHJlcXVlc3QpLFxuXHRcdGhlYWRlcnM6IHt9XG5cdH07XG5cdHJlcXVlc3QuZm9yRWFjaCgoa2V5LCB2YWx1ZSkgPT4ge1xuXHRcdG9yaWdpbmFsUmVxdWVzdC5oZWFkZXJzW2tleV0gPSB2YWx1ZTtcblx0fSk7XG5cdHJldHVybiBvcmlnaW5hbFJlcXVlc3Q7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0RnVsbFVybChyZXF1ZXN0OiBIdHRwUmVxdWVzdCkge1xuXHRyZXR1cm4gYCR7cmVxdWVzdC5nZXRVcmwoKX0/JHtyZXF1ZXN0LmdldFF1ZXJ5KCl9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNsaWVudE9wdGlvbnM8VFNlcnZlciwgVENsaWVudD4oXG5cdHNlcnZlclR5cGU6IG5ldyAoLi4uYXJnczogYW55W10pID0+IFRTZXJ2ZXIsXG5cdGNsaWVudFR5cGU6IG5ldyAoLi4uYXJnczogYW55W10pID0+IFRDbGllbnQsXG5cdG9wdGlvbnM/OiBTZXJ2ZXJPcHRpb25zXG4pIHtcblx0cmV0dXJuIHRvQ2xpZW50T3B0aW9ucyhvcHRpb25zV2l0aERlZmF1bHRzKGNyZWF0ZVNlcnZlck9wdGlvbnMoc2VydmVyVHlwZSwgY2xpZW50VHlwZSwgb3B0aW9ucyBhcyBhbnkpKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTZXJ2ZXJPcHRpb25zKHNlcnZlclR5cGU6IEZ1bmN0aW9uLCBjbGllbnRUeXBlOiBGdW5jdGlvbiwgb3B0aW9ucz86IFNlcnZlck9wdGlvbnMpIHtcblx0Y29uc3QgY2xpZW50ID0gZ2V0TWV0aG9kc0Zyb21UeXBlKGNsaWVudFR5cGUpO1xuXHRjb25zdCBzZXJ2ZXIgPSBnZXRNZXRob2RzRnJvbVR5cGUoc2VydmVyVHlwZSk7XG5cdHJldHVybiB7IGNsaWVudCwgc2VydmVyLCAuLi5nZXRTb2NrZXRNZXRhZGF0YShzZXJ2ZXJUeXBlKSwgLi4ub3B0aW9ucyB9IGFzIFNlcnZlck9wdGlvbnM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBvcHRpb25zV2l0aERlZmF1bHRzKG9wdGlvbnM6IFNlcnZlck9wdGlvbnMpOiBTZXJ2ZXJPcHRpb25zIHtcblx0cmV0dXJuIHtcblx0XHRoYXNoOiBgJHtEYXRlLm5vdygpfWAsXG5cdFx0cGF0aDogJy93cycsXG5cdFx0dG9rZW5MaWZldGltZTogMzYwMCAqIDEwMDAsIC8vIDEgaG91clxuXHRcdHJlY29ubmVjdFRpbWVvdXQ6IDUwMCwgLy8gMC41IHNlY1xuXHRcdGNvbm5lY3Rpb25UaW1lb3V0OiAxMDAwMCwgLy8gMTAgc2VjXG5cdFx0cGVyTWVzc2FnZURlZmxhdGU6IHRydWUsXG5cdFx0Li4ub3B0aW9ucyxcblx0fTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEJpbmFyeU9ubHlQYWNrZXRzKGNsaWVudDogTWV0aG9kRGVmW10pIHtcblx0Y29uc3QgcmVzdWx0OiBhbnkgPSB7fTtcblxuXHRjbGllbnRcblx0XHQuZmlsdGVyKGlzQmluYXJ5T25seVBhY2tldClcblx0XHQubWFwKHggPT4geFswXSBhcyBzdHJpbmcpXG5cdFx0LmZvckVhY2goa2V5ID0+IHJlc3VsdFtrZXldID0gdHJ1ZSk7XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gY2xlYXJNZXRob2RPcHRpb25zKFtuYW1lLCB7IHNlcnZlclJhdGVMaW1pdDogXywgLi4ub3B0aW9ucyB9XTogW3N0cmluZywgTWV0aG9kT3B0aW9uc10pIHtcblx0cmV0dXJuIFtuYW1lLCBvcHRpb25zXSBhcyBbc3RyaW5nLCBNZXRob2RPcHRpb25zXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRvQ2xpZW50T3B0aW9ucyhvcHRpb25zOiBTZXJ2ZXJPcHRpb25zKTogQ2xpZW50T3B0aW9ucyB7XG5cdHJldHVybiB7XG5cdFx0aWQ6IG9wdGlvbnMuaWQsXG5cdFx0aG9zdDogb3B0aW9ucy5ob3N0LFxuXHRcdHBhdGg6IG9wdGlvbnMucGF0aCxcblx0XHRzc2w6IG9wdGlvbnMuc3NsLFxuXHRcdHBpbmdJbnRlcnZhbDogb3B0aW9ucy5waW5nSW50ZXJ2YWwsXG5cdFx0cmVjb25uZWN0VGltZW91dDogb3B0aW9ucy5yZWNvbm5lY3RUaW1lb3V0LFxuXHRcdGRlYnVnOiBvcHRpb25zLmRlYnVnLFxuXHRcdGhhc2g6IG9wdGlvbnMuaGFzaCxcblx0XHRyZXF1ZXN0UGFyYW1zOiBvcHRpb25zLnJlcXVlc3RQYXJhbXMsXG5cdFx0Y29weVNlbmRCdWZmZXI6IG9wdGlvbnMuY29weVNlbmRCdWZmZXIsXG5cdFx0Y2xpZW50OiBvcHRpb25zLmNsaWVudCEsXG5cdFx0c2VydmVyOiBvcHRpb25zLnNlcnZlciEubWFwKHggPT4gdHlwZW9mIHggPT09ICdzdHJpbmcnID8geCA6IGNsZWFyTWV0aG9kT3B0aW9ucyh4KSksXG5cdFx0dG9rZW5MaWZldGltZTogb3B0aW9ucy50b2tlbkxpZmV0aW1lLFxuXHRcdHVzZUJpbmFyeUJ5RGVmYXVsdDogb3B0aW9ucy51c2VCaW5hcnlCeURlZmF1bHQsXG5cdH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVJhdGVMaW1pdERlZk9wdGlvbnMobWV0aG9kOiBNZXRob2REZWYpOiBSYXRlTGltaXREZWYgfCB1bmRlZmluZWQge1xuXHRyZXR1cm4gQXJyYXkuaXNBcnJheShtZXRob2QpICYmIG1ldGhvZFsxXS5yYXRlTGltaXQgPyB7XG5cdFx0cHJvbWlzZTogISFtZXRob2RbMV0ucHJvbWlzZSxcblx0XHQuLi4obWV0aG9kWzFdLnNlcnZlclJhdGVMaW1pdCA/XG5cdFx0XHRwYXJzZVJhdGVMaW1pdChtZXRob2RbMV0uc2VydmVyUmF0ZUxpbWl0ISwgZmFsc2UpIDpcblx0XHRcdHBhcnNlUmF0ZUxpbWl0KG1ldGhvZFsxXS5yYXRlTGltaXQhLCB0cnVlKSksXG5cdH0gOiB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVJhdGVMaW1pdERlZihtZXRob2Q6IE1ldGhvZERlZik6IFJhdGVMaW1pdERlZiB8IHVuZGVmaW5lZCB7XG5cdHJldHVybiBBcnJheS5pc0FycmF5KG1ldGhvZCkgJiYgbWV0aG9kWzFdLnJhdGVMaW1pdCA/IHtcblx0XHRwcm9taXNlOiAhIW1ldGhvZFsxXS5wcm9taXNlLFxuXHRcdC4uLihtZXRob2RbMV0uc2VydmVyUmF0ZUxpbWl0ID9cblx0XHRcdHBhcnNlUmF0ZUxpbWl0KG1ldGhvZFsxXS5zZXJ2ZXJSYXRlTGltaXQhLCBmYWxzZSkgOlxuXHRcdFx0cGFyc2VSYXRlTGltaXQobWV0aG9kWzFdLnJhdGVMaW1pdCEsIHRydWUpKSxcblx0fSA6IHVuZGVmaW5lZDtcbn1cblxuLy8gVE9ETzogcmVtb3ZlXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUmF0ZUxpbWl0KGRlZjogUmF0ZUxpbWl0RGVmIHwgdW5kZWZpbmVkKTogUmF0ZUxpbWl0IHwgdW5kZWZpbmVkIHtcblx0cmV0dXJuIGRlZiA/IHtcblx0XHRjYWxsczogW10sXG5cdFx0cHJvbWlzZTogZGVmLnByb21pc2UsXG5cdFx0bGltaXQ6IGRlZi5saW1pdCxcblx0XHRmcmFtZTogZGVmLmZyYW1lLFxuXHR9IDogdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UXVlcnkodXJsOiBzdHJpbmcgfCB1bmRlZmluZWQpOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB8IHN0cmluZ1tdIHwgdW5kZWZpbmVkOyB9IHtcblx0cmV0dXJuIHBhcnNlVXJsKHVybCB8fCAnJywgdHJ1ZSkucXVlcnkgfHwge307XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjYWxsV2l0aEVycm9ySGFuZGxpbmcoYWN0aW9uOiAoKSA9PiBhbnksIG9uU3VjY2VzczogKCkgPT4gdm9pZCwgb25FcnJvcjogKGU6IEVycm9yKSA9PiB2b2lkKSB7XG5cdHRyeSB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYWN0aW9uKCk7XG5cblx0XHRpZiAocmVzdWx0ICYmIHJlc3VsdC50aGVuKSB7XG5cdFx0XHRyZXN1bHQudGhlbihvblN1Y2Nlc3MsIG9uRXJyb3IpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRvblN1Y2Nlc3MoKTtcblx0XHR9XG5cdH0gY2F0Y2ggKGUpIHtcblx0XHRvbkVycm9yKGUpO1xuXHR9XG59XG4iXSwic291cmNlUm9vdCI6Ii9ob21lL2FscGhhL0Rlc2t0b3AvZGV2L3RjLXNvY2tldHMvc3JjIn0=
