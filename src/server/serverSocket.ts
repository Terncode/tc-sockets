import { ClientOptions, getNames, SocketServer, Logger } from '../common/interfaces';
import { getLength, cloneDeep, checkRateLimit2 } from '../common/utils';
import { ErrorHandler, OriginalRequest } from './server';
import { MessageType, Send, createPacketHandler, HandleResult, HandlerOptions } from '../packet/packetHandler';
import {
	Server, ClientState, InternalServer, GlobalConfig, ServerHost, CreateServerMethod, CreateServer, ServerOptions, UWSSocketEvents, ServerAppOption, PortOption
} from './serverInterfaces';
import {
	hasToken, createToken, getToken, getTokenFromClient, returnTrue, createOriginalRequest, defaultErrorHandler,
	createServerOptions, optionsWithDefaults, toClientOptions, getQuery, callWithErrorHandling, parseRateLimitDef,
} from './serverUtils';
import { BinaryReader, createBinaryReaderFromBuffer, getBinaryReaderBuffer, readString } from '../packet/binaryReader';
import { App, DISABLED, HttpRequest, SHARED_COMPRESSOR, us_listen_socket, us_listen_socket_close, WebSocket } from 'uWebSockets.js';
import * as HTTP from 'http';

export function createServer<TServer, TClient>(
	serverType: new (...args: any[]) => TServer,
	clientType: new (...args: any[]) => TClient,
	createServer: CreateServer<TServer, TClient>,
	options?: ServerOptions,
	errorHandler?: ErrorHandler,
	log?: Logger
) {
	return createServerRaw(createServer as CreateServerMethod, createServerOptions(serverType, clientType, options), errorHandler, log);
}

export function createServerRaw(
	createServer: CreateServerMethod, options: ServerOptions,
	errorHandler?: ErrorHandler, log?: Logger
): Server {
	const host = createServerHost({
		path: options.path,
		errorHandler,
		log,
		port: (options as PortOption).port,
		app: (options as ServerAppOption).app,
		perMessageDeflate: options.perMessageDeflate,
		compression: options.compression,
	});
	const socket = host.socketRaw(createServer, { id: 'socket', ...options });
	socket.close = host.close;
	return socket;
}

export function createServerHost(globalConfig: GlobalConfig): ServerHost {
	if(!(globalConfig as ServerAppOption).app && !(globalConfig as PortOption).port) {
		throw new Error('Port or uWebSockets.js app not provided');
	}
	if((globalConfig as ServerAppOption).app && (globalConfig as PortOption).port) {
		throw new Error('Provide port or uWebSockets.js app but not both');
	}
	const uwsApp = (globalConfig as ServerAppOption).app || App();
	const {
		path = '/ws',
		log = console.log.bind(console),
		errorHandler = defaultErrorHandler,
		perMessageDeflate = true,
		errorCode = 400,
		errorName = HTTP.STATUS_CODES[400] as string,
		nativePing = 0,
	} = globalConfig;
	const servers: InternalServer[] = [];

	let upgradeReq: OriginalRequest | undefined;
	let connectedSockets = new Map<WebSocket, UWSSocketEvents>();
	uwsApp.ws(path, {
		compression: globalConfig.compression ? globalConfig.compression : (perMessageDeflate ? SHARED_COMPRESSOR : DISABLED),
		sendPingsAutomatically: !!nativePing,
		idleTimeout: nativePing ? nativePing : undefined,

		upgrade: (res, req, context) => {
			if (upgradeReq) {
				res.end(`HTTP/1.1 ${503} ${HTTP.STATUS_CODES[503]}\r\n\r\n`);
				return;
			}
			let aborted = false;
			res.onAborted(() => {
				aborted = true;
			});
			const url = req.getUrl();
			const secWebSocketKey = req.getHeader('sec-websocket-key');
			const secWebSocketProtocol = req.getHeader('sec-websocket-protocol');
			const secWebSocketExtensions = req.getHeader('sec-websocket-extensions');

			if (globalConfig.path && globalConfig.path !== url.split('?')[0].split('#')[0]) {
				res.end(`HTTP/1.1 ${400} ${HTTP.STATUS_CODES[400]}\r\n\r\n`);
				return;
			}

			const originalRequest = createOriginalRequest(req);
			verifyClient(req, (result, code, name) => {
				if (aborted) return;
				if (result) {
					upgradeReq = originalRequest;
					try {
						res.upgrade({url},
							secWebSocketKey,
							secWebSocketProtocol,
							secWebSocketExtensions,
							context);
					} catch (error) {
						console.error(error);
					}
				} else {
					res.end(`HTTP/1.1 ${code} ${name}\r\n\r\n`);
				}
			});
		},
		open: (ws) => {
			if (!upgradeReq) {
				ws.close();
				return;
			}
			const uwsSocketEvents: UWSSocketEvents = {
				socket: ws,
				onClose: () => {},
				onMessage: () => {},
				isClosed: false,
			};
			connectSocket(upgradeReq, uwsSocketEvents);

			connectedSockets.set(ws, uwsSocketEvents);
			upgradeReq = undefined;
		},
		message(ws, message, isBinary) {
			connectedSockets.get(ws)!.onMessage(message, isBinary);
		},
		close(ws, code, message) {
			const events = connectedSockets.get(ws)!;
			if (events) {
				events.isClosed = true;//
				events.onClose(code, message);
				connectedSockets.delete(ws);
			}
		},
	});

	let socketToken: us_listen_socket | undefined;
	if ((globalConfig as PortOption).port) {
		const port = (globalConfig as PortOption).port;
		uwsApp.listen(port, token => {
			if (token) {
				socketToken = token;
			} else {
				errorHandler.handleError(null, new Error(`Failed to listen to port ${port}`));
			}
		});
	}

	function getServer(id: any) {
		if (servers.length === 1) return servers[0];

		for (const server of servers) {
			if (server.id === id) return server;
		}

		throw new Error(`No server for given id (${id})`);
	}

	function verifyClient(req : HttpRequest, next: (result: any, code: number, name: string) => void) {
		try {
			const query = getQuery(req.getUrl());
			const server = getServer(query.id);

			if (!server.verifyClient(req)) {
				next(false, errorCode, errorName);
			} else if (server.clientLimit !== 0 && server.clientLimit <= server.clients.length) {
				next(false, errorCode, errorName);
			} else if (server.connectionTokens) {
				if (hasToken(server, query.t)) {
					next(true, 200, 'OK');
				} else {
					next(false, errorCode, errorName);
				}
			} else {
				next(true, 200, 'OK');
			}
		} catch (e) {
			errorHandler.handleError(null, e);
			next(false, errorCode, errorName);
		}
	}

	function close() {
		servers.forEach(closeServer);
		connectedSockets.forEach((_, socket) => socket.end());
		if (socketToken) {
			us_listen_socket_close(socketToken);
			socketToken = undefined;
		}
	}

	function closeAndRemoveServer(server: InternalServer) {
		closeServer(server);
		const index = servers.indexOf(server);
		if (index !== -1) servers.splice(index, 1);
	}

	function socket<TServer, TClient>(
		serverType: new (...args: any[]) => TServer,
		clientType: new (...args: any[]) => TClient,
		createServer: CreateServer<TServer, TClient>,
		baseOptions?: ServerOptions
	): Server {
		const options = createServerOptions(serverType, clientType, baseOptions);
		return socketRaw(createServer as CreateServerMethod, options);
	}

	function socketRaw(createServer: CreateServerMethod, options: ServerOptions): Server {
		const internalServer = createInternalServer(createServer, { ...options, path }, errorHandler, log);

		if (servers.some(s => s.id === internalServer.id)) {
			throw new Error('Cannot open two sockets with the same id');
		}

		servers.push(internalServer);
		internalServer.server.close = () => closeAndRemoveServer(internalServer);
		return internalServer.server;
	}

	function connectSocket(originalRequest: OriginalRequest, socketEvents: UWSSocketEvents) {
		try {
			const query = getQuery(originalRequest.url);
			const server = getServer(query.id);

			connectClient(server, originalRequest, errorHandler, log, socketEvents);
		} catch (e) {
			if (!socketEvents.isClosed) {
				socketEvents.socket.end();
			}
			errorHandler.handleError(null, e);
		}
	}

	return { close, socket, socketRaw, app: uwsApp };
}

function createInternalServer(
	createServer: CreateServerMethod, options: ServerOptions, errorHandler: ErrorHandler, log: Logger,
): InternalServer {
	options = optionsWithDefaults(options);

	const onSend = options.onSend;
	const handlerOptions: HandlerOptions = {
		debug: options.debug,
		development: options.development,
		forceBinary: options.forceBinary,
		forceBinaryPackets: options.forceBinaryPackets,
		onSend,
		onRecv: options.onRecv,
		useBuffer: true,
	};

	const packetHandler = createPacketHandler(options.server, options.client, handlerOptions, log);
	const clientOptions = toClientOptions(options);
	const clientMethods = getNames(options.client!);
	const server: InternalServer = {
		id: options.id ?? 'socket',
		clients: [],
		freeTokens: new Map(),
		clientsByToken: new Map(),
		totalSent: 0,
		totalReceived: 0,
		currentClientId: options.clientBaseId ?? 1,
		path: options.path ?? '',
		hash: options.hash ?? '',
		debug: !!options.debug,
		forceBinary: !!options.forceBinary,
		connectionTokens: !!options.connectionTokens,
		keepOriginalRequest: !!options.keepOriginalRequest,
		errorIfNotConnected: !!options.errorIfNotConnected,
		tokenLifetime: options.tokenLifetime ?? 0,
		clientLimit: options.clientLimit ?? 0,
		transferLimit: options.transferLimit ?? 0,
		verifyClient: options.verifyClient ?? returnTrue,
		createClient: options.createClient,
		serverMethods: options.server!,
		clientMethods,
		rateLimits: options.server!.map(parseRateLimitDef),
		handleResult,
		createServer,
		packetHandler,
		server: {} as any,
		pingInterval: undefined,
		tokenInterval: undefined,
	};

	function handleResult(send: Send, obj: ClientState, funcId: number, funcName: string, result: Promise<any>, messageId: number) {
		if (result && typeof result.then === 'function') {
			result.then(result => {
				if (obj.client.isConnected()) {
					packetHandler.sendString(send, `*resolve:${funcName}`, MessageType.Resolved, [funcId, messageId, result]);
				}
			}, (e: Error) => {
				e = errorHandler.handleRejection(obj.client, e) || e;
				if (obj.client.isConnected()) {
					packetHandler.sendString(send, `*reject:${funcName}`, MessageType.Rejected, [funcId, messageId, e ? e.message : 'error']);
				}
			}).catch((e: Error) => errorHandler.handleError(obj.client, e));
		}
	}

	const pingInterval = options.pingInterval;

	if (pingInterval) {
		server.pingInterval = setInterval(() => {
			const now = Date.now();
			const threshold = now - pingInterval;
			const timeoutThreshold = now - options.connectionTimeout!;

			for (let i = 0; i < server.clients.length; i++) {
				const c = server.clients[i];

				try {
					if (c.lastMessageTime < timeoutThreshold) {
						c.client.disconnect(true, false, 'timeout');
					} else if (c.lastSendTime < threshold) {
						c.ping();
						if (onSend) onSend(-1, 'PING', 0, false);
					}
				} catch { }
			}
		}, pingInterval);
	}

	if (options.connectionTokens) {
		server.tokenInterval = setInterval(() => {
			const now = Date.now();
			const ids: string[] = [];

			server.freeTokens.forEach(token => {
				if (token.expire < now) {
					ids.push(token.id);
				}
			});

			for (const id of ids) {
				server.freeTokens.delete(id);
			}
		}, 10000);
	}

	server.server = {
		get clients() {
			return server.clients;
		},
		close() {
			closeServer(server);
		},
		options(): ClientOptions {
			return cloneDeep(clientOptions);
		},
		token(data?: any) {
			return createToken(server, data).id;
		},
		clearToken(id: string) {
			server.freeTokens.delete(id);
			server.clientsByToken.get(id)?.client.disconnect(true, true, 'clear tokens');
		},
		clearTokens(test: (id: string, data?: any) => boolean) {
			const ids: string[] = [];

			server.freeTokens.forEach(token => {
				if (test(token.id, token.data)) {
					ids.push(token.id);
				}
			});

			server.clientsByToken.forEach(({ token }) => {
				if (token && test(token.id, token.data)) {
					ids.push(token.id);
				}
			});

			for (const id of ids) {
				this.clearToken(id);
			}
		},
		info() {
			const writerBufferSize = packetHandler.writerBufferSize();
			const freeTokens = server.freeTokens.size;
			const clientsByToken = server.clientsByToken.size;
			return { writerBufferSize, freeTokens, clientsByToken };
		},
	};

	return server;
}

function closeServer(server: InternalServer) {
	if (server.pingInterval) {
		clearInterval(server.pingInterval);
		server.pingInterval = undefined;
	}

	if (server.tokenInterval) {
		clearInterval(server.tokenInterval);
		server.tokenInterval = undefined;
	}
}

function connectClient(
	server: InternalServer, originalRequest: OriginalRequest, errorHandler: ErrorHandler, log: Logger,
	uwsSocketEvents: UWSSocketEvents
) {
	const socket = uwsSocketEvents.socket;
	const query = getQuery(originalRequest.url);
	const t = (query.t || '') as string;
	const token = server.connectionTokens ? getToken(server, t) || getTokenFromClient(server, t) : undefined;

	if (server.hash && query.hash !== server.hash) {
		if (server.debug) log('client disconnected (hash mismatch)');

		socket.send(JSON.stringify([MessageType.Version, server.hash]));
		if (!uwsSocketEvents.isClosed) {
			socket.end();
		}
		return;
	}

	if (server.connectionTokens && !token) {
		errorHandler.handleError({ originalRequest } as any, new Error(`Invalid token: ${t}`));
		if (!uwsSocketEvents.isClosed) {
			uwsSocketEvents.socket.end();
		}
		return;
	}

	const callsList: number[] = [];
	const { handleResult, createClient = x => x } = server;

	let bytesReset = Date.now();
	let bytesReceived = 0;
	let transferLimitExceeded = false;
	let isConnected = true;
	let serverActions: SocketServer | undefined = undefined;
	let closeReason: string | undefined = undefined;

	const obj: ClientState = {
		lastMessageTime: Date.now(),
		lastMessageId: 0,
		lastSendTime: Date.now(),
		sentSize: 0,
		supportsBinary: !!server.forceBinary || !!(query && query.bin === 'true'),
		token,
		ping() {
			socket.send('');
		},
		client: createClient({
			id: server.currentClientId++,
			tokenId: token ? token.id : undefined,
			tokenData: token ? token.data : undefined,
			originalRequest: server.keepOriginalRequest ? originalRequest : undefined,
			transferLimit: server.transferLimit,
			isConnected() {
				return isConnected;
			},
			lastMessageTime() {
				return obj.lastMessageTime;
			},
			disconnect(force = false, invalidateToken = false, reason = '') {
				isConnected = false;

				if (invalidateToken && obj.token) {
					if (server.clientsByToken.get(obj.token.id) === obj) {
						server.clientsByToken.delete(obj.token.id);
					}
					obj.token = undefined;
				}

				if (force) {
					if (!uwsSocketEvents) {
						socket.end();
					}
				} else {
					closeReason = reason;
					socket.close();
				}
			},
		}, send),
	};

	if (obj.token) {
		server.clientsByToken.set(obj.token.id, obj);
	}

	// TODO: remove Uint8Array from here
	function send(data: string | Uint8Array | Buffer) {
		if (server.errorIfNotConnected && !isConnected) {
			errorHandler.handleError(obj.client, new Error('Not Connected'));
		}

		if (data instanceof Buffer) {
			server.totalSent += data.byteLength;
			socket.send(data, true);
		} else if (typeof data !== 'string') {
			server.totalSent += data.byteLength;
			socket.send(Buffer.from(data.buffer, data.byteOffset, data.byteLength), true);
		} else {
			server.totalSent += data.length;
			socket.send(data, false);
		}

		obj.lastSendTime = Date.now();
	}

	const handleResult2: HandleResult = (funcId, fundName, result, messageId) => {
		handleResult(send, obj, funcId, fundName, result, messageId);
	};

	function serverActionsCreated(serverActions: SocketServer) {
		uwsSocketEvents.onMessage = (message, isBinary) => {
			try {
				let data: string | undefined = undefined;
				if (!isBinary) {
					data = Buffer.from(message).toString();
				}
				if (transferLimitExceeded || !isConnected)
					return;

				const messageLength = getLength(data || message);
				bytesReceived += messageLength;
				server.totalReceived += bytesReceived;

				let reader: BinaryReader | undefined = undefined;

				if (messageLength) {
					if (isBinary) {
						reader = createBinaryReaderFromBuffer(message, 0, message.byteLength);
					}
				}

				const now = Date.now();
				const diff = now - bytesReset;
				const bytesPerSecond = bytesReceived * 1000 / Math.max(1000, diff);
				const transferLimit = obj.client.transferLimit;

				if (transferLimit && transferLimit < bytesPerSecond) {
					transferLimitExceeded = true;
					obj.client.disconnect(true, true, 'transfer limit');
					errorHandler.handleRecvError(
						obj.client, new Error(`Transfer limit exceeded ${bytesPerSecond.toFixed(0)}/${transferLimit} (${diff}ms)`),
						reader ? getBinaryReaderBuffer(reader) : data!);
					return;
				}

				if (server.forceBinary && data !== undefined) {
					obj.client.disconnect(true, true, 'non-binary message');
					errorHandler.handleRecvError(obj.client, new Error(`String message while forced binary`),
						reader ? getBinaryReaderBuffer(reader) : data!);
					return;
				}

				obj.lastMessageTime = Date.now();
				obj.supportsBinary = obj.supportsBinary || !!(isBinary);

				if (reader || data) {
					obj.lastMessageId++;
					const messageId = obj.lastMessageId;

					try {
						// TODO: options.onPacket?.(obj.client)

						if (data !== undefined) {
							server.packetHandler.recvString(data, serverActions, {}, (funcId, funcName, func, funcObj, args) => {
								const rate = server.rateLimits[funcId];

								// TODO: move rate limits to packet handler
								if (checkRateLimit2(funcId, callsList, server.rateLimits)) {
									handleResult(send, obj, funcId, funcName, func.apply(funcObj, args), messageId);
								} else if (rate && rate.promise) {
									handleResult(send, obj, funcId, funcName, Promise.reject(new Error('Rate limit exceeded')), messageId);
								} else {
									throw new Error(`Rate limit exceeded (${funcName})`);
								}
							});
						} else {
							server.packetHandler.recvBinary(serverActions, reader!, callsList, messageId, handleResult2);
						}
					} catch (e) {
						errorHandler.handleRecvError(obj.client, e, reader ? getBinaryReaderBuffer(reader) : data!);
					}
				}

				if (diff > 1000) {
					bytesReceived = 0;
					bytesReset = now;
				}
			} catch (e) {
				errorHandler.handleError(obj.client, e);
			}
		};

		server.packetHandler.createRemote(obj.client, send, obj);

		if (server.debug) log('client connected');

		server.packetHandler.sendString(send, '*version', MessageType.Version, [server.hash]);
		server.clients.push(obj);

		if (serverActions.connected) {
			callWithErrorHandling(() => serverActions.connected!(), () => { }, e => {
				errorHandler.handleError(obj.client, e);
				obj.client.disconnect(false, false, 'error on connected()');
			});
		}
	}

	let closed = false;

	uwsSocketEvents.onClose = (code, reason) => {
		if (closed) return;

		try {
			closed = true;
			isConnected = false;

			// remove client
			const index = server.clients.indexOf(obj);
			if (index !== -1) {
				server.clients[index] = server.clients[server.clients.length - 1];
				server.clients.pop();
			}

			if (server.debug) log('client disconnected');

			if (serverActions?.disconnected) {
				const reader = createBinaryReaderFromBuffer(reason, 0, reason.byteLength);
				const decodedReason = readString(reader) || '';
				callWithErrorHandling(() => serverActions!.disconnected!(code, closeReason || decodedReason), () => { },
					e => errorHandler.handleError(obj.client, e));
			}

			if (obj.token) {
				obj.token.expire = Date.now() + server.tokenLifetime;

				if (server.clientsByToken.get(obj.token.id) === obj) {
					server.clientsByToken.delete(obj.token.id);
					server.freeTokens.set(obj.token.id, obj.token);
				}
			}
		} catch (e) {
			errorHandler.handleError(obj.client, e);
		}
	};


	Promise.resolve(server.createServer(obj.client))
		.then(actions => {
			if (isConnected) {
				serverActions = actions;
				serverActionsCreated(serverActions);
			}
		})
		.catch(e => {
			socket.terminate();
			errorHandler.handleError(obj.client, e);
		});
}
