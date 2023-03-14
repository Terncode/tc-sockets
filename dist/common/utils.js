"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.noop = exports.hasArrayBuffer = exports.isBinaryOnlyPacket = exports.deferred = exports.supportsBinary = exports.checkRateLimit2 = exports.checkRateLimit3 = exports.parseRateLimit = exports.cloneDeep = exports.queryString = exports.getLength = void 0;
var interfaces_1 = require("./interfaces");
function getLength(message) {
    return (message ? message.length || message.byteLength : 0) | 0;
}
exports.getLength = getLength;
function queryString(params) {
    var query = Object.keys(params || {})
        .filter(function (key) { return params[key] != null; })
        .map(function (key) { return "".concat(key, "=").concat(encodeURIComponent(params[key])); })
        .join('&');
    return query ? "?".concat(query) : '';
}
exports.queryString = queryString;
function cloneDeep(value) {
    return JSON.parse(JSON.stringify(value));
}
exports.cloneDeep = cloneDeep;
var times = {
    s: 1000,
    m: 1000 * 60,
    h: 1000 * 60 * 60,
};
function parseRateLimit(value, extended) {
    var m = /^(\d+)\/(\d+)?([smh])$/.exec(value);
    if (!m)
        throw new Error('Invalid rate limit value');
    var limit = +m[1];
    var frame = +(m[2] || '1') * times[m[3]];
    if (extended && frame < 5000) {
        limit *= 2;
        frame *= 2;
    }
    return { limit: limit, frame: frame };
}
exports.parseRateLimit = parseRateLimit;
function checkRateLimit3(funcId, callsList, limit, frame) {
    var index = funcId << 1;
    while (callsList.length <= (index + 1))
        callsList.push(0);
    var bucketTime = callsList[index];
    var bucketCount = callsList[index + 1];
    var time = (Date.now() / frame) | 0;
    if (bucketTime === time) {
        if (bucketCount >= limit) {
            return false;
        }
        else {
            callsList[index + 1] = bucketCount + 1;
        }
    }
    else {
        callsList[index] = time;
        callsList[index + 1] = 1;
    }
    return true;
}
exports.checkRateLimit3 = checkRateLimit3;
function checkRateLimit2(funcId, callsList, rates) {
    var rate = rates[funcId];
    if (!rate)
        return true;
    return checkRateLimit3(funcId, callsList, rate.limit, rate.frame);
}
exports.checkRateLimit2 = checkRateLimit2;
var supportsBinaryValue;
/* istanbul ignore next */
function supportsBinary() {
    if (supportsBinaryValue != null) {
        return supportsBinaryValue;
    }
    var protocol = 'https:' === location.protocol ? 'wss' : 'ws';
    if (typeof global !== 'undefined' && 'WebSocket' in global) {
        return true;
    }
    if ('WebSocket' in window) {
        if ('binaryType' in WebSocket.prototype) {
            return true;
        }
        try {
            return !!(new WebSocket(protocol + '://.').binaryType);
        }
        catch (_a) { }
    }
    return false;
}
exports.supportsBinary = supportsBinary;
function deferred() {
    var obj = {};
    obj.promise = new Promise(function (resolve, reject) {
        obj.resolve = resolve;
        obj.reject = reject;
    });
    return obj;
}
exports.deferred = deferred;
function isBinaryOnlyPacket(method) {
    return typeof method !== 'string' && method[1].binary && hasArrayBuffer(method[1].binary);
}
exports.isBinaryOnlyPacket = isBinaryOnlyPacket;
function hasArrayBuffer(def) {
    return Array.isArray(def) ? def.some(hasArrayBuffer) : def === interfaces_1.Bin.Buffer;
}
exports.hasArrayBuffer = hasArrayBuffer;
var noop = function () { };
exports.noop = noop;
