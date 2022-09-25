// import { createServerHandler } from './common';
// import { assert, spy, SinonSpy } from 'sinon';
// import { Bin, ClientOptions, SocketService } from '../common/interfaces';
// import {
// 	Socket, Method, ClientExtensions, Server as ServerController,
// 	SocketClient, SocketServer, ErrorHandler, createClientSocket
// } from '../index';
// import { ServerHost, ServerOptions } from '../server/serverInterfaces';
// import { createServerHost } from '../server/serverSocket';

// const apply = (f: () => void) => f();

// @Socket({ path: '/ws/test', pingInterval: 100, debug: false, clientLimit: 2 })
// class Server implements SocketServer {
// 	constructor(public client: Client & ClientExtensions) { }
// 	@Method({ binary: [Bin.Str], ignore: true })
// 	hello(_message: string) { }
// 	@Method({ promise: true })
// 	login(login: string) {
// 		return login === 'ok' ? Promise.resolve(true) : Promise.reject(new Error('fail'));
// 	}
// 	@Method({ promise: true })
// 	nullReject() {
// 		return Promise.reject(null);
// 	}
// 	@Method()
// 	err() {
// 		throw new Error('err');
// 	}
// 	@Method()
// 	test(_message: string) {
// 	}
// 	@Method({ rateLimit: '1/s' })
// 	limited() {
// 		console.log('limited');
// 	}
// 	@Method({ rateLimit: '1/s', promise: true })
// 	limitedPromise() {
// 		return Promise.resolve();
// 	}
// 	@Method({ rateLimit: '1/s', promise: true, binary: [Bin.U16] })
// 	limitedPromiseBin(value: number) {
// 		return Promise.resolve(value);
// 	}
// 	@Method({ binary: [Bin.U8ArrayOffsetLength] })
// 	partialBuffer(_buffer: Uint8Array, _offset: number, _length: number) {
// 	}
// 	@Method({ binary: [Bin.DataViewOffsetLength] })
// 	partialDataView(_buffer: DataView, _offset: number, _length: number) {
// 	}
// 	connected() { }
// 	disconnected() { }
// }

// @Socket({ path: '/ws/omg' })
// class Server2 implements SocketServer {
// 	constructor(public client: Client & ClientExtensions) { }
// 	@Method({ ignore: true })
// 	hello(_message: string) { }
// }

// class Client implements SocketClient {
// 	@Method({ binary: [Bin.Str], ignore: true })
// 	bin(_message: string) { }
// 	@Method()
// 	hi(message: string) {
// 		console.log('hi', message);
// 	}
// 	@Method({ binary: [Bin.Buffer, [Bin.U8]] })
// 	bin2(_buffer: ArrayBuffer, _values: number[]) {
// 	}
// 	connected() { }
// 	disconnected() { }
// }
// Server2;

// describe('ClientSocket + Server', () => {
// 	let httpServer: ReturnType<typeof createServerHandler>;
// 	let server: Server;
// 	let serverHost: ServerHost;
// 	let serverSocket: ServerController;
// 	let clientSocket: SocketService<Client, Server>;
// 	let errorHandler: ErrorHandler;
// 	let connected: SinonSpy;
// 	let log: SinonSpy;
// 	// let version: SinonStub;

// 	function setupClient(options: ClientOptions, token?: string) {
// 		return new Promise<void>(resolve => {
// 			clientSocket = createClientSocket<Client, Server>(options, token, undefined, apply, log);
// 			// version = stub((<any>clientSocket).special, '*version');
// 			clientSocket.client = new Client();
// 			clientSocket.client.connected = () => resolve();
// 			clientSocket.connect();
// 		});
// 	}

// 	function setupServerClient(
// 		done: () => void, options: ServerOptions = {}, onClient: (options: ClientOptions, token?: string) => void = () => { }
// 	) {
// 		connected = spy();

// 		serverHost = createServerHost({ path: '/ws', errorHandler, log });
// 		serverSocket = serverHost.socket(Server, Client, c => {
// 			server = new Server(c);
// 			server.connected = connected as any;
// 			return server;
// 		}, options);

// 		const clientOptions = serverSocket.options();
// 		const token = options.connectionTokens ? serverSocket.token() : undefined;

// 		onClient(clientOptions, token);

// 		startListening()
// 			.then(() => setupClient(clientOptions, token))
// 			.then(done);
// 	}

// 	function closeServerClient(done: () => void) {
// 		clientSocket.disconnect();
// 		serverHost.close();
// 		httpServer.stop()
//         done();
// 	}

// 	function startListening() {
// 		return new Promise<void>(resolve => {
// 			httpServer.start();
//             resolve();
// 		});
// 	}

// 	beforeEach(() => {
// 		(global as any).window = { addEventListener() { }, removeEventListener() { } };
// 		(global as any).location = { protocol: 'http', host: `localhost:12345` };
// 		(global as any).WebSocket = WebSocket;

// 		log = spy();
// 		errorHandler = {
// 			handleError() { },
// 			handleRejection() { },
// 			handleRecvError() { },
// 		};

// 		httpServer = createServerHandler();
// 	});

// 	describe('(connection token)', () => {
// 		let clientOptions: ClientOptions;
// 		let clientToken: string;

// 		beforeEach(function (done) {
// 			setupServerClient(done, { connectionTokens: true, perMessageDeflate: false }, (opt, token) => {
// 				clientOptions = opt;
// 				clientToken = token!;
// 			});
// 		});

// 		afterEach(function (done) {
// 			closeServerClient(done);
// 		});

// 		it('connects with token', () => {
// 			assert.calledOnce(connected);
// 		});

// 		it('replaces user with the same token', () => {
// 			return setupClient(clientOptions, clientToken)
// 				.then(() => assert.calledTwice(connected));
// 		});
// 	});
// });
