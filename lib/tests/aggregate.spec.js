/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const ava = require('ava')
const jellyscript = require('../')

ava('AGGREGATE: should ignore duplicates', (test) => {
	const result = jellyscript.evaluate('AGGREGATE(input, PARTIAL_RIGHT(GET_PROPERTY, "mentions"))', {
		context: {},
		input: [
			{
				mentions: [ 'foo', 'bar' ]
			},
			{
				mentions: [ 'bar', 'baz' ]
			},
			{
				mentions: [ 'baz', 'qux' ]
			}
		]
	})

	test.deepEqual(result, {
		value: [ 'foo', 'bar', 'baz', 'qux' ]
	})
})

ava('AGGREGATE: should aggregate a set of object properties', (test) => {
	const result = jellyscript.evaluate('AGGREGATE(input, PARTIAL_RIGHT(GET_PROPERTY, "mentions"))', {
		context: {},
		input: [
			{
				mentions: [ 'foo' ]
			},
			{
				mentions: [ 'bar' ]
			}
		]
	})

	test.deepEqual(result, {
		value: [ 'foo', 'bar' ]
	})
})
