import { Server as HttpServer, IncomingMessage } from 'http';
import * as ws from 'ws';
import * as Promise from 'bluebird';
import { parse as parseUrl } from 'url';
import { ServerOptions, ClientOptions, MethodDef, getNames, getBinary, getIgnore, SocketServer, Logger } from './interfaces';
import { randomString, checkRateLimit, parseRateLimit, RateLimit, getLength, cloneDeep } from './utils';
import { SocketServerClient, ErrorHandler, OriginalRequest } from './server';
import { getSocketMetadata, getMethods } from './method';
import { PacketHandler, MessageType, Packet, Send } from './packet/packetHandler';
import { DebugPacketHandler } from './packet/debugPacketHandler';
import { createHandlers } from './packet/binaryHandler';
import BufferPacketWriter from './packet/bufferPacketWriter';
import BufferPacketReader from './packet/bufferPacketReader';
import ArrayBufferPacketWriter from './packet/arrayBufferPacketWriter';
import ArrayBufferPacketReader from './packet/arrayBufferPacketReader';

export interface Token {
	id: string;
	data?: any;
	expire: number;
}

export interface ServerHooks {
	sendPacket(packet: Packet): void;
	executeForClients(clients: any[], action: (client: any) => any): void;
}

export interface ClientInternal {
	__internalHooks: ServerHooks;
}

export interface Client {
	lastMessageTime: number;
	lastMessageId: number;
	token: Token | undefined;
	ping(): void;
	client: SocketServerClient & ClientInternal;
	supportsBinary: boolean;
}

export interface Server {
	clients: Client[];
	close(): void;
	options(): ClientOptions;
	token(data?: any): string;
	clearTokens(test: (id: string, data?: any) => boolean): void;
}

const defaultErrorHandler: ErrorHandler = {
	handleError() { },
	handleRejection() { },
	handleRecvError() { },
};

function getMethodsFromType(ctor: Function) {
	return getMethods(ctor).map<MethodDef>(m => Object.keys(m.options).length ? [m.name, m.options] : m.name);
}

function callWithErrorHandling(action: () => any, handle: (e: Error) => void) {
	try {
		const result = action();

		if (result && result.catch) {
			result.catch(handle);
		}
	} catch (e) {
		handle(e);
	}
}

export function broadcast<TClient>(clients: TClient[], action: (client: TClient) => any) {
	if (clients && clients.length) {
		const hooks = (clients[0] as any as ClientInternal).__internalHooks;

		if (!hooks) {
			throw new Error('Invalid client');
		}

		hooks.executeForClients(clients, action);
	}
}

export function createClientOptions<TServer, TClient>(
	serverType: new (...args: any[]) => TServer,
	clientType: new (...args: any[]) => TClient,
	options?: ServerOptions
) {
	return toClientOptions(optionsWithDefaults(createServerOptions(serverType, clientType, options)));
}

function createServerOptions(serverType: Function, clientType: Function, options?: ServerOptions) {
	const client = getMethodsFromType(clientType);
	const server = getMethodsFromType(serverType);
	return Object.assign({ client, server }, getSocketMetadata(serverType), options);
}

function optionsWithDefaults(options: ServerOptions): ServerOptions {
	return Object.assign({
		hash: Date.now(),
		path: '/ws',
		tokenLifetime: 3600 * 1000, // 1 hour
		reconnectTimeout: 500, // 0.5 sec
		connectionTimeout: 10000, // 10 sec
	}, options);
}

function toClientOptions(options: ServerOptions): ClientOptions {
	return {
		host: options.host,
		path: options.path,
		ssl: options.ssl,
		pingInterval: options.pingInterval,
		reconnectTimeout: options.reconnectTimeout,
		debug: options.debug,
		hash: options.hash,
		requestParams: options.requestParams,
		client: options.client!,
		server: options.server!,
	};
}

function createRateLimit(method: MethodDef): RateLimit | undefined {
	return Array.isArray(method) && method[1].rateLimit ? {
		calls: [],
		promise: !!method[1].promise,
		...parseRateLimit(method[1].rateLimit!, true),
	} : void 0;
}

export function createServer<TServer, TClient>(
	httpServer: HttpServer,
	serverType: new (...args: any[]) => TServer,
	clientType: new (...args: any[]) => TClient,
	createServer: (client: TClient & SocketServerClient) => TServer,
	options?: ServerOptions,
	errorHandler?: ErrorHandler,
	log?: Logger
) {
	return create(httpServer, createServer, createServerOptions(serverType, clientType, options), errorHandler, log);
}

type AnyBuffer = Buffer | ArrayBuffer;

export function create(
	server: HttpServer,
	createServer: (client: any) => SocketServer,
	options: ServerOptions,
	errorHandler: ErrorHandler = defaultErrorHandler,
	log: Logger = console.log.bind(console)
): Server {
	options = optionsWithDefaults(options);

	if (!options.client || !options.server)
		throw new Error('Missing server or client method definitions');

	if (options.client.length > 250 || options.server.length > 250)
		throw new Error('Too many methods');

	let currentClientId = 1;
	let tokens: Token[] = [];
	const clients: Client[] = [];
	const verifyClient = options.verifyClient;
	const wsLibrary: typeof ws = (options.ws || require('ws')) as any;
	const clientOptions = toClientOptions(options);

	function createToken(data?: any): Token {
		const token = {
			id: randomString(16),
			data,
			expire: Date.now() + options.tokenLifetime!,
		};
		tokens.push(token);
		return token;
	}

	function getToken(id: string): Token | null {
		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];

			if (token.id === id) {
				tokens.splice(i, 1);
				return token.expire < Date.now() ? null : token;
			}
		}

		return null;
	}

	function findIndex<T>(array: T[], test: (item: T) => boolean): number {
		for (let i = 0; i < array.length; i++) {
			if (test(array[i])) {
				return i;
			}
		}

		return -1;
	}

	function getTokenFromClient(id: string): Token | undefined {
		const index = findIndex(clients, c => !!c.token && c.token.id === id);

		if (index !== -1) {
			const { client, token } = clients[index];
			client.disconnect(true);
			return token;
		} else {
			return void 0;
		}
	}

	function hasToken(id: string) {
		return tokens.some(t => t.id === id) || clients.some(c => !!(c.token && c.token.id === id));
	}

	const wsServer = new wsLibrary.Server({
		server: server,
		path: options.path,
		perMessageDeflate: typeof options.perMessageDeflate === 'undefined' ? true : options.perMessageDeflate,
		verifyClient({ req }: { req: IncomingMessage }) {
			try {
				if (verifyClient && !verifyClient(req))
					return false;

				if (options.clientLimit && options.clientLimit <= clients.length)
					return false;

				if (options.connectionTokens)
					return hasToken(parseUrl(req.url || '', true).query.t);

				return true;
			} catch (e) {
				errorHandler.handleError(null, e);
				return false;
			}
		}
	});

	const handlers = createHandlers(getBinary(options.client), getBinary(options.server));
	const reader = options.arrayBuffer ? new ArrayBufferPacketReader() : new BufferPacketReader();
	const writer = options.arrayBuffer ? new ArrayBufferPacketWriter() : new BufferPacketWriter();
	const serverMethods = getNames(options.server);
	const clientMethods = getNames(options.client);
	const ignore = getIgnore(options.client).concat(getIgnore(options.server));
	const packetHandler: PacketHandler<AnyBuffer> = options.debug ?
		new DebugPacketHandler<AnyBuffer>(serverMethods, serverMethods, writer, reader, handlers, ignore, log) :
		new PacketHandler<AnyBuffer>(serverMethods, serverMethods, writer, reader, handlers);

	const proxy: any = {};
	let proxyPacket: Packet | undefined;

	clientMethods.forEach((name, id) => proxy[name] = (...args: any[]) => proxyPacket = { id, name, args: [id, ...args] });

	function createPacket(action: (client: any) => any): Packet {
		action(proxy);
		const packet = proxyPacket!;
		proxyPacket = void 0;
		return packet;
	}

	function executeForClients(clients: ClientInternal[], action: (client: any) => any) {
		const packet = createPacket(action);
		clients.forEach(c => c.__internalHooks.sendPacket(packet));
	}

	function handleResult(send: Send, obj: Client, funcId: number, funcName: string, result: Promise<any>, messageId: number) {
		if (result && typeof result.then === 'function') {
			result.then(result => {
				packetHandler.send(send, `*resolve:${funcName}`, MessageType.Resolved, [funcId, messageId, result], obj.supportsBinary);
			}, (e: Error) => {
				e = errorHandler.handleRejection(obj.client, e) || e;
				packetHandler.send(send, `*reject:${funcName}`, MessageType.Rejected, [funcId, messageId, e ? e.message : 'error'], obj.supportsBinary);
			}).catch((e: Error) => errorHandler.handleError(obj.client, e));
		}
	}

	function createOriginalRequest(socket: ws & { upgradeReq?: IncomingMessage; }, request: IncomingMessage | undefined): OriginalRequest {
		if (request) {
			return { url: request.url || '', headers: request.headers };
		} else if (socket.upgradeReq) {
			return { url: socket.upgradeReq.url || '', headers: socket.upgradeReq.headers };
		} else {
			return { url: '', headers: {} };
		}
	}

	function onConnection(socket: ws, request: IncomingMessage | undefined) {
		const originalRequest = createOriginalRequest(socket, request);
		const query = parseUrl(originalRequest.url, true).query;
		const token = options.connectionTokens ? getToken(query.t) || getTokenFromClient(query.t) : void 0;

		if (options.connectionTokens && !token) {
			errorHandler.handleError({ originalRequest } as any, new Error(`Invalid token: ${query.t}`));
			socket.terminate();
			return;
		}

		const rates = options.server!.map(createRateLimit);

		let bytesReset = Date.now();
		let bytesReceived = 0;
		let transferLimitExceeded = false;

		const obj: Client = {
			lastMessageTime: Date.now(),
			lastMessageId: 0,
			supportsBinary: query.bin === 'true',
			token,
			ping() {
				socket.send('');
			},
			client: {
				__internalHooks: {
					executeForClients,
					sendPacket,
				},
				id: currentClientId++,
				isConnected: true,
				tokenId: token ? token.id : void 0,
				tokenData: token ? token.data : void 0,
				originalRequest: options.keepOriginalRequest ? originalRequest : void 0,
				disconnect(force = false, invalidateToken = false) {
					if (invalidateToken) {
						delete obj.token;
					}

					if (force) {
						socket.terminate();
					} else {
						socket.close();
					}
				},
			},
		};

		function send(data: any) {
			socket.send(data);
		}

		function sendPacket(packet: Packet) {
			packetHandler.sendPacket(send, packet, obj.supportsBinary);
		}

		const serverActions: SocketServer = createServer(obj.client);

		socket.on('message', (message: string | Buffer | ArrayBuffer, flags?: { binary: boolean; }) => {
			if (transferLimitExceeded)
				return;

			bytesReceived += getLength(message);

			const now = Date.now();
			const diff = now - bytesReset;
			const bytesPerSecond = bytesReceived * 1000 / Math.max(1000, diff);

			if (options.transferLimit && options.transferLimit < bytesPerSecond) {
				transferLimitExceeded = true;
				obj.client.disconnect(true, true);
				errorHandler.handleRecvError(obj.client, new Error(`Transfer limit exceeded ${bytesPerSecond.toFixed(0)}/${options.transferLimit} (${diff}ms)`), message);
				return;
			}

			obj.lastMessageTime = Date.now();
			obj.supportsBinary = obj.supportsBinary || !!(flags && flags.binary);

			if (message && getLength(message)) {
				obj.lastMessageId++;
				const messageId = obj.lastMessageId;

				try {
					packetHandler.recv(message, serverActions, {}, (funcId, funcName, func, funcObj, args) => {
						const rate = rates[funcId];

						if (checkRateLimit(funcId, rates)) {
							handleResult(send, obj, funcId, funcName, func.apply(funcObj, args), messageId);
						} else if (rate && rate.promise) {
							handleResult(send, obj, funcId, funcName, Promise.reject(new Error('Rate limit exceeded')), messageId);
						} else {
							throw new Error(`Rate limit exceeded (${funcName})`);
						}
					});
				} catch (e) {
					errorHandler.handleRecvError(obj.client, e, message);
				}
			}

			if (diff > 1000) {
				bytesReceived = 0;
				bytesReset = now;
			}
		});

		socket.on('close', () => {
			obj.client.isConnected = false;
			clients.splice(clients.indexOf(obj), 1);

			if (options.debug)
				log('client disconnected');

			if (serverActions.disconnected) {
				callWithErrorHandling(() => serverActions.disconnected!(), e => errorHandler.handleError(obj.client, e));
			}

			if (obj.token) {
				obj.token.expire = Date.now() + options.tokenLifetime!;
				tokens.push(obj.token);
			}
		});

		socket.on('error', e => errorHandler.handleError(obj.client, e));

		clientMethods.forEach((name, id) => obj.client[name] = (...args: any[]) => packetHandler.send(send, name, id, args, obj.supportsBinary));

		if (options.debug)
			log('client connected');

		packetHandler.send(send, '*version', MessageType.Version, [options.hash], obj.supportsBinary);

		clients.push(obj);

		if (serverActions.connected) {
			callWithErrorHandling(() => serverActions.connected!(), e => errorHandler.handleError(obj.client, e));
		}
	}

	wsServer.on('connection', (socket, request) => {
		try {
			onConnection(socket, request);
		} catch (e) {
			socket.terminate();
			errorHandler.handleError(null, e);
		}
	});

	wsServer.on('error', e => errorHandler.handleError(null, e));

	let pingInterval: any;
	let tokenInterval: any;

	if (options.pingInterval) {
		pingInterval = setInterval(() => {
			const now = Date.now();

			clients.forEach(c => {
				try {
					if ((now - c.lastMessageTime) > options.connectionTimeout!) {
						c.client.disconnect();
					} else {
						c.ping();
					}
				} catch (e) { }
			});
		}, options.pingInterval);
	}

	if (options.connectionTokens) {
		tokenInterval = setInterval(() => {
			const now = Date.now();
			tokens = tokens.filter(t => t.expire > now);
		}, 10000);
	}

	return {
		clients,
		close() {
			if (pingInterval) {
				clearInterval(pingInterval);
				pingInterval = null;
			}

			if (tokenInterval) {
				clearInterval(tokenInterval);
				tokenInterval = null;
			}

			wsServer.close();
		},
		options(): ClientOptions {
			return cloneDeep(clientOptions);
		},
		token(data?: any) {
			if (!options.connectionTokens)
				throw new Error('Option connectionTokens not set');
			return createToken(data).id;
		},
		clearTokens(test: (id: string, data?: any) => boolean) {
			if (!options.connectionTokens)
				throw new Error('Option connectionTokens not set');

			tokens = tokens
				.filter(t => !test(t.id, t.data));

			clients
				.filter(c => c.token && test(c.token.id, c.token.data))
				.forEach(c => c.client.disconnect(true, true));
		},
	};
}
