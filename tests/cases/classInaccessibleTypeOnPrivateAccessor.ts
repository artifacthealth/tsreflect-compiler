module A {

    class B {

    }

    export class C {

        private get a(): string {
            return null;
        }

        private set a(value: string) {
        }

        private get d(): B {
            return null;
        }

        private set d(value: B) {
        }
    }
}