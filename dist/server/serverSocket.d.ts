import { Logger } from '../common/interfaces';
import { ErrorHandler } from './server';
import { Server, GlobalConfig, ServerHost, CreateServerMethod, CreateServer, ServerOptions } from './serverInterfaces';
export declare function createServer<TServer, TClient>(serverType: new (...args: any[]) => TServer, clientType: new (...args: any[]) => TClient, createServer: CreateServer<TServer, TClient>, options?: ServerOptions, errorHandler?: ErrorHandler, log?: Logger): Server;
export declare function createServerRaw(createServer: CreateServerMethod, options: ServerOptions, errorHandler?: ErrorHandler, log?: Logger): Server;
export declare function createServerHost(globalConfig: GlobalConfig): ServerHost;
