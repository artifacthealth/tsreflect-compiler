var A: {

    /**
     * property description
     */
    a: string;

    /**
     * method description
     */
    b(): void;

    /**
     * call signature description
     * @param a The 'a' param
     */
    (a: number): number;

    /**
     * construct signature description
     */
    new (): number;

    /*
     * Note: Annotations and descriptions do not work on index signatures in anonymous types
     * [key: number]: boolean;
     */
}