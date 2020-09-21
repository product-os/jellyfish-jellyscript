/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const _ = require('lodash')
const staticEval = require('static-eval')
const esprima = require('esprima')
const assert = require('@balena/jellyfish-assert')
const card = require('./card')
const formula = require('./formula')
const {
	findSpecialCases,
	getActionForSpecialCase
} = require('./special-cases')

/**
 * Jellyscript module.
 *
 * @module jellyscript
 */

const runAST = (ast, options) => {
	return staticEval(ast, Object.assign({
		this: options.context,
		input: options.input
	}, formula))
}

exports.evaluate = (expression, options) => {
	assert.INTERNAL(null, expression, Error, 'No expression provided')

	const ast = esprima.parse(expression).body[0].expression

	const result = runAST(ast, {
		context: options.context,
		input: options.input
	})

	if (_.isError(result)) {
		return {
			value: null
		}
	}

	return {
		value: result || null
	}
}

const getDefaultValueForType = (type) => {
	switch (type) {
		case 'array': return []
		default: return null
	}
}

exports.evaluatePatch = (schema, object, patch) => {
	const paths = card.getFormulasPaths(schema).reduce((accumulator, path) => {
		accumulator[`/${path.output.join('/')}`] = path
		return accumulator
	}, {})

	for (const operation of patch) {
		if (operation.op === 'test' ||
			operation.op === 'remove' ||
			!paths[operation.path]) {
			continue
		}

		if (operation.op === 'copy' || operation.op === 'move') {
			const source = _.get(object, operation.from.split('/').slice(1))
			const result = exports.evaluate(paths[operation.path].formula, {
				input: source,
				context: object
			})

			if (!_.isNull(result.value)) {
				Reflect.deleteProperty(operation, 'from')
				operation.op = 'replace'
				operation.value = result.value
			}

			continue
		}

		const result = exports.evaluate(paths[operation.path].formula, {
			input: operation.value,
			context: object
		})

		if (!_.isNull(result.value)) {
			operation.value = result.value
		}
	}

	return patch
}

exports.evaluateObject = (schema, object) => {
	for (const path of card.getFormulasPaths(schema)) {
		if (_.isEmpty(object)) {
			continue
		}

		const input = _.get(object, path.output, getDefaultValueForType(path.type))

		const result = exports.evaluate(path.formula, {
			context: object,
			input
		})

		if (!_.isNull(result.value)) {
			// Mutates input object
			_.set(object, path.output, result.value)
		}
	}

	return object
}

const slugify = (string) => {
	return string
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-{1,}/g, '-')
}

exports.getTypeTriggers = (typeCard) => {
	const triggers = []

	for (const path of card.getFormulasPaths(typeCard.data.schema)) {
		const ast = esprima.parse(path.formula).body[0].expression

		const specialCase = findSpecialCases(ast)
		if (specialCase) {
			const literal = ast.arguments[1] || ast.arguments[0].arguments[1]
			const arg = runAST(literal, {
				context: {},
				input: {}
			})

			const valueProperty = `source.${arg}`

			const action = getActionForSpecialCase(specialCase)

			triggers.push({
				slug: slugify(`triggered-action-${typeCard.slug}-${path.output.join('-')}`),
				type: 'triggered-action@1.0.0',
				version: '1.0.0',
				active: true,
				links: {},
				requires: [],
				capabilities: [],
				markers: [],
				tags: [],
				data: {
					async: true,
					action,
					type: `${typeCard.slug}@${typeCard.version}`,
					target: {
						$eval: 'source.links[\'is attached to\'][0].id'
					},
					arguments: {
						property: path.output.join('.'),
						value: {
							$if: valueProperty,
							then: {
								$eval: valueProperty
							},
							else: []
						}
					},
					filter: {
						type: 'object',
						required: [ 'data' ],
						$$links: {
							'is attached to': {
								type: 'object',
								required: [ 'type' ],
								properties: {
									type: {
										type: 'string',
										const: `${typeCard.slug}@${typeCard.version}`
									}
								}
							}
						},
						properties: {
							data: {
								type: 'object',
								required: [ 'payload' ],
								properties: {
									payload: {
										type: 'object'
									}
								}
							}
						}
					}
				}
			})
		}
	}

	return triggers
}
