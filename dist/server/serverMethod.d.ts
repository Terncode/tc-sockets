import { PartialServerOptions, ServerOptions } from './serverInterfaces';
export declare function Socket(options?: PartialServerOptions): (target: Function) => void;
export declare function getSocketMetadata(ctor: Function): ServerOptions | undefined;
