/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import flatMap from 'lodash/flatMap';
import flip from 'lodash/flip';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import isError from 'lodash/isError';
import isNull from 'lodash/isNull';
import isMatch from 'lodash/isMatch';
import partial from 'lodash/partial';
import set from 'lodash/set';
import uniq from 'lodash/uniq';
import * as ESTree from 'estree';
import type { ContractDefinition } from '@balena/jellyfish-types/build/core';
import { JSONSchema7Object } from 'json-schema';
import formula from '@formulajs/formulajs';
import staticEval from 'static-eval';
import * as esprima from 'esprima';
import * as assert from '@balena/jellyfish-assert';
import { Operation, ReplaceOperation } from 'fast-json-patch';
import * as card from './card';
import type { JSONSchema } from './types';

// TS-TODO: The esprima @types package doesn't include a definition for 'parse',
// so we've manually defined it here.
// Ideally the return type should be 'esprima.Program | esprima.Script'.
interface WithParse {
	parse: (expression: string) => esprima.Program;
}
const parse = ((esprima as unknown) as WithParse).parse;

formula.PARTIAL = partial;
formula.FLIP = flip;
formula.PROPERTY = get;
formula.FLATMAP = flatMap;
formula.UNIQUE = uniq;

formula.REGEX_MATCH = (
	regex: string | RegExp,
	str: string,
): RegExpMatchArray | null => {
	return str.match(regex);
};

formula.AGGREGATE = <T>(list: T[], func: (item: T) => Iterable<T>): T[] => {
	return Array.from(
		list.reduce((accumulator, element) => {
			for (const value of func(element)) {
				accumulator.add(value);
			}

			return accumulator;
		}, new Set<T>()),
	);
};

export interface Options {
	context: any;
	input: any;
}

const runAST = (ast: ESTree.Expression, options: Options): any => {
	return staticEval(
		ast,
		Object.assign(
			{
				this: options.context,
				input: options.input,
			},
			formula,
		),
	);
};

export const evaluate = (
	expression: string,
	options: Options,
): {
	value: any;
} => {
	assert.INTERNAL(null, expression, Error, 'No expression provided');

	const ast = (parse(expression).body[0] as ESTree.ExpressionStatement)
		.expression;

	const result = runAST(ast, {
		context: options.context,
		input: options.input,
	});

	if (isError(result)) {
		return {
			value: null,
		};
	}

	return {
		value: result || null,
	};
};

const getDefaultValueForType = (type: string): null | [] => {
	switch (type) {
		case 'array':
			return [];
		default:
			return null;
	}
};

interface Paths {
	[key: string]: card.FormulaPath;
}

export const evaluatePatch = (
	schema: JSONSchema,
	object: JSONSchema7Object,
	patch: Operation[],
) => {
	const paths = card
		.getFormulasPaths(schema)
		.reduce<Paths>((accumulator, path) => {
			accumulator[`/${path.output.join('/')}`] = path;
			return accumulator;
		}, {});

	for (const operation of patch) {
		if (
			operation.op === 'test' ||
			operation.op === 'remove' ||
			!paths[operation.path]
		) {
			continue;
		}

		if (operation.op === 'copy' || operation.op === 'move') {
			const source = get(object, operation.from.split('/').slice(1));
			const res = evaluate(paths[operation.path].formula, {
				input: source,
				context: object,
			});

			if (!isNull(res.value)) {
				Reflect.deleteProperty(operation, 'from');
				const replaceOperation = (operation as unknown) as ReplaceOperation<any>;
				replaceOperation.op = 'replace';
				replaceOperation.value = res.value;
			}

			continue;
		}

		const result = evaluate(paths[operation.path].formula, {
			input: operation.value,
			context: object,
		});

		if (!isNull(result.value)) {
			operation.value = result.value;
		}
	}

	return patch;
};

export const evaluateObject = (
	schema: JSONSchema,
	object: JSONSchema7Object,
) => {
	for (const path of card.getFormulasPaths(schema)) {
		if (isEmpty(object)) {
			continue;
		}

		const input = get(object, path.output, getDefaultValueForType(path.type));

		const result = evaluate(path.formula, {
			context: object,
			input,
		});

		if (!isNull(result.value)) {
			// Mutates input object
			set(object, path.output, result.value);
		}
	}

	return object;
};

const slugify = (str: string): string => {
	return str
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-{1,}/g, '-');
};

// Aggregating links is a special case. This is the expected base AST structure.
// Note: this translates to a $$formula in the following format:
// $$formula: 'UNIQUE(FLATMAP($events, "<SOURCE_PATH>"))'

const LINKS_AGGREGATE_BASE_AST = {
	type: 'CallExpression',
	callee: {
		type: 'Identifier',
		name: 'AGGREGATE',
	},
	arguments: [
		{
			type: 'Identifier',
			name: '$events',
		},
		{
			// "value": "<SOURCE_PATH>",
			// "raw": "'<SOURCE_PATH>'",
			type: 'Literal',
		},
	],
};

const LINKS_UNIQUE_FLATMAP_BASE_AST = {
	type: 'CallExpression',
	callee: {
		type: 'Identifier',
		name: 'UNIQUE',
	},
	arguments: [
		{
			type: 'CallExpression',
			callee: {
				type: 'Identifier',
				name: 'FLATMAP',
			},
			arguments: [
				{
					type: 'Identifier',
					name: '$events',
				},
				{
					// "value": "<SOURCE_PATH>",
					// "raw": "'<SOURCE_PATH>'",
					type: 'Literal',
				},
			],
		},
	],
};

// TS-TODO: use TypeContract interface instead of Contract
export const getTypeTriggers = (typeCard: ContractDefinition) => {
	// TS-TODO: use TriggeredActionDefinition interface instead of ContractDefinition
	const triggers: ContractDefinition[] = [];

	// TS-TODO: remove optional chaining once we use TypeContract
	for (const path of card.getFormulasPaths(
		typeCard?.data?.schema as JSONSchema,
	)) {
		// TS-TODO: remove cast to any once esprima TypeScript types are completed
		const ast = (parse(path.formula).body[0] as ESTree.ExpressionStatement)
			.expression as any;

		// Aggregating over links is a special case
		if (
			isMatch(ast, LINKS_AGGREGATE_BASE_AST) ||
			isMatch(ast, LINKS_UNIQUE_FLATMAP_BASE_AST)
		) {
			const literal =
				ast.callee.name === 'AGGREGATE'
					? ast.arguments[1]
					: ast.arguments[0].arguments[1];
			const arg = runAST(literal, {
				context: {},
				input: {},
			});

			const valueProperty = `source.${arg}`;

			triggers.push({
				slug: slugify(
					`triggered-action-${typeCard.slug}-${path.output.join('-')}`,
				),
				type: 'triggered-action@1.0.0',
				version: '1.0.0',
				active: true,
				requires: [],
				capabilities: [],
				markers: [],
				tags: [],
				data: {
					schedule: 'async',
					action: 'action-set-add@1.0.0',
					type: `${typeCard.slug}@${typeCard.version}`,
					target: {
						$eval: "source.links['is attached to'][0].id",
					},
					arguments: {
						property: path.output.join('.'),
						value: {
							$if: valueProperty,
							then: {
								$eval: valueProperty,
							},
							else: [],
						},
					},
					filter: {
						type: 'object',
						required: ['type', 'data'],
						$$links: {
							'is attached to': {
								type: 'object',
								required: ['type'],
								properties: {
									type: {
										type: 'string',
										const: `${typeCard.slug}@${typeCard.version}`,
									},
								},
							},
						},
						properties: {
							type: {
								type: 'string',
								not: {
									enum: ['create@1.0.0', 'update@1.0.0'],
								},
							},
							data: {
								type: 'object',
								required: ['payload'],
								properties: {
									payload: {
										type: 'object',
									},
								},
							},
						},
					},
				},
			});
		}
	}

	return triggers;
};
