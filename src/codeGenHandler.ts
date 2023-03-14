import { generateLocalHandlerCode, generateRemoteHandlerCode, CodeGenOptions, writerMethods } from './packet/packetHandlerCodeGen';
import { CustomPacketHandlers } from './packet/packetHandler';

export function createCodeGenHandlers(codeGenOptions?: CodeGenOptions): CustomPacketHandlers {
	return {
		createLocalHandler: (methodsDef, remoteNames, onRecv, useBinaryResultByDefault?: boolean) => {
			return generateLocalHandlerCode(methodsDef, remoteNames, { useBinaryResultByDefault, ...codeGenOptions}, onRecv);
		},
		createRemoteHandler: (methodsDef, handlerOptions) => {
			const createRemoteHandler = generateRemoteHandlerCode(methodsDef, {...handlerOptions, ...codeGenOptions});
			return (remote, send, state, options, writer) => {
				createRemoteHandler(remote, send, state, options, writerMethods, writer);
			};
		}
	};
}
