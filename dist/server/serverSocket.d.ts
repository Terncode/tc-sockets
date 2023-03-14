import { Logger } from '../common/interfaces';
import { ErrorHandler } from './server';
import { CustomPacketHandlers } from '../packet/packetHandler';
import { Server, GlobalConfig, ServerHost, CreateServerMethod, CreateServer, ServerOptions } from './serverInterfaces';
import { TemplatedApp } from 'uWebSockets.js';
export declare function createServer<TServer, TClient>(app: TemplatedApp, serverType: new (...args: any[]) => TServer, clientType: new (...args: any[]) => TClient, createServer: CreateServer<TServer, TClient>, options?: ServerOptions, errorHandler?: ErrorHandler, log?: Logger, customPacketHandlers?: CustomPacketHandlers): Server;
export declare function createServerRaw(app: TemplatedApp, createServer: CreateServerMethod, options: ServerOptions, errorHandler?: ErrorHandler, log?: Logger, customPacketHandlers?: CustomPacketHandlers): Server;
export declare function createServerHost(uwsApp: TemplatedApp, globalConfig: GlobalConfig, customPacketHandlers?: CustomPacketHandlers): ServerHost;
