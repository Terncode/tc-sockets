import { stringLengthInBytes } from '../utf8';

export interface PacketWriter<TBuffer> {
	getBuffer(): TBuffer;
	init(size: number): void;
	writeInt8(value: number): void;
	writeUint8(value: number): void;
	writeInt16(value: number): void;
	writeUint16(value: number): void;
	writeInt32(value: number): void;
	writeUint32(value: number): void;
	writeFloat32(value: number): void;
	writeFloat64(value: number): void;
	writeBoolean(value: boolean): void;
	writeBytes(value: Uint8Array): void;
	writeString(value: string | null): void;
	writeObject(value: any): void;
	writeArrayBuffer(value: ArrayBuffer | null): void;
	writeArray<T>(value: T[] | null, writeOne: (item: T) => void): void;
	writeLength(value: number): void;
	measureString(value: string | null): number;
	measureObject(value: any): number;
	measureArrayBuffer(value: ArrayBuffer | null): number;
	measureArray<T>(value: T[] | null, measureOne: (item: T) => number): number;
	measureSimpleArray<T>(value: T[] | null, itemSize: number): number;
	measureLength(value: number): number;
}

export abstract class BasePacketWriter {
	measureString(value: string) {
		if (value == null) {
			return this.measureLength(-1);
		} else {
			const length = stringLengthInBytes(value);
			return this.measureLength(length) + length;
		}
	}
	measureObject(value: any) {
		if (value == null) {
			return this.measureLength(-1);
		} else {
			return this.measureString(JSON.stringify(value));
		}
	}
	measureArrayBuffer(value: ArrayBuffer | null) {
		if (value == null) {
			return this.measureLength(-1);
		} else {
			return this.measureLength(value.byteLength) + value.byteLength;
		}
	}
	measureArray<T>(value: T[] | null, measureOne: (item: T) => number) {
		if (value == null) {
			return this.measureLength(-1);
		} else {
			return this.measureLength(value.length) + value.reduce((sum, x) => sum + measureOne(x), 0);
		}
	}
	measureSimpleArray<T>(value: T[] | null, itemSize: number) {
		if (value == null) {
			return this.measureLength(-1);
		} else {
			return this.measureLength(value.length) + value.length * itemSize;
		}
	}
	measureLength(value: number) {
		return value === -1 ? 2 : (value < 0x7f ? 1 : (value < 0x3fff ? 2 : (value < 0x1fffff ? 3 : 4)));
	}
	writeBoolean(value: boolean) {
		this.writeUint8(value ? 1 : 0);
	}
	writeString(value: string | null) {
		if (value == null) {
			this.writeLength(-1);
		} else {
			this.writeLength(stringLengthInBytes(value));
			this.writeStringValue(value);
		}
	}
	writeObject(value: any) {
		if (value == null) {
			this.writeString('');
		} else {
			this.writeString(JSON.stringify(value));
		}
	}
	writeArrayBuffer(value: ArrayBuffer | null) {
		if (value == null) {
			this.writeLength(-1);
		} else {
			this.writeLength(value.byteLength);
			this.writeBytes(new Uint8Array(value));
		}
	}
	writeArray<T>(value: T[] | null, writeOne: (item: T) => void) {
		if (value == null) {
			this.writeLength(-1);
		} else {
			this.writeLength(value.length);
			value.forEach(writeOne);
		}
	}
	writeLength(value: number) {
		if (value === -1) {
			this.writeUint8(0x80);
			this.writeUint8(0x00);
		} else {
			do {
				this.writeUint8((value & 0x7f) | ((value >> 7) ? 0x80 : 0x00));
				value = value >> 7;
			} while (value);
		}
	}
	abstract writeUint8(value: number): void;
	abstract writeBytes(value: Uint8Array): void;
	protected abstract writeStringValue(value: string): void;
}
