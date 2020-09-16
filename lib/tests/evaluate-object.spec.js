/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const ava = require('ava')
const jellyscript = require('../')

ava('.evaluateObject() should evaluate a number formula', async (test) => {
	const result = jellyscript.evaluateObject({
		type: 'object',
		properties: {
			foo: {
				type: 'number',
				$$formula: 'POW(input, 2)'
			}
		}
	}, {
		foo: 3
	})

	test.deepEqual(result, {
		foo: 9
	})
})

ava('.evaluateObject() should evaluate a formula in a $ prefixed property', async (test) => {
	const result = jellyscript.evaluateObject({
		type: 'object',
		properties: {
			$foo: {
				type: 'number',
				$$formula: 'POW(input, 2)'
			}
		}
	}, {
		$foo: 3
	})

	test.deepEqual(result, {
		$foo: 9
	})
})

ava('.evaluateObject() should evaluate a formula in a $$ prefixed property', async (test) => {
	const result = jellyscript.evaluateObject({
		type: 'object',
		properties: {
			$$foo: {
				type: 'number',
				$$formula: 'POW(input, 2)'
			}
		}
	}, {
		$$foo: 3
	})

	test.deepEqual(result, {
		$$foo: 9
	})
})

ava('.evaluateObject() should ignore missing formulas', async (test) => {
	const result = jellyscript.evaluateObject({
		type: 'object',
		properties: {
			foo: {
				type: 'number',
				$$formula: 'POW(input, 2)'
			}
		}
	}, {
		bar: 3
	})

	test.deepEqual(result, {
		bar: 3
	})
})

ava('.evaluateObject() should not ignore the zero number as missing', async (test) => {
	const result = jellyscript.evaluateObject({
		type: 'object',
		properties: {
			foo: {
				type: 'number',
				$$formula: 'MAX(input, 2)'
			}
		}
	}, {
		foo: 0
	})

	test.deepEqual(result, {
		foo: 2
	})
})

ava('.evaluateObject() should evaluate nested formulas', async (test) => {
	const result = jellyscript.evaluateObject({
		type: 'object',
		properties: {
			foo: {
				type: 'object',
				properties: {
					bar: {
						type: 'object',
						properties: {
							baz: {
								type: 'number',
								$$formula: 'POW(input, 2)'
							}
						}
					}
				}
			}
		}
	}, {
		foo: {
			bar: {
				baz: 2
			}
		}
	})

	test.deepEqual(result, {
		foo: {
			bar: {
				baz: 4
			}
		}
	})
})

ava('.evaluateObject() should not do anything if the schema has no formulas', async (test) => {
	const result = jellyscript.evaluateObject({
		type: 'object',
		properties: {
			foo: {
				type: 'string'
			},
			bar: {
				type: 'number'
			}
		}
	}, {
		foo: '1',
		bar: 2
	})

	test.deepEqual(result, {
		foo: '1',
		bar: 2
	})
})
