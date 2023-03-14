import { ServerOptions } from './serverInterfaces';
export declare function Socket(options?: ServerOptions): (target: Function) => void;
export declare function getSocketMetadata(ctor: Function): ServerOptions | undefined;
