import { stub } from 'sinon';

import { TemplatedApp, WebSocketBehavior, HttpResponse, HttpRequest, us_socket_context_t, WebSocket, RecognizedString } from 'uWebSockets.js';
import { queryString } from '../common/utils';
const noop = (..._args: any): any => {};


let lastBehavior: WebSocketBehavior;
export function MockApp(): TemplatedApp {
	const mock: Partial<TemplatedApp> = {
		ws: (_pattern, behavior) => {
			lastBehavior = behavior;
			return mock as TemplatedApp;
		}
	};
	(mock as any).listen = (_port: any, cb: any) => {
		cb({} as any);
	};
	return mock as TemplatedApp;
}


export class MockWebSocket implements WebSocket {
	send(_message: RecognizedString, _isBinary?: boolean, _compress?: boolean) {
		return 1;
	}
	getBufferedAmount() {
		return 0;
	}
	end(_code?: number, _shortMessage?: RecognizedString) {}
	close = stub();
	ping(_message?: RecognizedString) {
		return 1;
	}
	subscribe(_topic: RecognizedString) {
		return true;
	}
	unsubscribe(_topic: RecognizedString)  {
		return true;
	}
	isSubscribed(_topic: RecognizedString) {
		return false;
	}
	getTopics() {
		return [];
	}
	publish(_topic: RecognizedString, _message: RecognizedString, _isBinary?: boolean, _compress?: boolean) {
		return true;
	}
	cork(_cb: () => void) {
		return this;
	}
	getRemoteAddress() {
		return new ArrayBuffer(0);
	}
	getRemoteAddressAsText() {
		return new ArrayBuffer(0);
	}
}

export function connect() {
	lastBehavior.close;

}

export function getLastBehavior() {
	return lastBehavior;
}

export function createUpgrade(onUpgrade?: (ws: WebSocket) => void, ws = new MockWebSocket(), bin = false, t?: string) {
	const res: HttpResponse = {
		close: noop,
		cork: noop,
		end: noop,
		getProxiedRemoteAddress: noop,
		getProxiedRemoteAddressAsText: noop,
		getRemoteAddress: noop,
		getRemoteAddressAsText: noop,
		getWriteOffset: noop,
		onAborted: noop,
		onData: noop,
		onWritable: noop,
		tryEnd: noop,
		upgrade: (_userData: any, _secWebSocketKey: RecognizedString, _secWebSocketProtocol: RecognizedString, _secWebSocketExtensions: RecognizedString, _context: us_socket_context_t) => {
			if (onUpgrade) {
				onUpgrade(ws);
			}
		},
		write: noop,
		writeHeader: noop,
		writeStatus: noop,
	};
	const query = queryString({ bin, t, hash: '123' });
	const req: HttpRequest = {
		forEach: (cb: (key: string, value: string) => void) => {
			const headers = [
				{ key: 'foo', value: 'bar' },
			];
			headers.forEach(header => cb(header.key, header.value));
		},
		getHeader: noop,
		getMethod: noop,
		getParameter: noop,
		getQuery: () => {
			return query.substring(1);
		},
		getUrl: () => {
			return '/test';
		},
		setYield: noop,
	};
	const context: us_socket_context_t = {

	};
	return { res, req, context };
}

export function connectClient(bin?: boolean, t?: string | undefined) {
	return new Promise<WebSocket>(r => {
		const behavior = getLastBehavior();
		const { res, req, context } = createUpgrade(ws => {
			r(ws);
			behavior.open!(ws);
		}, undefined, bin, t);
		behavior.upgrade!(res, req, context);
	});
}
