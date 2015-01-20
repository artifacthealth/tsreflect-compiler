class C { foo() { } }
class D { foo2() { } }
class E extends C { foo3() { } }
class F extends C { foo4() { } }
var c: C, d: D, e: E, f: F;
var arr6 = [c, d];  // (C | D)[]
var arr7 = [c, d, e]; // (C | D)[]
var arr8 = [c, e]; // C[]
var arr9 = [e, f]; // (E|F)[]