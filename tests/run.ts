/// <reference path="../typings/node.d.ts"/>
/// <reference path="../typings/mocha.d.ts"/>
/// <reference path="../typings/chai.d.ts"/>


import fs = require("fs");
import path = require("path");
import chai = require("chai");

import expect = chai.expect;

import compiler = require("./tsreflect-compiler");

var testCasesDir = "tests/cases/";
var optionsDir = "tests/options/";
var referenceBaselineDir = "tests/baselines/reference/";
var localBaselineDir = "tests/baselines/local/";

function setupCases(): void {

    processDir(testCasesDir, "ts", setupCase);
}

function processDir(path: string, ext: string, cb: (filename: string) => void): void {

    var files = fs.readdirSync(path);
    var filter = new RegExp("\." + ext + "$");

    for (var i = 0, l = files.length; i < l; i++) {

        var filename = files[i];
        // filter out anything but *.ts
        if(filter.test(filename)) {
            cb(files[i]);
        }
    }
}

function setupCase(filename: string): void {

    var baseName = path.basename(filename, ".ts");

    describe('Case ' + filename, () => {

        var diagnostics: compiler.Diagnostic[];
        var errorsFilename = baseName + ".errors.txt";
        var declarationFilename = baseName + ".d.json";

        before(() => {

            deleteFile(localBaselineDir + errorsFilename);
            deleteFile(localBaselineDir + declarationFilename);

            var compilerOptions: compiler.CompilerOptions = loadOptions(baseName);

            compilerOptions.outDir = localBaselineDir;
            compilerOptions.libPath = "lib.core.d.ts";

            diagnostics = compiler.compile([testCasesDir + filename], compilerOptions);

            if(diagnostics.length > 0) {
                fs.writeFileSync(localBaselineDir + errorsFilename , diagnosticsToString(diagnostics) , "utf8");
            }
        });

        it('should have correct errors in ' + errorsFilename, () => {

            compareToBaseline(errorsFilename);
        });

        it('should have correct compiled json declaration in ' + declarationFilename, () => {

            compareToBaseline(declarationFilename);
        });

        after(() => {
            diagnostics = undefined;
            errorsFilename = undefined;
            declarationFilename = undefined;
        });
    });
}

function loadOptions(baseName: string): compiler.CompilerOptions {

    var path = testCasesDir + baseName + ".options.json";

    if(!fs.existsSync(path)) {

        return {};
    }

    return JSON.parse(fs.readFileSync(path, "utf8"));
}

function diagnosticsToString(diagnostics: compiler.Diagnostic[]): string {

    var ret = "";

    for (var i = 0; i < diagnostics.length; i++) {
        ret += diagnosticToString(diagnostics[i]);
    }

    return ret;
}

function diagnosticToString(diagnostic: compiler.Diagnostic): string {
    
    var ret = "";

    if(diagnostic.filename) {
        ret += diagnostic.filename + "(" + diagnostic.line + "," + diagnostic.character + "): ";
    }

    var category = compiler.DiagnosticCategory[diagnostic.category].toLowerCase();
    ret += category + " TS" + diagnostic.code + ": " + diagnostic.messageText + "\n";

    return ret;
}

function deleteFile(filePath: string): void {

    if(fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

function compareToBaseline(filename: string): void {

    var localFilename = localBaselineDir + filename;
    var referenceFilename = referenceBaselineDir + filename;

    var localExists = fs.existsSync(localFilename);
    var referenceExists = fs.existsSync(referenceFilename);

    if(localExists && !referenceExists) {
        throw new Error("Unexpected file " + filename);
    }

    if(referenceExists && !localExists) {
        throw new Error("Missing file " + filename);
    }

    expect(readFile(localBaselineDir + filename), "Baseline changed for " + filename)
        .to.deep.equal(readFile(referenceBaselineDir + filename));
}

function readFile(filePath: string): any {

    var isJsonFile = path.extname(filePath) == ".json";

    if(!fs.existsSync(filePath)) {
        return isJsonFile ? {} : "";
    }

    var text = fs.readFileSync(filePath, "utf8");
    return isJsonFile ? JSON.parse(text) : text;
}

setupCases();