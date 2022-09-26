export declare const enum Type {
    Special = 0,
    Number = 32,
    String = 64,
    Array = 96,
    Object = 128,
    TinyPositiveNumber = 160,
    TinyNegativeNumber = 192,
    StringRef = 224
}
export declare const enum Special {
    Undefined = 0,
    Null = 1,
    True = 2,
    False = 3,
    Uint8Array = 4
}
export declare const enum NumberType {
    Int8 = 0,
    Uint8 = 1,
    Int16 = 2,
    Uint16 = 3,
    Int32 = 4,
    Uint32 = 5,
    Float32 = 6,
    Float64 = 7
}
