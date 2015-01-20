module A {

    export class C {

        d<T extends (string | number)>(a: T): T {
            return a;
        }
    }
}