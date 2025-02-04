import { ServerOptions } from './serverInterfaces';

const socketServerMetadata = new Map<Function, ServerOptions>();

export function Socket(options: ServerOptions = ({} as any)) {
	return function (target: Function) {
		socketServerMetadata.set(target, options as any);
	};
}

export function getSocketMetadata(ctor: Function): ServerOptions | undefined {
	return socketServerMetadata.get(ctor);
}
