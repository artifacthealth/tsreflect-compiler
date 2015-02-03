# TsReflect Compiler

The TsReflect compiler is a modified version of the [TypeScript](http://www.typescriptlang.org/) 1.4 compiler that emits JSON
declaration files, containing type information for your TypeScript source files. The JSON declaration files are similar
to the .d.ts declaration files that TypeScript generates. However, the JSON format allows for easier loading of type information
at runtime. Additionally, the compiler leverages JsDoc comments to add custom annotations to TypeScript. See the Custom Annotations
section below for more information.


## Building

In order to build the TsReflect compiler, ensure that you have [Git](http://git-scm.com/downloads) and [Node.js](http://nodejs.org/) installed.

Clone a copy of the repo:

```
git clone https://github.com/artifacthealth/tsreflect-compiler.git
```

Change to the tsreflect-compiler directory:

```
cd tsreflect-compiler
```

Install dev dependencies:

```
npm install
```

Run the following to build and test:

```
grunt
```


## Usage

```shell
node lib/tsreflect-compiler.js hello.ts
```


## Example Output

Below is an example of a simple global class declaration for a ```Calculator``` class containing a single method ```add```.
For more example output, take a look at the JSON declaration file generated for [lib.core.d.ts](https://github.com/artifacthealth/tsreflect-compiler/blob/master/lib/lib.core.d.json).

```
{
	"declares": [
		{
			"kind": "class",
			"name": "Calculator",
			"members": [
				{
					"kind": "method",
					"name": "add",
					"parameters": [
						{
							"name": "x",
							"type": "number"
						},
						{
							"name": "y",
							"type": "number"
						}
					],
					"returns": "number"
				}
			]
		}
	]
}
```


## Custom Annotations

The TsReflect Compiler leverages JsDoc comments to add custom annotations to TypeScript. Similar to
[java annotations](http://en.wikipedia.org/wiki/Java_annotation) or
[C# attributes](https://msdn.microsoft.com/en-us/library/aa288454%28v=vs.71%29.aspx) custom annotations allow for
metadata to be added to TypeScript source code and then included in the JSON declaration files that the TsReflect
Compiler generates.

Custom annotation work alongside standard JsDoc annotations. The TsReflect compiler will ignore all standard JsDoc
annotations. The [tsreflect.config.json](https://github.com/artifacthealth/tsreflect-compiler/blob/master/lib/tsreflect.config.json)
file in the ```lib/``` directory contains a list of ignored annotations. This list can be modified to suite your notes.

For example, custom annotations can be used to add [JPA](http://en.wikipedia.org/wiki/Java_Persistence_API)-style
annotations to classes for an ORM:

```
/**
 * An entity for a Customer.
 * @entity
 * @table "customers"
 */
class Customer {

    /** @id */
    id: number;

    /**
     * The name of the customer.
     * @column name: "customerName", length: 255
     */
    name: string;
}
```

The above TypeScript generates the following JSON declaration output:
```
{
	"declares": [
		{
			"kind": "class",
			"name": "Customer",
			"description": "An entity for a Customer.",
			"annotations": [
				{
					"name": "entity",
					"value": true
				},
				{
					"name": "table",
					"value": "customers"
				}
			],
			"members": [
				{
					"kind": "field",
					"name": "id",
					"type": "number",
					"annotations": [
						{
							"name": "id",
							"value": true
						}
					]
				},
				{
					"kind": "field",
					"name": "name",
					"type": "string",
					"description": "The name of the customer.",
					"annotations": [
						{
							"name": "column",
							"value": {
								"name": "customerName",
								"length": 255
							}
						}
					]
				}
			]
		}
	]
}
```


## CommonJS Library

The TsReflect compiler can be included as a CommonJS module in a NodeJS application. A typescript declaration file
 ```tsreflect-compiler.d.ts``` is included in the ```lib``` directory. Below is an example of executing
the compiler from a TypeScript program.

```
/// <reference path="./lib/tsreflect-compiler.d.ts" />

import compiler = require("tsreflect-compiler");

var diagnostics = compiler.compile("./hello.ts");
```

Executing the code above will generate a file called ```hello.d.json```. Any errors will be returned as an array and
assigned to the ```diagnostics``` variable.


## Grunt Plug-in

There is a Grunt plug-in available for the TsReflect compiler to allow for generating JSON declaration files
as part of a Grunt build process. See the [grunt-tsreflect](https://github.com/artifacthealth/grunt-tsreflect) project.
