module A {

    export class C {

        private a: string;

        private b(a: number): number;
        private b(a: string): number;
        private b(a: any): number {

            return 0;
        }

        private get c(): string {
            return "";
        }

        private set c(value: string) {
        }

        private d<T extends { a: string }>(a: T): T {
            return a;
        }
    }
}