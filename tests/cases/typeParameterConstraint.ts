interface ITest {

}

function a<T extends string>() {

}

function b<T extends ITest>() {

}

function c<T extends {}>() {

}

function d<T extends any>() {

}

function e<T extends { a: string; b(): void }>() {

}

function f<T extends string[]>() {

}

function g<T extends () => boolean>() {

}
