// import { stub } from 'sinon';
// import { queryString } from '../common/utils';
// import { delay } from './common';

import { TemplatedApp, WebSocketBehavior, HttpResponse, HttpRequest, us_socket_context_t, WebSocket, RecognizedString } from 'uWebSockets.js';
import { randomString } from '../server/serverUtils';

// let lastServer: MockWebSocketServer;

// export class MockEventEmitter {
// 	private handlers: { event: string; handler: Function; }[] = [];
// 	on(event: string, handler: Function) {
// 		this.handlers.push({ event, handler });
// 		return this;
// 	}
// 	invoke(event: string, ...args: any[]) {
// 		this.handlers.filter(x => x.event === event).forEach(x => x.handler(...args));
// 	}
// }

let lastBehavior: WebSocketBehavior;

export function MockApp(): TemplatedApp {
	const mock: Partial<TemplatedApp> = {
		ws: (_pattern, behavior) => {
			lastBehavior = behavior;
			return mock as TemplatedApp;
		}
	};

	return mock as TemplatedApp;
}


export class MockWebSocket {
	socket: WebSocket | undefined;

	constructor(private lastBehavior: WebSocketBehavior) {

	}

	connect(url: string, mockSocket?: WebSocket) {
		return new Promise<void>((resolve, reject) => {
			const urlObj = new URL(url);
			mockSocket = mockSocket && {
				close() {
					reject();
				},
				end() {
					reject();
				},
				send(_message: RecognizedString, _isBinary?: boolean, _compress?: boolean) {
					return 1;
				},
			} as WebSocket;
			this.socket = mockSocket as WebSocket;
			const res: Partial<HttpResponse> = {
				upgrade() {
					resolve();
					this.lastBehavior.open(mockSocket);
				}
			};
			const mockHeaders = new Map();
			mockHeaders.set('connection', 'upgrade');
			mockHeaders.set('date', new Date().toUTCString());
			mockHeaders.set('sec-WebSocket-Accept', randomString(28));
			mockHeaders.set('sec-webSocket-version', 13);
			mockHeaders.set('upgrade', 'websocket');

			const req: Partial<HttpRequest> = {
				forEach(cb) {
					mockHeaders.forEach((value, key) => {
						cb(key, value);
					});
				},
				getHeader(key: RecognizedString) {
					return mockHeaders.get(key) || '';
				},
				getQuery() {
					return urlObj.search;
				},
				getUrl() {
					return urlObj.origin;
				}
			};
			const context: us_socket_context_t = {

			};
			if(this.lastBehavior.upgrade) {
				this.lastBehavior.upgrade(res as HttpResponse, req as HttpRequest, context);
			} else if (this.lastBehavior.open) {
				this.lastBehavior.open(mockSocket as WebSocket);
			}
		});
	}

}

export function connect() {
	lastBehavior.close;

}

// export class MockWebSocketServer extends MockEventEmitter {
// 	constructor(public options: any) {
// 		super();
// 		lastServer = this;
// 	}
// 	close() { }
// 	// mock helpers
// 	async connectClient(bin = false, t?: string) {
// 		const client = new MockWebSocket();
// 		client.upgradeReq.url = `ws://test/${queryString({ bin, t, hash: '123' })}`;
// 		this.invoke('connection', client);
// 		await delay(1);
// 		return client;
// 	}
// 	async connectWebSocket(socket: MockWebSocket) {
// 		this.invoke('connection', socket);
// 		return socket;
// 	}
// 	async connectClients(count: number) {
// 		const result: MockWebSocket[] = [];

// 		for (let i = 0; i < count; i++) {
// 			result.push(await this.connectClient());
// 		}

// 		return result;
// 	}
// }

// export class MockWebSocket extends MockEventEmitter {
// 	static Server = MockWebSocketServer;
// 	upgradeReq = { url: '?hash=123', headers: { foo: 'bar' } };
// 	constructor() {
// 		super();
// 	}
// 	terminate() { }
// 	close = stub() as any;
// 	send(_message: any) { }
// }

// export function getLastServer() {
// 	return lastServer;
// }
