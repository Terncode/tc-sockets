import { ClientOptions, SocketServer, Logger, MethodDef, CommonOptions, OnSend, OnRecv, RateLimitDef } from '../common/interfaces';
import { SocketServerClient, ErrorHandler } from './server';
import { Send, PacketHandler } from '../packet/packetHandler';
import { CompressOptions, HttpRequest, RecognizedString, TemplatedApp, WebSocket } from 'uWebSockets.js';

export interface Token {
	id: string;
	data?: any;
	expire: number;
}

export interface ClientState {
	lastMessageTime: number;
	lastMessageId: number;
	lastSendTime: number;
	sentSize: number;
	token: Token | undefined;
	ping(): void;
	client: SocketServerClient;
	supportsBinary: boolean;
}

export interface ServerInfo {
	writerBufferSize: number;
	freeTokens: number;
	clientsByToken: number;
}

export interface Server {
	clients: ClientState[];
	close(): void;
	options(): ClientOptions;
	token(data?: any): string;
	clearToken(id: string): void;
	clearTokens(test: (id: string, data?: any) => boolean): void;
	info(): ServerInfo;
}

export type CreateServer<TServer, TClient> = (client: TClient & SocketServerClient) => (TServer | Promise<TServer>);
export type CreateServerMethod = (client: any) => (SocketServer | Promise<SocketServer>);

export interface ServerHost {
	close(): void;
	socket<TServer, TClient>(
		serverType: new (...args: any[]) => TServer,
		clientType: new (...args: any[]) => TClient,
		createServer: CreateServer<TServer, TClient>,
		options?: ServerOptions,
	): Server;
	socketRaw(createServer: CreateServerMethod, options: ServerOptions): Server;
	app: TemplatedApp;
}

export interface GlobalConfig {
	path?: string;
	errorHandler?: ErrorHandler;
	perMessageDeflate?: boolean;
	compression?: CompressOptions;
	log?: Logger;
	errorCode?: number;
	errorName?: string;
	nativePing?: number;
	port?: number;
}

export interface InternalServer {
	// state
	clients: ClientState[];
	freeTokens: Map<string, Token>;
	clientsByToken: Map<string, ClientState>;
	currentClientId: number;
	pingInterval: any;
	tokenInterval: any;
	totalSent: number;
	totalReceived: number;
	// options
	id: string;
	path: string;
	hash: string;
	debug: boolean;
	forceBinary: boolean;
	connectionTokens: boolean;
	keepOriginalRequest: boolean;
	errorIfNotConnected: boolean;
	tokenLifetime: number;
	clientLimit: number;
	transferLimit: number;
	backpressureLimit: number;
	serverMethods: MethodDef[];
	clientMethods: string[];
	rateLimits: (RateLimitDef | undefined)[];
	resultBinary: boolean[];
	verifyClient: (req: HttpRequest) => boolean;
	createClient?: (client: SocketServerClient, send: (data: string | Uint8Array | Buffer) => void) => SocketServerClient;
	// methods
	createServer: CreateServerMethod;
	handleResult: (send: Send, obj: ClientState, funcId: number, funcName: string, funcBinary: boolean, result: Promise<any>, messageId: number) => void;
	packetHandler: PacketHandler;
	server: Server;
}

export interface ServerOptions extends CommonOptions {
	/** ping interval in milliseconds, ping disabled if not specified or 0 */
	pingInterval?: number;
	/** time after after last message from client when server assumes client is not responding (in milliseconds) */
	connectionTimeout?: number;
	/** limit connections to one per generated token */
	connectionTokens?: boolean;
	/** lifetime of connection token */
	tokenLifetime?: number;
	/** maximum number of connected clients */
	clientLimit?: number;
	/** per message deflate compression switch */
	perMessageDeflate?: boolean;
	/** WebSocket compression options. Combine any compressor with any decompressor using bitwise OR. */
	compression?: CompressOptions;
	/** transfer limit (bytes per second) */
	transferLimit?: number;
	/** Backpressure limit */
	backpressureLimit?: number;
	/** custom client verification method */
	verifyClient?: (req: HttpRequest) => boolean;
	/** allows to modify client object */
	createClient?: (client: SocketServerClient, send: (data: string | Uint8Array | Buffer) => void) => SocketServerClient;
	/** use ArrayBuffer instead of Buffer on server side */
	arrayBuffer?: boolean;
	/** only allow binary packets and binary connections */
	forceBinary?: boolean;
	/** only allow binary encoding for packets with binary option */
	forceBinaryPackets?: boolean;
	/** use binary encoding for packets without encoding specified */
	useBinaryByDefault?: boolean;
	/** keep original request info in client.originalRequest field */
	keepOriginalRequest?: boolean;
	/** throws error if server tries to send message to disconnected client */
	errorIfNotConnected?: boolean;
	/** prints to console generated packet handler code */
	printGeneratedCode?: boolean;
	/** Server port. Providing port will make library automatically handle socket connections **/
	port?: number
	/** send/recv handlers */
	onSend?: OnSend;
	onRecv?: OnRecv;
	client?: MethodDef[];
	server?: MethodDef[];
}


type ForceCloseFn = ((force: false, code?: number | undefined, shortMessage?: RecognizedString | undefined) => void);
type GracefulCloseFn = ((force: true, code?: undefined, shortMessage?: undefined) => void)
type CloseFn = ((force: boolean, code?: undefined, shortMessage?: undefined) => void);


export interface UWSSocketEvents {
	socket: WebSocket,
	onMessage: (message: ArrayBuffer, isBinary: boolean) => void,
	close: CloseFn & ForceCloseFn & GracefulCloseFn,
	onClose: (code: number, message: ArrayBuffer) => void,
}

