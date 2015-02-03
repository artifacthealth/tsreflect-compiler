# TsReflect Compiler

The TsReflect compiler is a modified version of the [TypeScript](http://www.typescriptlang.org/) 1.4 compiler that emits JSON
declaration files containing type information for your TypeScript source files. The JSON declaration files are similar
to the .d.ts declaration files that TypeScript generates. However, the JSON format allows for easier loading of type information
at runtime. Additionally, the compiler leverages JsDoc tags to add custom annotations to TypeScript. See the Custom Annotations
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

The TsReflect Compiler leverages JsDoc comments to add custom annotations to TypeScript. Similar to [java annotations](http://en.wikipedia.org/wiki/Java_annotation) or
[C# attributes](https://msdn.microsoft.com/en-us/library/aa288454%28v=vs.71%29.aspx) custom annotations allow for metadata to be added to TypeScript source code
and then included in the JSON declaration files that the TsReflect Compiler generates.

For example, custom annotations could be used to add [JPA](http://en.wikipedia.org/wiki/Java_Persistence_API)-style annotations to classes for an ORM:

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

