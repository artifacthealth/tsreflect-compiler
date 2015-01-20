/** The const enum will calculate the OR'd value for E. A regular enum will not. */
const enum ConstantEnum {
    A=1,
    B=2,
    C=4,
    D=8,
    E = A|B
}

enum RegularEnum {
    A=1,
    B=2,
    C=4,
    D=8,
    E = A|B
}