module A {

    class B {

    }

    export class C {

        private a: B;

        private b(a: B): void {
        }

        private c(): B {
            return null;
        }

        private get d(): B {
            return null;
        }

        private set d(value: B) {

        }

        private e<T extends B>(a: T): T {
            return a;
        }
    }
}