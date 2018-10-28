import './common';
import { expect } from 'chai';
import { BufferPacketWriter } from '../packet/bufferPacketWriter';
import { BufferPacketReader } from '../packet/bufferPacketReader';
import { ArrayBufferPacketWriter } from '../packet/arrayBufferPacketWriter';
import { ArrayBufferPacketReader } from '../packet/arrayBufferPacketReader';
import { PacketWriter, PacketReader } from '../packet/packetCommon';

type Foo = [any, number[]];

describe('PacketReader + PacketWriter', () => {
	function readWriteTest<T>(writer: PacketWriter<T>, reader: PacketReader<T>) {
		writer.init(10000);
		writer.writeInt8(-123);
		writer.writeUint8(123);
		writer.writeInt16(-234);
		writer.writeUint16(234);
		writer.writeInt32(-345);
		writer.writeUint32(345);
		writer.writeFloat32(-1.5);
		writer.writeFloat64(2.5);
		writer.writeBoolean(true);
		writer.writeBoolean(false);
		writer.writeBytes(new Uint8Array([1, 2, 3, 4, 5]));
		writer.writeLength(5);
		writer.writeLength(200);
		writer.writeLength(60000);
		writer.writeLength(10000000);
		writer.writeString(null);
		writer.writeString('');
		writer.writeString('foo');
		writer.writeString('foo lkfdas jldfih dglfkhj fdglh irj idljg ldkfgj ');
		writer.writeString('część');
		writer.writeObject(null);
		writer.writeObject({ foo: 'bar' });
		writer.writeArray(['foo', 'bar', 'boo'], i => writer.writeString(i));
		writer.writeArray<string>([], i => writer.writeString(i));
		writer.writeArray<string>(null, i => writer.writeString(i));
		writer.writeArray([{ foo: 'bar' }, { foo: 'boo' }], i => writer.writeObject(i));
		writer.writeArray<Foo>([[{ foo: 'bar' }, [1, 2, 3]], [{ foo: 'boo' }, [4, 5, 6]]], i => {
			writer.writeObject(i[0]);
			writer.writeArray(i[1], j => writer.writeUint8(j));
		});
		writer.writeArrayBuffer(null);
		writer.writeArrayBuffer(new Uint8Array([1, 2, 3]).buffer);
		writer.writeUint8Array(null);
		writer.writeUint8Array(new Uint8Array([1, 2, 3]));

		reader.setBuffer(writer.getBuffer());
		expect(reader.readInt8()).equal(-123, 'readInt8');
		expect(reader.readUint8()).equal(123, 'readUint8');
		expect(reader.readInt16()).equal(-234, 'readInt16');
		expect(reader.readUint16()).equal(234, 'readUint16');
		expect(reader.readInt32()).equal(-345, 'readInt32');
		expect(reader.readUint32()).equal(345, 'readUint32');
		expect(reader.readFloat32()).equal(-1.5, 'readFloat32');
		expect(reader.readFloat64()).equal(2.5, 'readFloat64');
		expect(reader.readBoolean()).equal(true, 'readBoolean');
		expect(reader.readBoolean()).equal(false, 'readBoolean');
		expect(reader.readBytes(5)).eql(new Uint8Array([1, 2, 3, 4, 5]), 'readBytes');
		expect(reader.readLength()).equal(5, 'readLength 1');
		expect(reader.readLength()).equal(200, 'readLength 2');
		expect(reader.readLength()).equal(60000, 'readLength 3');
		expect(reader.readLength()).equal(10000000, 'readLength 4');
		expect(reader.readString()).equal(null, 'readString null');
		expect(reader.readString()).equal('', 'readString empty');
		expect(reader.readString()).equal('foo', 'readString "foo"');
		expect(reader.readString())
			.equal('foo lkfdas jldfih dglfkhj fdglh irj idljg ldkfgj ', 'readString "foo lkfdas jldfih dglfkhj fdglh irj idljg ldkfgj "');
		expect(reader.readString()).equal('część', 'readString część');
		expect(reader.readObject()).equal(null, 'readObject null');
		expect(reader.readObject()).eql({ foo: 'bar' }, 'readObject empty');
		expect(reader.readArray(() => reader.readString())).eql(['foo', 'bar', 'boo'], 'readArray ["foo", "bar", "boo"]');
		expect(reader.readArray(() => reader.readString())).eql([], 'readArray empty');
		expect(reader.readArray(() => reader.readString())).equal(null, 'readArray null');
		expect(reader.readArray(() => reader.readObject())).eql([{ foo: 'bar' }, { foo: 'boo' }], 'readArray obj[]');
		expect(reader.readArray(() => [
			reader.readObject(),
			reader.readArray(() => reader.readUint8()),
		])).eql([[{ foo: 'bar' }, [1, 2, 3]], [{ foo: 'boo' }, [4, 5, 6]]], 'readArray Foo[]');
		expect(reader.readArrayBuffer()).equal(null, 'readArrayBuffer null');
		expect(new Uint8Array(reader.readArrayBuffer()!)).eql(new Uint8Array([1, 2, 3]), 'readArrayBuffer [1, 2, 3]');
		expect(reader.readUint8Array()).equal(null, 'readUint8Array null');
		expect(reader.readUint8Array()).eql(new Uint8Array([1, 2, 3]), 'readUint8Array [1, 2, 3]');

		reader.done();
		expect(() => reader.readUint8()).throw();
	}

	function measureTest<T>(writer: PacketWriter<T>) {
		expect(writer.measureLength(0)).equal(1, 'measureLength 1');
		expect(writer.measureLength(123)).equal(1, 'measureLength 2');
		expect(writer.measureLength(200)).equal(2, 'measureLength 3');
		expect(writer.measureLength(60000)).equal(3, 'measureLength 4');
		expect(writer.measureLength(10000000)).equal(4, 'measureLength 5');
		expect(writer.measureSimpleArray([1, 2, 3], 2)).equal(6 + 1, 'measureSimpleArray');
		expect(writer.measureArray([1, 2, 5], i => i)).equal(8 + 1, 'measureArray');
		expect(writer.measureObject(null)).equal(1, 'measureObject (null)');
		expect(writer.measureObject({ 'foo': 'bar' })).equal(1 + (1 + 3) + (1 + 3), 'measureObject');
		expect(writer.measureString('foobar')).equal(6 + 1, 'measureString');
		expect(writer.measureString('część')).equal(8 + 1, 'measureString (część)');
		expect(writer.measureString(null)).equal(2, 'measureString (null)');
		expect(writer.measureArray<number>(null, x => x)).equal(2, 'measureArray (null)');
		expect(writer.measureSimpleArray<number>(null, 1)).equal(2, 'measureSimpleArray (null)');
		expect(writer.measureArrayBuffer(null)).equal(2, 'measureArrayBuffer (null)');
		expect(writer.measureArrayBuffer(new Uint8Array([1, 2, 3]).buffer)).equal(3 + 1, 'measureArrayBuffer');
		expect(writer.measureUint8Array(null)).equal(2, 'measureUint8Array (null)');
		expect(writer.measureUint8Array(new Uint8Array([1, 2, 3]))).equal(3 + 1, 'measureUint8Array');
	}

	it('reads and writes value correctly (BufferPacketWriter)', () => {
		readWriteTest(new BufferPacketWriter(), new BufferPacketReader());
	});

	it('reads and writes value correctly (ArrayBufferPacketWriter)', () => {
		readWriteTest(new ArrayBufferPacketWriter(), new ArrayBufferPacketReader());
	});

	it('measures lengths correctly (BufferPacketWriter)', () => {
		measureTest(new BufferPacketWriter());
	});

	it('measures lengths correctly (ArrayBufferPacketWriter)', () => {
		measureTest(new ArrayBufferPacketWriter());
	});

	it('handles offset properly (ArrayBufferPacketReader)', () => {
		const reader = new ArrayBufferPacketReader();
		reader.setBuffer(new Uint8Array([1, 2, 3, 4, 5, 6, 7]).buffer, 2, 3);
		expect(reader.readUint8()).equal(3);
		expect(reader.readBytes(2)).eql(new Uint8Array([4, 5]));
	});

	it('handles offset properly (BufferPacketReader)', () => {
		const reader = new BufferPacketReader();
		reader.setBuffer(new Buffer([1, 2, 3, 4, 5, 6, 7]), 2, 3);
		expect(reader.readUint8()).equal(3);
		expect(reader.readBytes(2)).eql(new Uint8Array([4, 5]));
	});

	it('returns offset (ArrayBufferPacketWriter)', () => {
		const writer = new ArrayBufferPacketWriter();
		writer.init(16);
		expect(writer.getOffset()).equal(0);
		writer.writeUint8(1);
		expect(writer.getOffset()).equal(1);
	});

	it('can reset offset (ArrayBufferPacketWriter)', () => {
		const writer = new ArrayBufferPacketWriter();
		writer.init(16);
		writer.writeUint8(1);
		expect(writer.getOffset()).equal(1);
		writer.reset();
		expect(writer.getOffset()).equal(0);
	});

	it('returns offset (BufferPacketWriter)', () => {
		const writer = new BufferPacketWriter();
		writer.init(16);
		expect(writer.getOffset()).equal(0);
		writer.writeUint8(1);
		expect(writer.getOffset()).equal(1);
	});

	it('car reset offset (BufferPacketWriter)', () => {
		const writer = new BufferPacketWriter();
		writer.init(16);
		writer.writeUint8(1);
		expect(writer.getOffset()).equal(1);
		writer.reset();
		expect(writer.getOffset()).equal(0);
	});

	describe('binary object encoding', () => {
		function readWriteObjectTest(obj: any, message?: string) {
			const writer = new ArrayBufferPacketWriter();
			const reader = new ArrayBufferPacketReader();
			writer.init(10000);
			writer.writeObject(obj);
			// const jsonLength = JSON.stringify(obj) && JSON.stringify(obj).length || 0;
			// console.log(`size: ${writer.getOffset()} / ${jsonLength + writer.measureLength(jsonLength)}`);
			reader.setBuffer(writer.getBuffer());
			expect(reader.readObject()).eql(obj, message);
		}

		function measureObjectTest(obj: any, expected: number, message?: string) {
			const writer = new ArrayBufferPacketWriter();
			writer.init(1);
			expect(writer.measureObject(obj)).equal(expected, message);
		}

		it('reads and writes undefined', () => readWriteObjectTest(undefined));
		it('reads and writes null', () => readWriteObjectTest(null));
		it('reads and writes true', () => readWriteObjectTest(true));
		it('reads and writes false', () => readWriteObjectTest(false));
		it('reads and writes numbers', () => readWriteObjectTest(123));
		it('reads and writes strings', () => readWriteObjectTest('abc'));
		it('reads and writes arrays', () => readWriteObjectTest([1, 2, 3]));

		it('reads and writes numbers', () => {
			readWriteObjectTest(0);
			readWriteObjectTest(1);
			readWriteObjectTest(-1);
			readWriteObjectTest(15);
			readWriteObjectTest(16);
			readWriteObjectTest(-15);
			readWriteObjectTest(-16);
			readWriteObjectTest(Number.MAX_VALUE);
			readWriteObjectTest(Number.MAX_SAFE_INTEGER);
			readWriteObjectTest(Number.MIN_VALUE);
			readWriteObjectTest(Number.MIN_SAFE_INTEGER);
			readWriteObjectTest(Number.NaN, 'NaN');
			readWriteObjectTest(Number.POSITIVE_INFINITY, 'POSITIVE_INFINITY');
			readWriteObjectTest(Number.NEGATIVE_INFINITY, 'NEGATIVE_INFINITY');
			readWriteObjectTest(0xff, '0xff');
			readWriteObjectTest(0xffff, '0xffff');
			readWriteObjectTest(0xffffff, '0xffffff');
			readWriteObjectTest(0xffffffff, '0xffffffff');
			readWriteObjectTest(-0xff, '-0xff');
			readWriteObjectTest(-0xffff, '-0xffff');
			readWriteObjectTest(-0xffffff, '-0xffffff');
			readWriteObjectTest(-0xffffffff, '-0xffffffff');
		});

		it('reads and writes objects correctly', () => {
			readWriteObjectTest({
				foo: 'bar',
				x: 123,
				y: 12.5,
				values: [1, 2, 3, 4, 5, -6, 7],
				prop: {
					a: 'b',
					b: true,
					c: null,
					d: 8765242,
					e: 'lorem ipsum',
				},
			});
		});

		it('reads and writes arrays', () => {
			readWriteObjectTest([0, 1, 0xff, 0xffff, 0xffffff, 1.5, Math.PI]);
		});

		it('reads and writes long arrays', () => {
			readWriteObjectTest([
				0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
				0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
				0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
				0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
			]);
		});

		it('reads and writes arrays of negative numbers', () => {
			readWriteObjectTest([0, -1, -0x3f, -0x1fff, -0x1fffff, -1.5, -Math.PI]);
		});

		it('measures arrays', () => {
			measureObjectTest(
				[0, 1, 0xff, 0xffff, 0xffffff, 1.5, Math.PI],
				1 + 1 + 1 + (1 + 1) + (1 + 2) + (1 + 4) + (1 + 4) + (1 + 8));
		});

		it('measures arrays of negative numbers', () => {
			measureObjectTest(
				[0, -1, -0x3f, -0x1fff, -0x1fffff, -1.5, -Math.PI],
				1 + 1 + 1 + (1 + 1) + (1 + 2) + (1 + 4) + (1 + 4) + (1 + 8));
		});

		it('measures long arrays', () => {
			measureObjectTest([
				0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
				0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
				0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
				0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
			], 42);
		});

		it('measures strings', () => {
			measureObjectTest(['foobar'], 8);
		});

		it('reads and writes objects with repeated strings', () => {
			readWriteObjectTest({
				bar: 'bar',
				x: 'foo',
				y: 'bar',
				values: [1, 'bar', 'bar'],
			});
		});

		it('reads and writes objects with empty strings', () => {
			readWriteObjectTest({
				x: '',
			});
		});

		it('reads and writes objects with repeated keys', () => {
			readWriteObjectTest([
				{ value: 'bar' },
				{ value: 'boo' },
				{ value: 'abc' },
				{ value: 'def' },
				{ value: 'omg' },
			]);
		});

		it.skip('reads and writes objects with empty string keys', () => {
			readWriteObjectTest([
				{ '': 'bar' },
			]);
		});

		it('throws for invalid type (function)', () => {
			expect(() => readWriteObjectTest({
				foo() { },
			})).throw('Invalid type: ');
		});
	});
});
