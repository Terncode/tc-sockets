import { SocketService, SocketServer, SocketClient, ClientOptions, Logger } from '../common/interfaces';
import { CustomPacketHandlers } from '../packet/packetHandler';
export interface ClientErrorHandler {
    handleRecvError(error: Error, data: string | Uint8Array): void;
}
export declare function createClientSocket<TClient extends SocketClient, TServer extends SocketServer>(originalOptions: ClientOptions, token?: string | null | undefined, errorHandler?: ClientErrorHandler, apply?: (f: () => any) => void, log?: Logger, customHandlers?: CustomPacketHandlers | undefined): SocketService<TClient, TServer>;
