import './common';
import { expect } from 'chai';
import { stub, spy, assert, match } from 'sinon';
import { MessageType } from '../packet/packetHandler';
import {
	ClientOptions, SocketClient, SocketServer, SocketService, createClientSocket, ClientErrorHandler
} from '../index';
import { cloneDeep } from '../common/utils';
import { createCodeGenHandlers } from '../codeGenHandler';

let lastWebSocket: MockWebSocket;

class MockWebSocket {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;
	readyState = MockWebSocket.OPEN;
	constructor(public url: string) {
		lastWebSocket = this;
	}
	onmessage(_message: any) { }
	onopen() { }
	onerror() { }
	onclose(_event: any) { }
	close() { }
	send() { }
}

interface Client extends SocketClient {
	test(): void;
	foo(): void;
}

interface Server extends SocketServer {
	test2(): void;
	foo(): Promise<any>;
	fooInProgress: boolean;
	foo2(): Promise<any>;
	foo3(): void;
}

[
	{ name: 'Code generation', codeGenHandler: createCodeGenHandlers() },
	{ name: 'Code mapping', codeGenHandler: undefined },
].forEach(({name, codeGenHandler }) => {
	describe(name, () => {
		describe('ClientSocket', () => {
			const location = { protocol: '', host: '' };
			const window = {
				addEventListener(_name: string, _callback: () => void) { },
				removeEventListener(_name: string, _callback: () => void) { }
			};
			const clientOptions: ClientOptions = {
				hash: '123',
				path: '/test',
				client: ['test', 'foo'],
				server: [
					'test2',
					['foo', { promise: true, progress: 'fooInProgress' }],
					['foo2', { promise: true, rateLimit: '1/s' }],
					['foo3', { rateLimit: '1/s' }],
				// '',
				// '',
				],
				clientPingInterval: 1000,
				requestParams: { foo: 'bar', x: 5 },
				reconnectTimeout: 1000, // prevent immediate reconnect changing lastWebSocket
			};

			let service: SocketService<Client, Server>;
			let errorHandler: ClientErrorHandler;

			function connectLastWebSocket() {
				lastWebSocket.onopen();
				lastWebSocket.onmessage({ data: JSON.stringify([MessageType.Version, 0, 0, '123']) });
			}

			before(() => {
				(<any>global).window = window;
				(<any>global).location = location;
				(<any>global).WebSocket = MockWebSocket;
			});

			beforeEach(() => {
				location.protocol = 'http:';
				location.host = 'example.com';
				window.addEventListener = () => { };
				window.removeEventListener = () => { };
				lastWebSocket = null as any;
				errorHandler = { handleRecvError() { } };

				service = createClientSocket<Client, Server>(clientOptions, undefined, errorHandler, undefined, undefined, codeGenHandler);
			});

			describe('connectionError', () => {
				it('should not be called if version is correct', () => {
					service.client.connectionError = () => { };
					const connectionError = stub(service.client, 'connectionError');
					service.connect();

					lastWebSocket.onmessage({ data: JSON.stringify([MessageType.Version, 0, 0, '123']) });

					assert.notCalled(connectionError);
				});

				it('should be called if version is incorrect', () => {
					service.client.connectionError = () => { };
					const connectionError = stub(service.client, 'connectionError');
					service.connect();

					lastWebSocket.onmessage({ data: JSON.stringify([MessageType.Version, 0, 0, '321']) });

					assert.calledOnce(connectionError);
				});

				it('should do nothing if there is no callback', () => {
					service.client.connectionError = undefined;
					service.connect();

					lastWebSocket.onmessage({ data: JSON.stringify([MessageType.Version, 0, 0, '321']) });
				});

				it('should report error', () => {
					service.client.connectionError = () => { };
					const connectionError = stub(service.client, 'connectionError');
					service.connect();

					lastWebSocket.onmessage({ data: JSON.stringify([MessageType.Error, 0, 0, 'foo']) });

					assert.calledWith(connectionError, 'foo');
				});
			});

			// describe('ping', () => {
			// 	it('should respond to empty message with ping', () => {
			// 		service.connect();
			// 		const send = stub(lastWebSocket, 'send');
			// 		lastWebSocket.onmessage({ data: JSON.stringify([MessageType.Version, 0, 0, '123']) });

			// 		lastWebSocket.onmessage({ data: '' });

			// 		assert.calledWith(send as any, '');
			// 	});

			// 	it('should not send ping if connection is not open', () => {
			// 		service.connect();
			// 		const send = stub(lastWebSocket, 'send');
			// 		lastWebSocket.onmessage({ data: JSON.stringify([MessageType.Version, 0, 0, '123']) });
			// 		lastWebSocket.readyState = WebSocket.CLOSED;

			// 		lastWebSocket.onmessage({ data: '' });

			// 		assert.notCalled(send);
			// 	});

			// 	it('should not respond to empty message with ping', () => {
			// 		service.connect();
			// 		const send = stub(lastWebSocket, 'send');
			// 		lastWebSocket.onmessage({ data: JSON.stringify([MessageType.Version, 0, 0, '123']) });

			// 		lastWebSocket.onmessage({ data: '' });
			// 		lastWebSocket.onmessage({ data: '' });

			// 		assert.notCalled(send);
			// 	});

			// 	it('should not respond to empty message with ping if version is not yet validated', () => {
			// 		service.connect();
			// 		const send = stub(lastWebSocket, 'send');

			// 		lastWebSocket.onmessage({ data: '' });

			// 		assert.notCalled(send);
			// 	});
			// });

			describe('connect()', () => {
				it('should create websocket with proper url', () => {
					service.connect();

					expect(lastWebSocket).not.undefined;
					expect(lastWebSocket.url).equal('ws://example.com/test?foo=bar&x=5&id=socket&bin=true&hash=123');
				});

				it('should use "/ws" as default path', () => {
					const options = cloneDeep(clientOptions);
					delete options.path;
					service = createClientSocket<Client, Server>(options, undefined, undefined, undefined, undefined, codeGenHandler);
					service.connect();

					expect(lastWebSocket.url).equal('ws://example.com/ws?foo=bar&x=5&id=socket&bin=true&hash=123');
				});

				it('should create websocket with SSL for HTTPS url', () => {
					location.protocol = 'https:';

					service.connect();

					expect(lastWebSocket.url).equal('wss://example.com/test?foo=bar&x=5&id=socket&bin=true&hash=123');
				});

				it('should add event listener for "beforeunload"', () => {
					const addEventListener = stub(window, 'addEventListener');

					service.connect();

					assert.calledOnce(addEventListener);
				});

				it('should add event listener that closes the socket', () => {
					const addEventListener = stub(window, 'addEventListener');
					service.connect();
					const close = stub(lastWebSocket, 'close');

					addEventListener.args[0][1]();
					lastWebSocket.onclose({});

					assert.calledOnce(close);
				});

				it('should add event listener that does nothing if not connected', () => {
					const addEventListener = stub(window, 'addEventListener');
					service.connect();
					const close = stub(lastWebSocket, 'close');

					lastWebSocket.onclose({});
					addEventListener.args[0][1]();

					assert.notCalled(close);
				});

				it('should do nothing on second call', () => {
					service.connect();
					service.connect();
				});
			});

			describe('disconnect()', () => {
				it('does nothing if not connected', () => {
					service.disconnect();
				});

				it('closes socket', () => {
					service.connect();
					const close = stub(lastWebSocket, 'close');
					lastWebSocket.onopen();
					lastWebSocket.onmessage({ data: JSON.stringify([MessageType.Version, 0, 0, '123']) });

					service.disconnect();

					assert.calledOnce(close);
				});

				it('does not close socket if not connected yet', () => {
					service.connect();
					const close = stub(lastWebSocket, 'close');

					service.disconnect();

					assert.notCalled(close);
				});

				it('closes socket as soon as it connects', () => {
					service.connect();
					const close = stub(lastWebSocket, 'close');

					service.disconnect();

					assert.notCalled(close);

					lastWebSocket.onopen();

					assert.calledOnce(close);
				});

				it('removes event listener for "beforeunload"', () => {
					service.connect();
					const removeEventListener = stub(window, 'removeEventListener');

					service.disconnect();

					assert.calledOnce(removeEventListener);
				});
			});

			describe('(not connected)', () => {
				it('rejects if called promise methods when not connected', async () => {
					await expect(service.server.foo()).rejectedWith('Not connected');
				});
			});

			describe('(connected)', () => {
				beforeEach(() => {
					service.connect();
					connectLastWebSocket();
				});

				it('has methods', () => {
					service.server.test2();
				});

				it('sends data to socket', () => {
					const send = stub(lastWebSocket, 'send');
					service.server.test2();

					assert.calledWith(send as any, JSON.stringify([0]));
				});

				it('rejects when rate limit is exceeded', async () => {
					service.server.foo2();
					await expect(service.server.foo2()).rejectedWith('Rate limit exceeded');
				});

				it('returns false when rate limit is exceeded', () => {
					service.server.foo3();
					expect(service.server.foo3()).false;
				});

				it('does not send request when rate limit is exceeded', () => {
					service.server.foo3();
					const send = stub(lastWebSocket, 'send');

					expect(service.server.foo3()).false;

					assert.notCalled(send);
				});

				it('rejects when rate limit is exceeded', async () => {
					service.server.foo2();
					await expect(service.server.foo2()).rejectedWith('Rate limit exceeded');
				});

				it('does not send request when rate limit is exceeded (promise)', async () => {
					service.server.foo2();
					const send = stub(lastWebSocket, 'send');

					await expect(service.server.foo2()).rejectedWith('Rate limit exceeded');

					assert.notCalled(send);
				});

				it('does not send data when socket readyState is not OPEN', () => {
					const send = stub(lastWebSocket, 'send');
					lastWebSocket.readyState = WebSocket.CLOSED;

					service.server.test2();

					assert.notCalled(send);
				});
			});

			describe('(websocket events)', () => {
				beforeEach(() => {
					service.connect();
				});

				describe('websocket.onopen() + *version packet', () => {
					it('sets isConnected to true', () => {
						connectLastWebSocket();

						expect(service.isConnected).true;
					});

					it('calls client.connected', () => {
						const connected = spy();
						service.client.connected = connected;

						connectLastWebSocket();

						assert.calledOnce(connected);
					});
				});

				describe('websocket.onclose()', () => {
					it('sets isConnected to false', () => {
						connectLastWebSocket();

						lastWebSocket.onclose({});

						expect(service.isConnected).false;
					});

					it('calls client.disconnected', () => {
						const disconnected = spy();
						service.client.disconnected = disconnected;
						connectLastWebSocket();

						lastWebSocket.onclose({ code: 1, reason: 'foo' });

						assert.calledOnce(disconnected);
						assert.calledWith(disconnected, 1, 'foo');
					});

					it('does not call client.disconnected if not connected', () => {
						const disconnected = spy();
						service.client.disconnected = disconnected;

						lastWebSocket.onclose({});

						assert.notCalled(disconnected);
					});

					it('rejects all pending promises', async () => {
						connectLastWebSocket();

						const promise = service.server.foo();

						lastWebSocket.onclose({});

						await expect(promise).rejectedWith('Disconnected');
					});
				});

				describe('websocket.onerror()', () => {
					it('does nothing', () => {
						lastWebSocket.onopen();

						lastWebSocket.onerror();
					});
				});

				describe('websocket.onmessage()', () => {
					it('calls received mesasge', () => {
						service.client.foo = () => { };
						const foo = stub(service.client, 'foo');
						connectLastWebSocket();

						lastWebSocket.onmessage({ data: '[1, 2]' });

						assert.calledWith(foo as any, 2);
					});

					it('resolves pending promise', async () => {
						connectLastWebSocket();

						const promise = service.server.foo();

						lastWebSocket.onmessage({ data: JSON.stringify([MessageType.Resolved, 1, 1, 'ok']) });

						const x = await promise;

						expect(x).equal('ok');
					});

					it('changes progress field', async () => {
						connectLastWebSocket();

						const promise = service.server.foo();

						expect(service.server.fooInProgress).true;

						lastWebSocket.onmessage({ data: JSON.stringify([MessageType.Resolved, 1, 1, 'ok']) });

						await promise;

						expect(service.server.fooInProgress).false;
					});

					it('rejects pending promise', async () => {
						connectLastWebSocket();

						const promise = service.server.foo();

						lastWebSocket.onmessage({ data: JSON.stringify([MessageType.Rejected, 1, 1, 'fail']) });

						await expect(promise).rejectedWith('fail');
					});

					it('passes error from packet recv method to error handler', () => {
						connectLastWebSocket();
						const handleRecvError = stub(errorHandler, 'handleRecvError');

						lastWebSocket.onmessage({ data: 'null' });

						assert.calledWith(handleRecvError, match.any, 'null');
					});

					it('does nothing for resolving non-existing promise', () => {
						connectLastWebSocket();

						service.server.foo();

						lastWebSocket.onmessage({ data: JSON.stringify([MessageType.Resolved, 1, 5, 'ok']) });
					});

					it('does nothing for rejecting non-existing promise', () => {
						connectLastWebSocket();

						service.server.foo();

						lastWebSocket.onmessage({ data: JSON.stringify([MessageType.Rejected, 1, 5, 'fail']) });
					});

					it('resolves promises with correct id', async () => {
						connectLastWebSocket();

						const promise1 = service.server.foo();
						const promise2 = service.server.foo();

						lastWebSocket.onmessage({ data: JSON.stringify([MessageType.Resolved, 1, 2, 'a']) });
						lastWebSocket.onmessage({ data: JSON.stringify([MessageType.Resolved, 1, 1, 'b']) });

						const [result1, result2] = await Promise.all([promise1, promise2]);

						expect(result1).equal('b');
						expect(result2).equal('a');
					});

					it('throws error if using default error handler', () => {
						service = createClientSocket<Client, Server>(clientOptions, undefined, undefined, undefined, undefined, codeGenHandler);
						service.connect();
						lastWebSocket.onopen();

						expect(() => lastWebSocket.onmessage({ data: 'null' })).throw();
					});
				});
			});
		});
	});
});

