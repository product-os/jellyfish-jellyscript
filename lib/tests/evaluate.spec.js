/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const ava = require('ava')
const jellyscript = require('../')

ava('.evaluate(): should return null if no input', (test) => {
	const result = jellyscript.evaluate('POW(input, 2)', {
		context: {},
		input: null
	})

	test.deepEqual(result, {
		value: null
	})
})

ava('.evaluate(): should resolve a number formula', (test) => {
	const result = jellyscript.evaluate('POW(input, 2)', {
		context: {
			number: 2
		},
		input: 2
	})

	test.deepEqual(result, {
		value: 4
	})
})

ava('.evaluate(): should resolve composite formulas', (test) => {
	const result = jellyscript.evaluate('MAX(POW(input, 2), POW(input, 3))', {
		context: {
			number: 2
		},
		input: 2
	})

	test.deepEqual(result, {
		value: 8
	})
})

ava('.evaluate(): should access other properties from the card', (test) => {
	const result = jellyscript.evaluate('ADD(this.value1, this.value2)', {
		context: {
			value1: 2,
			value2: 3
		},
		input: 0
	})

	test.deepEqual(result, {
		value: 5
	})
})

ava('.evaluate(): should evaluate a function', (test) => {
	const result = jellyscript.evaluate('POW', {
		context: {},
		input: 0
	})

	test.is(result.value(2, 2), 4)
	test.is(result.value(3, 2), 9)
})
