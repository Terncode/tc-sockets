import { MethodMetadata, MethodOptions } from './interfaces';
export declare function Method(options?: MethodOptions): (target: Object, name: string) => void;
export declare function getMethodMetadata(ctor: Function): MethodMetadata[] | undefined;
export declare function getMethods(ctor: Function): MethodMetadata[];
