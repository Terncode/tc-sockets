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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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O1lBQ0gsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUM7U0FDdkQ7UUFBQyxXQUFNLEdBQUc7S0FDWDtJQUVELE9BQU8sS0FBSyxDQUFDO0FBQ2QsQ0FBQztBQXRCRCx3Q0FzQkM7QUFRRCxTQUFnQixRQUFRO0lBQ3ZCLElBQU0sR0FBRyxHQUFnQixFQUFTLENBQUM7SUFFbkMsR0FBRyxDQUFDLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBSSxVQUFVLE9BQU8sRUFBRSxNQUFNO1FBQ3JELEdBQUcsQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3RCLEdBQUcsQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0lBQ3JCLENBQUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxHQUFHLENBQUM7QUFDWixDQUFDO0FBVEQsNEJBU0M7QUFFRCxTQUFnQixrQkFBa0IsQ0FBQyxNQUFpQjtJQUNuRCxPQUFPLE9BQU8sTUFBTSxLQUFLLFFBQVEsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFJLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDM0YsQ0FBQztBQUZELGdEQUVDO0FBRUQsU0FBZ0IsY0FBYyxDQUFDLEdBQW9CO0lBQ2xELE9BQU8sS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLGdCQUFHLENBQUMsTUFBTSxDQUFDO0FBQzNFLENBQUM7QUFGRCx3Q0FFQztBQUVNLElBQU0sSUFBSSxHQUFHLGNBQU8sQ0FBQyxDQUFDO0FBQWhCLFFBQUEsSUFBSSxRQUFZIiwiZmlsZSI6ImNvbW1vbi91dGlscy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE1ldGhvZERlZiwgQmluYXJ5RGVmLCBCaW4sIFJhdGVMaW1pdERlZiB9IGZyb20gJy4vaW50ZXJmYWNlcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRMZW5ndGgobWVzc2FnZTogYW55KTogbnVtYmVyIHtcblx0cmV0dXJuIChtZXNzYWdlID8gKG1lc3NhZ2UgYXMgc3RyaW5nIHwgQnVmZmVyKS5sZW5ndGggfHwgKG1lc3NhZ2UgYXMgQXJyYXlCdWZmZXIpLmJ5dGVMZW5ndGggOiAwKSB8IDA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBxdWVyeVN0cmluZyhwYXJhbXM6IGFueSkge1xuXHRjb25zdCBxdWVyeSA9IE9iamVjdC5rZXlzKHBhcmFtcyB8fCB7fSlcblx0XHQuZmlsdGVyKGtleSA9PiBwYXJhbXNba2V5XSAhPSBudWxsKVxuXHRcdC5tYXAoa2V5ID0+IGAke2tleX09JHtlbmNvZGVVUklDb21wb25lbnQocGFyYW1zW2tleV0pfWApXG5cdFx0LmpvaW4oJyYnKTtcblxuXHRyZXR1cm4gcXVlcnkgPyBgPyR7cXVlcnl9YCA6ICcnO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xvbmVEZWVwPFQ+KHZhbHVlOiBUKTogVCB7XG5cdHJldHVybiBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHZhbHVlKSk7XG59XG5cbmNvbnN0IHRpbWVzOiB7IFtrZXk6IHN0cmluZ106IG51bWJlcjsgfSA9IHtcblx0czogMTAwMCxcblx0bTogMTAwMCAqIDYwLFxuXHRoOiAxMDAwICogNjAgKiA2MCxcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVJhdGVMaW1pdCh2YWx1ZTogc3RyaW5nLCBleHRlbmRlZDogYm9vbGVhbikge1xuXHRjb25zdCBtID0gL14oXFxkKylcXC8oXFxkKyk/KFtzbWhdKSQvLmV4ZWModmFsdWUpO1xuXHRpZiAoIW0pIHRocm93IG5ldyBFcnJvcignSW52YWxpZCByYXRlIGxpbWl0IHZhbHVlJyk7XG5cblx0bGV0IGxpbWl0ID0gK21bMV07XG5cdGxldCBmcmFtZSA9ICsobVsyXSB8fCAnMScpICogdGltZXNbbVszXV07XG5cblx0aWYgKGV4dGVuZGVkICYmIGZyYW1lIDwgNTAwMCkge1xuXHRcdGxpbWl0ICo9IDI7XG5cdFx0ZnJhbWUgKj0gMjtcblx0fVxuXG5cdHJldHVybiB7IGxpbWl0LCBmcmFtZSB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tSYXRlTGltaXQzKGZ1bmNJZDogbnVtYmVyLCBjYWxsc0xpc3Q6IG51bWJlcltdLCBsaW1pdDogbnVtYmVyLCBmcmFtZTogbnVtYmVyKSB7XG5cdGNvbnN0IGluZGV4ID0gZnVuY0lkIDw8IDE7XG5cblx0d2hpbGUgKGNhbGxzTGlzdC5sZW5ndGggPD0gKGluZGV4ICsgMSkpIGNhbGxzTGlzdC5wdXNoKDApO1xuXG5cdGNvbnN0IGJ1Y2tldFRpbWUgPSBjYWxsc0xpc3RbaW5kZXhdO1xuXHRjb25zdCBidWNrZXRDb3VudCA9IGNhbGxzTGlzdFtpbmRleCArIDFdO1xuXHRjb25zdCB0aW1lID0gKERhdGUubm93KCkgLyBmcmFtZSkgfCAwO1xuXG5cdGlmIChidWNrZXRUaW1lID09PSB0aW1lKSB7XG5cdFx0aWYgKGJ1Y2tldENvdW50ID49IGxpbWl0KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNhbGxzTGlzdFtpbmRleCArIDFdID0gYnVja2V0Q291bnQgKyAxO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRjYWxsc0xpc3RbaW5kZXhdID0gdGltZTtcblx0XHRjYWxsc0xpc3RbaW5kZXggKyAxXSA9IDE7XG5cdH1cblxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNoZWNrUmF0ZUxpbWl0MihmdW5jSWQ6IG51bWJlciwgY2FsbHNMaXN0OiBudW1iZXJbXSwgcmF0ZXM6IChSYXRlTGltaXREZWYgfCB1bmRlZmluZWQpW10pIHtcblx0Y29uc3QgcmF0ZSA9IHJhdGVzW2Z1bmNJZF07XG5cdGlmICghcmF0ZSkgcmV0dXJuIHRydWU7XG5cblx0cmV0dXJuIGNoZWNrUmF0ZUxpbWl0MyhmdW5jSWQsIGNhbGxzTGlzdCwgcmF0ZS5saW1pdCwgcmF0ZS5mcmFtZSk7XG59XG5cbmxldCBzdXBwb3J0c0JpbmFyeVZhbHVlOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN1cHBvcnRzQmluYXJ5KCkge1xuXHRpZiAoc3VwcG9ydHNCaW5hcnlWYWx1ZSAhPSBudWxsKSB7XG5cdFx0cmV0dXJuIHN1cHBvcnRzQmluYXJ5VmFsdWU7XG5cdH1cblxuXHRjb25zdCBwcm90b2NvbCA9ICdodHRwczonID09PSBsb2NhdGlvbi5wcm90b2NvbCA/ICd3c3MnIDogJ3dzJztcblxuXHRpZiAodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgJiYgJ1dlYlNvY2tldCcgaW4gZ2xvYmFsKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRpZiAoJ1dlYlNvY2tldCcgaW4gd2luZG93KSB7XG5cdFx0aWYgKCdiaW5hcnlUeXBlJyBpbiBXZWJTb2NrZXQucHJvdG90eXBlKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuICEhKG5ldyBXZWJTb2NrZXQocHJvdG9jb2wgKyAnOi8vLicpLmJpbmFyeVR5cGUpO1xuXHRcdH0gY2F0Y2ggeyB9XG5cdH1cblxuXHRyZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGVmZXJyZWQ8VD4ge1xuXHRwcm9taXNlOiBQcm9taXNlPFQ+O1xuXHRyZXNvbHZlKHJlc3VsdDogVCk6IHZvaWQ7XG5cdHJlamVjdChlcnJvcj86IEVycm9yKTogdm9pZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZmVycmVkPFQ+KCk6IERlZmVycmVkPFQ+IHtcblx0Y29uc3Qgb2JqOiBEZWZlcnJlZDxUPiA9IHt9IGFzIGFueTtcblxuXHRvYmoucHJvbWlzZSA9IG5ldyBQcm9taXNlPFQ+KGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcblx0XHRvYmoucmVzb2x2ZSA9IHJlc29sdmU7XG5cdFx0b2JqLnJlamVjdCA9IHJlamVjdDtcblx0fSk7XG5cblx0cmV0dXJuIG9iajtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQmluYXJ5T25seVBhY2tldChtZXRob2Q6IE1ldGhvZERlZikge1xuXHRyZXR1cm4gdHlwZW9mIG1ldGhvZCAhPT0gJ3N0cmluZycgJiYgbWV0aG9kWzFdLmJpbmFyeSAmJiBoYXNBcnJheUJ1ZmZlcihtZXRob2RbMV0uYmluYXJ5KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhhc0FycmF5QnVmZmVyKGRlZjogQmluYXJ5RGVmIHwgQmluKTogYm9vbGVhbiB7XG5cdHJldHVybiBBcnJheS5pc0FycmF5KGRlZikgPyBkZWYuc29tZShoYXNBcnJheUJ1ZmZlcikgOiBkZWYgPT09IEJpbi5CdWZmZXI7XG59XG5cbmV4cG9ydCBjb25zdCBub29wID0gKCkgPT4ge307XG4iXSwic291cmNlUm9vdCI6Ii9ob21lL2FscGhhL0Rlc2t0b3AvZGV2L3RjLXNvY2tldHMvc3JjIn0=
