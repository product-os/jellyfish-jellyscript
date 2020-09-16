/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const ava = require('ava')
const jellyscript = require('../')

const firstDateString = '2020-09-09T08:23:59.370Z'
const secondDateString = '2020-09-09T08:25:59.370Z'

const input = [
	{
		created_at: firstDateString
	},
	{
		created_at: secondDateString
	}
]

ava('DATE_VALUE: should return a list of dates (as epoch values)', (test) => {
	const result = jellyscript.evaluate('DATE_VALUE(input, PARTIAL_RIGHT(GET_PROPERTY, "created_at"))', {
		context: {},
		input
	})

	const firstDate = new Date(firstDateString)
	const secondDate = new Date(secondDateString)

	test.deepEqual(result, {
		value: [ firstDate.getTime(), secondDate.getTime() ]
	})
})

ava('DATE_VALUE can be used with MAX to return the newest date', (test) => {
	const result = jellyscript.evaluate('MAX(DATE_VALUE(input, PARTIAL_RIGHT(GET_PROPERTY, "created_at")))', {
		context: {},
		input
	})

	const secondDate = new Date(secondDateString)

	test.deepEqual(result, {
		value: secondDate.getTime()
	})
})

ava('DATE_VALUE can be used with MIN to return the oldest date', (test) => {
	const result = jellyscript.evaluate('MIN(DATE_VALUE(input, PARTIAL_RIGHT(GET_PROPERTY, "created_at")))', {
		context: {},
		input
	})

	const firstDate = new Date(firstDateString)

	test.deepEqual(result, {
		value: firstDate.getTime()
	})
})
