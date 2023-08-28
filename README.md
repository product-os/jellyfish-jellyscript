<div align="center">
  <img width="200" height="200" src="https://raw.githubusercontent.com/product-os/jellyfish-jellyscript/master/icon.png">
  <br>
  <br>

[![npm version](https://badge.fury.io/js/@balena%2Fjellyfish-jellyscript.svg)](https://badge.fury.io/js/@balena%2Fjellyfish-jellyscript)

  <h1>Jellyscript</h1>

  <p>
    Write computed properties in JSON Schema using javascript expressions.
    <br>
    https://product-os.github.io/jellyfish-jellyscript
  </p>
  <br>
  <br>
</div>

## Installation

Install `@balena/jellyfish-jellyscript` by running:

```sh
npm install --save @balena/jellyfish-jellyscript
```

## Usage

Jellyscript looks for the keyword `$$formula` in your schema and evaluates the expression it finds there.
The full object data being evaluated is provided to the script execution scope as `contract` and the current field being evaluated is provided as `input`.
A `$$formula` field must be an expression, and aliases and variables are not supported.
Jellyscript supports all the functions provided by [FormulaJS](https://formulajs.info/)

Below is an example how to use this library:

```typescript
import { Jellyscript } from '@balena/jellyfish-jellyscript';

const parser = new Jellyscript();

const schema = {
	type: 'object',
	properties: {
		number: {
			type: 'string',
			$$formula: 'SUM(contract.input, 10)',
		},
		lucky: {
			type: 'boolean',
			$$formula: 'contract.number === 13 ? true: false',
		},
		input: {
			type: 'number',
		},
	},
};

const data = {
	input: 3,
};

const result = parser.evaluateObject(schema, data);

console.log(result); // --> { lucky: true, number: 13, input: 3, }
```
