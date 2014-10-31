interface Test {

    /** Property signature */
    a: string;

    /** Method signature */
    b(): void;

    /** Construct signature */
    new (): string;

    /** Index signature */
    [key: number]: string;

    /** Call signature */
    (a: any): void;
}