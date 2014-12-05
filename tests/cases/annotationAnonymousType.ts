var A: {

    /**
     * @propertyAnnotation
     */
    a: string;

    /**
     * @methodAnnotation
     */
    b(): void;

    /**
     * @callSignatureAnnotation
     */
    (a: number): number;

    /**
     * @constructSignatureAnnotation
     */
    new (): number;

    /*
     * Note: Annotations and descriptions do not work on index signatures in anonymous types
     * [key: number]: boolean;
     */
}