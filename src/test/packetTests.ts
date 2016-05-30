import './common';
import { expect } from 'chai';
import { assert, spy, stub } from 'sinon';
import { MessageType, PacketHandler } from '../packet/packetHandler';
import BufferPacketWriter from '../packet/bufferPacketWriter';
import BufferPacketReader from '../packet/bufferPacketReader';
import ArrayBufferPacketWriter from '../packet/arrayBufferPacketWriter';
import ArrayBufferPacketReader from '../packet/arrayBufferPacketReader';
import { createHandlers } from '../packet/binaryHandler';

class MockWebSocket {
	send() { }
}

describe('PacketHandler', function () {
	let handler: PacketHandler<Buffer>;
	let websocket: WebSocket;
	let funcs: any;
	let special: any;
	let binary: any;
	let writer: BufferPacketWriter;
	let reader: BufferPacketReader;

	beforeEach(function () {
		writer = new BufferPacketWriter();
		reader = new BufferPacketReader();
		binary = createHandlers({ foo: ['Uint8'] }, { foo: ['Uint8'] });
		handler = new PacketHandler<Buffer>(['', 'foo', 'abc'], ['', 'bar'], writer, reader, binary);
	});

	describe('send()', function () {
		beforeEach(function () {
			websocket = <any>new MockWebSocket();
		});

		it('should send message to websocket', function () {
			const send = stub(websocket, 'send');

			handler.send(websocket, 'foo', 1, ['a', 'b', 5]);

			assert.calledWith(send, '[1,"a","b",5]');
		});

		it('should return message length', function () {
			expect(handler.send(websocket, 'foo', 1, ['a', 'b', 5])).equal('[1,"a","b",5]'.length);
		});

		it('should return 0 on error', function () {
			stub(websocket, 'send').throws(new Error(''));

			expect(handler.send(websocket, 'foo', 1, ['a', 'b', 5])).equal(0);
		});

		it('should send binary message', function () {
			const send = stub(websocket, 'send');
			handler.supportsBinary = true;

			handler.send(websocket, 'foo', 1, [8]);

			assert.calledWith(send, writer.getBuffer());
		});

		it('should return binary message length', function () {
			handler.supportsBinary = true;

			expect(handler.send(websocket, 'foo', 1, [8])).equal(2);
		});

		it('should return binary message length (ArrayBuffer)', function () {
			const writer = new ArrayBufferPacketWriter();
			const reader = new ArrayBufferPacketReader();
			const handler = new PacketHandler<ArrayBuffer>(['', 'foo', 'abc'], ['', 'bar'], writer, reader, binary);

			handler.supportsBinary = true;

			expect(handler.send(websocket, 'foo', 1, [8])).equal(2);
		});
	});

	describe('recv()', function () {
		beforeEach(function () {
			funcs = {
				foo: () => { },
			};

			special = {
				'*version': () => { },
				'*resolve:bar': () => { },
				'*reject:bar': () => { },
			};
		});

		it('should read message from websocket', function () {
			const foo = stub(funcs, 'foo');

			handler.recv('[1,"a","b",5]', funcs, special, result => { });

			assert.calledWith(foo, 'a', 'b', 5);
		});

		it('should read VERSION message from websocket', function () {
			const VERSION = stub(special, '*version');

			handler.recv(JSON.stringify([MessageType.Version, 123]), funcs, special, result => { });

			assert.calledWith(VERSION, 123);
		});

		it('should read promise resolve message from websocket', function () {
			const barResolved = stub(special, '*resolve:bar');

			handler.recv(JSON.stringify([MessageType.Resolved, 1, 123]), funcs, special, result => { });

			assert.calledWith(barResolved, 123);
		});

		it('should read promise reject message from websocket', function () {
			const barRejected = stub(special, '*reject:bar');

			handler.recv(JSON.stringify([MessageType.Rejected, 1, 123]), funcs, special, result => { });

			assert.calledWith(barRejected, 123);
		});

		it('should do nothing if function doesnt exist', function () {
			handler.recv(JSON.stringify([100, 123]), funcs, special, result => { });
		});

		it('should return message length', function () {
			const foo = stub(funcs, 'foo');

			expect(handler.recv('[1,"a","b",5]', funcs, special, result => { })).equal('[1,"a","b",5]'.length);
		});

		it('should read binary message from websocket', function () {
			const foo = stub(funcs, 'foo');

			handler.recv(new Buffer([1, 8]), funcs, special, result => { });

			assert.calledWith(foo, 8);
		});

		it('should return binary message length', function () {
			expect(handler.recv(new Buffer([1, 8]), funcs, special, result => { })).equal(2);
		});

		it('should throw if binary handler is missing', function () {
			expect(() => handler.recv(new Buffer([2, 8]), funcs, special, result => { })).throw('Missing packet handler for: abc (2)');
		});

		it('should return binary message length (ArrayBuffer)', function () {
			const writer = new ArrayBufferPacketWriter();
			const reader = new ArrayBufferPacketReader();
			const handler = new PacketHandler<ArrayBuffer>(['', 'foo', 'abc'], ['', 'bar'], writer, reader, binary);

			handler.supportsBinary = true;

			const buffer = new ArrayBuffer(2);
			const bytes = new Uint8Array(buffer);
			bytes[0] = 1;
			bytes[1] = 8;
			expect(handler.recv(buffer, funcs, special, result => { })).equal(2);
		});

		it('should call handle result with method id, name and result', function () {
			const handleResult = spy();
			stub(funcs, 'foo').returns('abc');

			handler.recv('[1,"abc"]', funcs, special, handleResult);

			assert.calledWith(handleResult, 1, 'foo', 'abc');
		});
	});
});
