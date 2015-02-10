/**
 * @collection
 * @index keys: [ "a", 1 ]
 * @index keys: [ ["a", 1], ["b", -1] ]
 */
export class A {

    a: string;
    b: string;
}

/**
 * @index keys: [ "c", 1 ]
 */
export class B extends A {

    c: string;
}

/** @collection */
export class D {

    /** @index */
    a: string;

    /** @index order: -1 */
    g: number;

    /** @index dropDups: true */
    c: number;
}