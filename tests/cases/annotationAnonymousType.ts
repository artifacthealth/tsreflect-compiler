var A: {

    /**
     * @annotation propertyAnnotation
     */
    a: string;

    /**
     * @annotation methodAnnotation
     */
    b(): void;

    /**
     * @annotation callSignatureAnnotation
     */
    (a: number): number;

    /**
     * @annotation constructSignatureAnnotation
     */
    new (): number;

    /*
     * Note: Annotations and descriptions do not work on index signatures in anonymous types
     * [key: number]: boolean;
     */
}