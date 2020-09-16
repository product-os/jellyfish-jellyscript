/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const formula = require('@formulajs/formulajs')
const _ = require('lodash')
formula.PARTIAL_RIGHT = _.partialRight
formula.GET_PROPERTY = _.get

formula.REGEX_MATCH = (regex, string) => {
	return string.match(regex)
}

formula.AGGREGATE = (list, func) => {
	return Array.from(list.reduce((accumulator, element) => {
		for (const value of func(element)) {
			accumulator.add(value)
		}

		return accumulator
	}, new Set()))
}

formula.DATE_VALUE = (list, func) => {
	return list.map((element) => {
		const dateString = func(element)
		const date = new Date(dateString)
		return date.getTime()
	})
}

module.exports = formula
