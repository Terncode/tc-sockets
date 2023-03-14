import { delay, stringToArrayBuffer } from './common';
// import * as http from 'http';
import { expect } from 'chai';
import { assert, stub, SinonFakeTimers, useFakeTimers, SinonStub, match } from 'sinon';
import {
	createServer, createServerRaw, ErrorHandler, Method, Socket,
	SocketClient, ClientExtensions, Bin, createServerHost, ServerHost } from '../index';
import { MockApp, connectClient, getLastBehavior, createUpgrade } from './uwsMock';
import { App, TemplatedApp } from 'uWebSockets.js';
import { us_listen_socket, us_listen_socket_close } from '../uws';
import { createClientOptions, randomString } from '../server/serverUtils';
import { MessageType } from '../packet/packetHandler';
import { createCodeGenHandlers } from '../codeGenHandler';

@Socket({})
class Server1 {
	constructor(public client: Client1 & SocketClient & ClientExtensions) { }
	connected() { }
	disconnected() { }
	@Method()
	hello(_message: string) { }
	@Method({ promise: true })
	login(_login: string) { return Promise.resolve(0); }
	@Method({ rateLimit: '1/s' })
	rate() { }
	@Method({ rateLimit: '1/s', promise: true })
	ratePromise() { return Promise.resolve(0); }
	@Method({ promise: true, binaryResult: true })
	binaryPromise() {
		return Promise.resolve(new Uint8Array([1, 2, 3, 4, 5]));
	}
}

@Socket()
class ServerThrowingOnConnected {
	constructor(public client: Client1 & SocketClient & ClientExtensions) {
	}
	connected() {
		throw new Error('failed to connect');
	}
	disconnected = stub() as any;
}

class Client1 {
	@Method()
	hi(_message: string) { }
	@Method({ binary: [Bin.U8] })
	bye(_value: number) { }
}

const CLIENT_OPTIONS = {
	id: 'socket',
	client: [
		'hi',
		['bye', { binary: [1] }],
	],
	path: '/ws',
	reconnectTimeout: 500,
	server: [
		'hello',
		['login', { promise: true }],
		['rate', { rateLimit: '1/s' }],
		['ratePromise', { rateLimit: '1/s', promise: true }],
		['binaryPromise', { promise: true, binaryResult: true }],
	],
	tokenLifetime: 3600000,
};

function bufferToArray(buffer: Buffer) {
	return Array.from(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
}

function emptyErrorHandler(): ErrorHandler {
	return {
		handleError() { },
		handleRecvError() { },
		handleRejection() { },
	};
}

function defaultErrorHandler(): ErrorHandler {
	return {
		handleError(...args: any[]) { console.error('handleError', ...args); },
		handleRecvError(...args: any[]) { console.error('handleRecvError', ...args); },
		handleRejection(...args: any[]) { console.error('handleRejection', ...args); },
	};
}

function withoutUndefinedProperties(obj: any) {
	return JSON.parse(JSON.stringify(obj));
}

//const ws = MockWebSocket as any;
[
	{ name: 'Code generation', codeGenHandler: createCodeGenHandlers() },
	{ name: 'Code mapping', codeGenHandler: undefined },
].forEach(({name, codeGenHandler }) => {
	describe(name, () => {
		describe('serverSocket', () => {
			describe('createServer() (real)', () => {
				let app: TemplatedApp;
				let stolenToken:  us_listen_socket | false | undefined;
				beforeEach(() => {
					app = App();

					// Cannot do this because Internal field out of bounds error
					// const serverListen = app.listen;
					// serverListen.bind(app);
					// app.listen = (port: any, cb: any) => {
					// 	serverListen(port, (token) => {
					// 		stolenToken = token;
					// 		cb(token);
					// 	});
					// 	return app;
					// };
				});

				afterEach(function (done) {
					if (stolenToken) {
						us_listen_socket_close(stolenToken);
						stolenToken = undefined;
					}
					done();
				});

				it('is able to start server', function (done) {
					createServer(app, Server1, Client1, c => new Server1(c), { path: '/test2' }, undefined, undefined, codeGenHandler);
					app.listen(12345, token => {
						stolenToken = token;
						if (token) {
							done();
						} else {
							done(new Error('Token was not received from uws app'));
						}
					});

				});

				it('is able to close server', function (done) {
					const socket = createServer(app, Server1, Client1, c => new Server1(c), { path: '/test2' }, undefined, undefined, codeGenHandler);
					app.listen(12345, (token) => {
						stolenToken = token;
						socket.close();
						done();
					});
				});

				it('throws if passed object with too many methods', () => {
					const Ctor: any = () => { };

					for (let i = 0; i < 251; i++) {
						Ctor.prototype[`foo${i}`] = () => { };
					}

					expect(() => createServer(app, Ctor, Ctor, () => null, { port: 12345 }, undefined, undefined, codeGenHandler)).throw('Too many methods');
				});
			});

			describe('createServer() (mock) (creation)', () => {
				it('createServerRaw() throws if passed empty client or server method definitions', () => {
					expect(() => createServerRaw(App(), c => new Server1(c), { client: [], server: null } as any))
						.throws('Missing server or client method definitions');
					expect(() => createServerRaw(App(), c => new Server1(c), { client: null, server: [] } as any))
						.throws('Missing server or client method definitions');
				});


				// There doesn't seems to be error handler in uws
				// it('handles server errors without error handler', () => {
				// 	createServer(App(), Server1, Client1, c => new Server1(c));
				// 	getLastServer().invoke('error', new Error('test'));
				// });

				it('passes request info to client if keepOriginalRequest option is true', async () => {
					let server1: Server1;
					createServer(MockApp(), Server1, Client1, c => server1 = new Server1(c), { keepOriginalRequest: true, hash: '123' }, undefined, undefined, codeGenHandler);
					connectClient();
					await delay(50);

					expect(server1!.client.originalRequest).eql({ url: '/test/?bin=false&hash=123', headers: { foo: 'bar' } });
				});

				it('does not pass request info to client if keepOriginalRequest option is not true', async () => {
					let server1: Server1;
					createServer(MockApp(), Server1, Client1, c => server1 = new Server1(c), { hash: '123' }, undefined, undefined, codeGenHandler);
					connectClient();

					await delay(50);

					expect(server1!.client.originalRequest).undefined;
				});

				it('handles async creation of server actions', async () => {
					let server1: Server1;
					createServer(MockApp(), Server1, Client1, c => Promise.resolve().then(() => server1 = new Server1(c)), { hash: '123' }, undefined, undefined, codeGenHandler);
					connectClient();


					await delay(50);

					expect(server1!).not.undefined;
				});

				it('closes connection if connected() handler threw an error', async () => {
					createServer(MockApp(), Server1, Client1, c => new ServerThrowingOnConnected(c) as any, { hash: '123' }, undefined, undefined, codeGenHandler);
					const socket = await connectClient();

					await delay(50);
					assert.calledOnce(socket.close as any);
				});

				describe('if token does not exist', () => {
					//let webSocket: MockWebSocket;
					let errorHandler: ErrorHandler;

					beforeEach(() => {
						createServer(MockApp(), Server1, Client1, c => new Server1(c), { connectionTokens: true, hash: '123' }, errorHandler = emptyErrorHandler(), undefined, codeGenHandler);
						//webSocket = new MockWebSocket();
						//(webSocket as any).upgradeReq.url = '?t=foobar&hash=123';
					});

					it('terminates connection', async () => {
						const { res, req, context} = createUpgrade();
						const terminate = stub(res, 'end');
						const behavior = getLastBehavior();
                        behavior.upgrade!(res, req, context);

                        assert.calledOnce(terminate);
					});

					it('reports error', async () => {
						const handleError = stub(errorHandler, 'handleError');

						const behavior = getLastBehavior();
						const { res, req, context} = createUpgrade();
                        behavior.upgrade!(res, req, context);

                        assert.calledOnce(handleError);
					});
				});

				describe('.token()', () => {
					it('returns new token string', () => {
						const socketServer = createServer(MockApp(), Server1, Client1, c => new Server1(c), { connectionTokens: true, hash: '123' }, undefined, undefined, codeGenHandler);

						expect(socketServer.token()).a('string');
					});

					it('passes custom token data to client', async () => {
						let server1: Server1;
						const data = {};
						const socketServer = createServer(MockApp(), Server1, Client1, c => server1 = new Server1(c), { connectionTokens: true, hash: '123' }, undefined, undefined, codeGenHandler);
						await connectClient(false, socketServer.token(data));

						await delay(50);

						expect(server1!.client.tokenData).equal(data);
					});
				});

				describe('.clearTokens()', () => {
					it('does nothing for no tokens and no clients', () => {
						const socketServer = createServer(MockApp(), Server1, Client1, c => new Server1(c), { connectionTokens: true, hash: '123' }, undefined, undefined, codeGenHandler);

						socketServer.clearTokens(() => true);
					});

					it('clears marked token', async () => {
						const socketServer = createServer(MockApp(), Server1, Client1, c => new Server1(c), { connectionTokens: true, hash: '123' }, undefined, undefined, codeGenHandler);
						const token = socketServer.token({ remove: true });

						socketServer.clearTokens((_, data) => data.remove);

						const { res, req, context} = createUpgrade();
						req.getQuery= () => `t=${token}`;
						const terminate = stub(res, 'end');
						const behavior = getLastBehavior();
                        behavior.upgrade!(res, req, context);

                        assert.calledOnce(terminate);
					});


					it('does not clear not marked token', () => {
						const socketServer = createServer(MockApp(), Server1, Client1, c => new Server1(c), { connectionTokens: true, hash: '123' }, undefined, undefined, codeGenHandler);
						const token = socketServer.token({ remove: false });

						socketServer.clearTokens((_, data) => data.remove);

						const { res, req, context} = createUpgrade();
						req.getQuery= () => `t=${token}`;
						const terminate = stub(res, 'end');
						const behavior = getLastBehavior();
                        behavior.upgrade!(res, req, context);

                        assert.notCalled(terminate);
					});

					it('disconnects client using marked token', async () => {
						const socketServer = createServer(MockApp(), Server1, Client1, c => new Server1(c), {connectionTokens: true, hash: '123' }, undefined, undefined, codeGenHandler);
						const token = socketServer.token({ remove: true });

						const { res, req, context} = createUpgrade();
						req.getQuery= () => `t=${token}`;
						const terminate = stub(res, 'end');
						const behavior = getLastBehavior();
                        behavior.upgrade!(res, req, context);

                        assert.notCalled(terminate);
					});
				});

				describe('(transfer limit)', () => {
					let errorHandler: ErrorHandler;
					let server: Server1;
					let clock: SinonFakeTimers | undefined;

					beforeEach(() => {
						clock = undefined;
						errorHandler = emptyErrorHandler();
						createServer(MockApp(), Server1, Client1, c => server = new Server1(c), { transferLimit: 1000, hash: '123' }, errorHandler, undefined, codeGenHandler);
					});

					afterEach(() => {
						clock && clock.restore();
					});

					it('calls method if not exceeding limit', async () => {
						const client = await connectClient();
						const hello = stub(server, 'hello');

						const beh = getLastBehavior();
                        beh.message!(client, stringToArrayBuffer('[0,"hello there"]'), false);

                        assert.calledWith(hello, 'hello there');
					});

					it('does not call method if exceeded limit (one message)', async () => {
						const client = await connectClient();
						const hello = stub(server, 'hello');

						const beh = getLastBehavior();
                        beh.message!(client, stringToArrayBuffer(`[0,"${randomString(1000)}"]`), false);

                        assert.notCalled(hello);
					});

					it('does not call method if exceeded limit (multiple messages)', async () => {
						const client = await connectClient();
						const hello = stub(server, 'hello');

						const beh = getLastBehavior();
						for (let i = 0; i < 10; i++) {
                            beh.message!(client, stringToArrayBuffer(`[0,"${randomString(100)}"]`), false);
						}

                        beh.message!(client, stringToArrayBuffer(`[0,"hi"]`), false);

                        assert.neverCalledWith(hello, 'hi');
					});

					it('reports error when limit is exceeded', async () => {
						const client = await connectClient();
						const handleRecvError = stub(errorHandler, 'handleRecvError');

						const beh = getLastBehavior();
                        beh.message!(client, stringToArrayBuffer(`[0,"${randomString(1000)}"]`), false);

                        assert.calledOnce(handleRecvError);
					});

					it('terminates socket connection when limit is exceeded', async () => {
						const client = await connectClient();

						const beh = getLastBehavior();
                        beh.message!(client, stringToArrayBuffer(`[0,"${randomString(1000)}"]`), false);

                        assert.calledOnce(client.close as any);
					});

					// TODO: fix
					it.skip('resets counter after a second', async () => {
						const client = await connectClient();
						const hello = stub(server, 'hello');

						clock = useFakeTimers();

						const beh = getLastBehavior();
                        beh.message!(client, stringToArrayBuffer(`[0,"${randomString(900)}"]`), false);

                        clock.tick(2000);

                        beh.message!(client, stringToArrayBuffer(`[0,"${randomString(900)}"]`), false);

                        assert.calledTwice(hello);
					});
				});
			});


			describe('createServer() (mock)', () => {
				const uwsApp = MockApp();

				// let server: TemplatedApp;
				// let serverSocket: TheServer;
				let serverHost: ServerHost;
				let errorHandler: ErrorHandler;
				let servers: Server1[] = [];
				let onServer: (s: Server1) => void;
				let onSend: SinonStub;
				let onRecv: SinonStub;

				async function connectClientAndSaveMessages(bin = false) {
					const client = await connectClient(bin);
					const result = { message: undefined as any };
					client.send = message => {
						result.message = message.slice(0);
						return 1;
					};
					return result;
				}

				beforeEach(() => {
					errorHandler = defaultErrorHandler();
					servers = [];
					onServer = s => servers.push(s);
					onSend = stub();
					onRecv = stub();
					serverHost = createServerHost(uwsApp, { path: '/test', perMessageDeflate: false, errorHandler });
					serverHost.socket(Server1, Client1, client => {
						const s = new Server1(client);
						onServer(s);
						return s;
					}, { path: '/test', perMessageDeflate: false, onSend, onRecv, development: true, hash: '123' });
					//server = getLastMockApp();
				});

				// Does not exist on uws app
				// it('passes http server to websocket server', () => {
				// 	expect(server.options.server).equal(uwsApp);
				// });

				// There no way to look up the path
				// 	it('passes path to websocket server', () => {
				// 		expect(server.options.path).equal('/foo');
				// 	});

				// Cannot get that either
				// it('passes perMessageDeflate option to websocket server', () => {
				//     expect(server.options.perMessageDeflate).false;
				// });

				it('connects client', async () => {
					await connectClient();
				});

				// no error handler on uws
				// it('reports socket server error', () => {
				// 	const error = new Error('test');
				// 	const handleError = stub(errorHandler, 'handleError');

				// 	server.invoke('error', error);


				// 	assert.calledWith(handleError, null, error);
				// });

				// 	it('reports socket error', async () => {
				// 		const client = await server.connectClient();
				// 		const error = new Error('test');
				// 		const handleError = stub(errorHandler, 'handleError');

				// 		client.invoke('error', error);

				// 		assert.calledWith(handleError, serverSocket.clients[0].client, error);
				// 	});

				// it('terminates and reports connection error if failed to attach events', async () => {
				// 	const client = new MockWebSocket();
				// 	const error = new Error('test');
				// 	stub(client, 'on').throws(error);
				// 	const terminate = stub(client, 'terminate');
				// 	const handleError = stub(errorHandler, 'handleError');

				// 	server.invoke('connection', client);

				// 	await delay(5);

				// 	assert.calledOnce(terminate);
				// 	assert.calledWith(handleError, match.any, error);
				// });

				it('reports exception from server.connected()', async () => {
					const error = new Error('test');
					onServer = s => stub(s, 'connected').throws(error);
					const handleError = stub(errorHandler, 'handleError');

					await connectClient();

					assert.calledWithMatch(handleError as any, match.any, error);
				});

				it('reports rejection from server.connected()', async () => {
					const error = new Error('test');
					onServer = s => stub(s, 'connected').rejects(error);
					const handleError = stub(errorHandler, 'handleError');

					await connectClient();

					await Promise.resolve();
					assert.calledWithMatch(handleError as any, match.any, error);
				});

				it('reports exception from server.disconnected()', async () => {
					const error = new Error('test');
					onServer = s => stub(s, 'disconnected').throws(error);
					const handleError = stub(errorHandler, 'handleError');
					const client = await connectClient();

					const bh = getLastBehavior();
                    bh.close!(client, -1, new ArrayBuffer(1));

                    assert.calledWithMatch(handleError as any, match.any, error);
				});

				it('reports rejection from server.disconnected()', async () => {
					const error = new Error('test');
					onServer = s => stub(s, 'disconnected').rejects(error);
					const handleError = stub(errorHandler, 'handleError');
					const client = await connectClient();

					const bh = getLastBehavior();
                    bh.close!(client, -1, new ArrayBuffer(1));

                    await Promise.resolve();

                    assert.calledWithMatch(handleError as any, match.any, error);
				});

				it('does not handle any messages after socket is closed', async () => {
					const client = await connectClient();
					const hello = stub(servers[0], 'hello');

					const bh = getLastBehavior();
                    bh.close!(client, -1, new ArrayBuffer(1));


                    expect(() => {
                        bh.message!(client, stringToArrayBuffer('[0,"test"]'), false);
                    }).throw();

                    assert.notCalled(hello);
				});

				it('handles message from client', async () => {
					const client = await connectClient();
					const hello = stub(servers[0], 'hello');

					const bh = getLastBehavior();
                    bh.message!(client, stringToArrayBuffer('[0,"test"]'), false);

                    assert.calledWith(hello, 'test');
				});

				it('reports received packet to onRecv hook', async () => {
					const client = await connectClient();

					const bh = getLastBehavior();
                    bh.message!(client, stringToArrayBuffer('[0,"test"]'), false);

                    assert.calledWithMatch(onRecv, 0, 'hello', 10, false);
				});

				it('sends promise result back to client', async () => {
					const client = await connectClient();
					const send = stub(client, 'send');
					stub(servers[0], 'login').resolves({ foo: 'bar' } as any);

					const bh = getLastBehavior();
                    bh.message!(client, stringToArrayBuffer('[1, "test"]'), false);

                    await delay(10);

                    assert.calledWith(send, JSON.stringify([MessageType.Resolved, 1, 1, { foo: 'bar' }]));
				});

				it('sends promise result back to client as binary', async () => {
					const client = await connectClient();
					const send = stub(client, 'send');

					const bh = getLastBehavior();
                    bh.message!(client, stringToArrayBuffer('[4]'), false);

                    await delay(10);

                    assert.calledWith(send, Buffer.from([0xfe, 0x04, 0x01, 0x00, 0x00, 0x00, 0x04, 0x06, 0x01, 0x02, 0x03, 0x04, 0x05]));
				});

				it('sends message to client (JSON)', async () => {
					const client = await connectClient();
					const send = stub(client, 'send');

					servers[0].client.hi('boop');

					assert.calledWith(send, '[0,"boop"]');
				});

				it('sends message to client (binary)', async () => {
					const send = await connectClientAndSaveMessages(true);

					servers[0].client.bye(5);

					expect(bufferToArray(send.message)).eql([1, 5]);
				});

				it('reports sent packet to onSend hook', async () => {
					await connectClient(true);

					servers[0].client.bye(5);

					expect(onSend.args[1]).eql([1, 'bye', 2, true]);
				});
				describe('(rate limit)', () => {
					let handleRecvError: SinonStub<any>;
					let handleRejection: SinonStub<any>;

					beforeEach(() => {
						handleRecvError = stub(errorHandler, 'handleRecvError');
						handleRejection = stub(errorHandler, 'handleRejection');
					});

					it('does not call method if rate limit is exceeded', async () => {
						const client = await connectClient();
						const rate = stub(servers[0]!, 'rate');

						const bh = getLastBehavior();
                        bh.message!(client, stringToArrayBuffer('[2]'), false);
                        bh.message!(client, stringToArrayBuffer('[2]'), false);
                        bh.message!(client, stringToArrayBuffer('[2]'), false);

                        assert.calledTwice(rate);
					});

					it('logs recv error if rate limit is exceeded', async () => {
						const client = await connectClient();

						const bh = getLastBehavior();
                        bh.message!(client, stringToArrayBuffer('[2]'), false);
                        bh.message!(client, stringToArrayBuffer('[2]'), false);
                        bh.message!(client, stringToArrayBuffer('[2]'), false);

                        assert.calledOnce(handleRecvError);
					});

					it('sends reject if rate limit is exceeded on method with promise', async () => {
						const client = await connectClient();
						const send = stub(client, 'send');
						const data = JSON.stringify([MessageType.Rejected, 3, 3, 'Rate limit exceeded']);

						const bh = getLastBehavior();
                        bh.message!(client, stringToArrayBuffer('[3]'), false);
                        bh.message!(client, stringToArrayBuffer('[3]'), false);
                        bh.message!(client, stringToArrayBuffer('[3]'), false);

                        await delay(10);

                        assert.calledWith(send, data);
					});

					it('logs rejection error if rate limit is exceeded on method with promise', async () => {
						const client = await connectClient();

						const bh = getLastBehavior();
                        bh.message!(client, stringToArrayBuffer('[3]'), false);
                        bh.message!(client, stringToArrayBuffer('[3]'), false);
                        bh.message!(client, stringToArrayBuffer('[3]'), false);

                        await delay(10);
                        assert.calledOnce(handleRejection);
					});
				});
				// cannot test that since us_listen_socket_close is global method that cannot be overwritten
				// describe('.close()', () => {
				//     it('closes web socket server', () => {
				//         const close = stub(getLastServer(), 'close');
				//         us_listen_socket_close
				//         serverHost.close();

				//         assert.calledOnce(close);
				//     });
				// });

				describe('.options()', () => {
					it('returns socket options', () => {
						const socketServer = createServer(MockApp(), Server1, Client1, c => new Server1(c), undefined, undefined, undefined, codeGenHandler);

						const options = socketServer.options();

						expect(withoutUndefinedProperties(options)).eql(Object.assign({ hash: options.hash }, CLIENT_OPTIONS));
					});
				});
			});


			// Cannot be tested since verifyClient isn't available
			// describe('createServer() (verifyClient hook)', () => {
			// 		function create(options: ServerOptions, errorHandler?: ErrorHandler) {
			// 		createServer(MockApp(), Server1, Client1, c => new Server1(c), { hash: '123', ...options }, errorHandler);
			// 		return getLastBehavior();
			// 	}

			// 	// function verify(server: MockWebSocketServer, info: any = { req: {} }) {
			// 	// 	const verifyClient = server.options.verifyClient!;
			// 	// 	let result = false;
			// 	// 	verifyClient(info, x => result = x);
			// 	// 	return result;
			// 	// }

			// 	// it('returns true by default', () => {
			// 	// 	const server = create({ });

			// 	// 	expect(verify(server)).true;
			// 	// });

			// 	it('passes request to custom verifyClient', () => {
			// 		const verifyClient = spy();
			// 		const server = create({ verifyClient });
			// 		const req = {};

			// 		verify(server, { req });
			// 		assert.calledWith(verifyClient, req);
			// 	});

			// 	it('returns false if custom verifyClient returns false', () => {
			// 		const verifyClient = stub().returns(false);
			// 		const server = create({ verifyClient });

			// 		expect(verify(server)).false;
			// 	});

			// 	it('returns true if custom verifyClient returns true', () => {
			// 		const verifyClient = stub().returns(true);
			// 		const server = create({ verifyClient });

			// 		expect(verify(server)).true;
			// 	});

			// 	it('returns false if client limit is reached', async () => {
			// 		const server = create({ clientLimit: 1 });
			// 		await server.connectClient();

			// 		expect(verify(server)).false;
			// 	});

			// 	it('returns false if custom verifyClient throws an error', () => {
			// 		const verifyClient = stub().throws(new Error('test'));
			// 		const server = create({ verifyClient });

			// 		expect(verify(server)).false;
			// 	});

			// 	it('reports error if custom verifyClient throws an error', () => {
			// 		const error = new Error('test');
			// 		const errorHandler: any = { handleError() { } };
			// 		const handleError = stub(errorHandler, 'handleError');
			// 		const verifyClient = stub().throws(error);
			// 		const server = create({ verifyClient }, errorHandler);

			// 		verify(server);
			// 		assert.calledWith(handleError, null, error);
			// 	});
			// });

			describe('createClientOptions()', () => {
				it('returns client options', () => {
					const options = createClientOptions(Server1, Client1, { id: 'socket' });

					expect(withoutUndefinedProperties(options)).eql({ hash: options.hash, ...CLIENT_OPTIONS });
				});
			});
		});

	});
});
