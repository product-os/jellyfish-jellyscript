/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const ava = require('ava')
const jellyscript = require('../')

ava('REGEX_MATCH: should consider duplicates', (test) => {
	const result = jellyscript.evaluate('REGEX_MATCH(/(@[a-zA-Z0-9-]+)/g, input)', {
		context: {},
		input: 'Hello @johndoe, and @janedoe, and @johndoe'
	})

	test.deepEqual(result, {
		value: [ '@johndoe', '@janedoe', '@johndoe' ]
	})
})

ava('REGEX_MATCH: should extract a set of mentions', (test) => {
	const result = jellyscript.evaluate('REGEX_MATCH(/(@[a-zA-Z0-9-]+)/g, input)', {
		context: {},
		input: 'Hello @johndoe, and @janedoe'
	})

	test.deepEqual(result, {
		value: [ '@johndoe', '@janedoe' ]
	})
})
