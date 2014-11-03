class A {

    private a<T extends { a: string }>(b:T) {
        return b;
    }
}