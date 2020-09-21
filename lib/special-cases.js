/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const _ = require('lodash')

const specialCases = {
	DATE_VALUE: 'DATE_VALUE',
	AGGREGATE: 'AGGREGATE'
}

/**
 * Checks whether the supplied expression is a call expression, called by an identifier
 *
 * @param {String} type - The type of expression (should be 'CallExpression')
 * @param {Object} callee - An object describing the callee of the expression
 * @returns {Boolean}
 * @example
 *
 * isCallExpression('CallExpression, { type: 'Identifier'})
 */
const isCallExpression = (type, callee) => {
	return type === 'CallExpression' && callee.type === 'Identifier'
}

/**
 * Checks basic conditions all our special cases match -
 * that the expression is a call expression and it is run on events
 *
 * @param {String} type - The type of expression (should be 'CallExpression')
 * @param {Object} callee - An object describing the callee of the expression
 * @param {Object} arg - An object describing the first argument passed to the expression
 * @returns {Boolean}
 * @example
 *
 * checkBasics('CallExpression, { type: 'Identifier'}, { type: 'Identifier', name: '$events' })
 */
const checkBasics = (type, callee, arg) => {
	const isRunningOnEvents = arg.type === 'Identifier' && arg.name === '$events'
	return isCallExpression(type, callee) && isRunningOnEvents
}

/**
 * Checks to see if the expression uses the DATE_VALUE forumula -
 * either as the first OR the second formula in a tree of expressions
 *
 * @param {String} type - The type of expression (should be 'CallExpression')
 * @param {Object} callee - An object describing the callee of the expression
 * @param {List} args - A list containing objects which describe the arguments passed to the expression
 * @returns {Boolean}
 * @example
 *
 * usesDataValue('CallExpression,
 *               { type: 'Identifier', name: 'DATE_VALUE' },
 *               args: [{
 *                 type: 'CallExpression',
 *                 callee: {
 *                   type: 'Identifier',
 *                   name: '$events'
 *                 },
 *                 events: []
 *               }])
 */
const usesDateValue = (type, callee, args) => {
	const isDateValueFormula = callee.name === specialCases.DATE_VALUE

	if (isDateValueFormula && isCallExpression(type, callee)) {
		return true
	}

	// Checks to see if the next formula is DATE_VALUE
	// (in the event of a MIN or MAX being applied)
	const firstArg = _.get(args, [ 0 ])
	if (!firstArg || !firstArg.arguments) {
		return false
	}
	const passesBasicChecks = checkBasics(firstArg.type, firstArg.callee, firstArg.arguments[0])
	return passesBasicChecks && firstArg.callee.name === specialCases.DATE_VALUE
}

/**
 * Checks whether the supplied expression matches our special cases
 *
 * @param {Object} root0 - A expression as described by esprima
 * @param {String} root0.type - The type of expression (should be 'CallExpression')
 * @param {Object} root0.callee - An object describing the expression caller
 * @param {List} root0.arguments - Arguments passed to the expression
 * @returns {String} - representing the formula that matches our special case
 * @example
 *
 * checkForSpecialCases({
 *   type: 'Call Expression',
 *   callee: { type: 'Identifier', name: 'AGGREGATE'},
 *   arguments: [{
 *     type: 'Identifier',
 *     name: '$events'
 *   }]
 * })
 */
exports.findSpecialCases = ({
	type, callee, arguments: args
}) => {
	const passesBasicChecks = checkBasics(type, callee, args[0])
	const usesAggregate = callee.name === specialCases.AGGREGATE

	if (passesBasicChecks && usesAggregate) {
		return specialCases.AGGREGATE
	}

	if (usesDateValue(type, callee, args)) {
		return specialCases.DATE_VALUE
	}
	return null
}

/**
 * Finds the action needed for the special case
 *
 * @param {Sting} specialCase - A string representing the formula of our special case
 * @returns {String} - the action type our trigger needs to run for the formula
 * @example
 *
 * getActionForSpecialCase(AGGREGATE)
 */
exports.getActionForSpecialCase = (specialCase) => {
	switch (specialCase) {
		case specialCases.AGGREGATE:
			return 'action-set-add@1.0.0'
		case specialCases.DATE_VALUE:
		default:
			return 'action-set-update@1.0.0'
	}
}
