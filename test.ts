module A {
    class B {

    }
    export class A {

        private e<T extends B>(a:T):T {
            return a;
        }
    }
}