class A<T> {
    a: T;
}

/**
 * Function type
 */
var b: (a: string, b: number) => void;

/**
 * Array type
 */
var c: string[];

/**
 * Constructor type
 */
var d: new (a: string, b?: any) => A<string>;

/**
 * Generic type
 */
var e: A<string>;

/**
 * Object type
 */
var f: {
    a: string;
    b: string;
}