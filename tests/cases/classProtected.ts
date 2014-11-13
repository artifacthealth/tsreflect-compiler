class C {

    protected a: string;

    protected b(a: number): number;
    protected b(a: string): number;
    protected b(a: any): number {

        return 0;
    }

    protected get c(): string {
        return "";
    }

    protected set c(value: string) {
    }

    protected d<T extends { a: string }>(a: T): T {
        return a;
    }
}

class B extends C {

    someFunc(): void {

        var a = this.c;
    }
}
