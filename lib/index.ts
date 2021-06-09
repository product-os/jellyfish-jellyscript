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
import { core } from '@balena/jellyfish-types';
import { JSONSchema7Object } from 'json-schema';
import formula from '@formulajs/formulajs';
import staticEval from 'static-eval';
import * as esprima from 'esprima';
import * as assert from '@balena/jellyfish-assert';
import * as jsonpatch from 'fast-json-patch';
import * as card from './card';
import type { JSONSchema } from './types';
import _ from 'lodash';
import * as objectDeepSearch from 'object-deep-search';
import { getSourceTypes, reverseLink } from './utils';

// TS-TODO: The esprima @types package doesn't include a definition for 'parse',
// so we've manually defined it here.
// Ideally the return type should be 'esprima.Program | esprima.Script'.
interface WithParse {
	parse: (expression: string) => esprima.Program;
}
const parse = (esprima as unknown as WithParse).parse;

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
	if (result === undefined) {
		return {
			value: null,
		};
	}

	return {
		value: result,
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

export const getFormulasPaths = card.getFormulasPaths;

export const evaluatePatch = (
	schema: JSONSchema,
	object: JSONSchema7Object,
	patches: jsonpatch.Operation[],
) => {
	// The patch may affect other evaluated fields on the card.
	// Generate a patched object and evaluate it. Then compare it to the original
	// object to get a final list of patches to apply.
	const patchedObject = _.cloneDeep(object);
	const failedPatches: jsonpatch.Operation[] = [];
	for (const patch of patches) {
		try {
			jsonpatch.applyPatch(patchedObject, [patch], false, true);
		} catch (err) {
			failedPatches.push(patch);
		}
	}
	const evaluatedPatchedObject = evaluateObject(schema, patchedObject);
	const evaluatedPatches = jsonpatch.compare(object, evaluatedPatchedObject);
	return evaluatedPatches.concat(failedPatches);
};

export const evaluateObject = <T extends JSONSchema7Object>(
	schema: JSONSchema,
	object: T,
): T => {
	if (isEmpty(object)) {
		return object;
	}
	for (const path of card.getFormulasPaths(schema)) {
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

const LINKS_REFERENCE_AST = {
	type: 'MemberExpression',
	object: {
		type: 'MemberExpression',
		object: {
			type: 'ThisExpression',
		},
		property: {
			type: 'Identifier',
			name: 'links',
		},
	},
	property: {
		type: 'Literal',
	},
};

type LinkRef = typeof LINKS_REFERENCE_AST & {
	property: { value: string };
};

export const getReferencedLinkVerbs = <
	T extends Pick<core.TypeContract, 'data'>,
>(
	typeCard: T,
): string[] => {
	const formulas = getFormulasPaths(typeCard.data.schema).map((f) => f.formula);
	const formulaAst = formulas.map((f) => parse(f));
	const linkExpressions = formulaAst.flatMap((ast) =>
		objectDeepSearch.find<LinkRef>(ast, LINKS_REFERENCE_AST),
	);
	const linkVerbs = linkExpressions.reduce(
		(linkSet, l) => linkSet.add(l.property.value),
		new Set<string>(),
	);
	return [...linkVerbs];
};

// TS-TODO: use TypeContract interface instead of Contract
export const getTypeTriggers = (typeCard: core.ContractDefinition) => {
	// TS-TODO: use TriggeredActionDefinition interface instead of ContractDefinition
	const triggers: core.ContractDefinition[] = [];

	// We create empty updates to cards that reference other cards in links
	// whenever those linked cards change.
	// This forces a reevaluation of formulas in the referencing card.
	const linkVerbs = getReferencedLinkVerbs(typeCard as core.TypeContract);
	triggers.push(
		...linkVerbs.map((lv) =>
			createLinkTrigger(reverseLink(lv, typeCard.slug), typeCard),
		),
	);

	// This is to support $events and can be removed after changing all
	// call sites to `this.links["xyz"]` AND re-adding a efficient way
	// to do aggregations. see https://github.com/product-os/jellyfish-jellyscript/blob/evaluating-links/lib/index.js#L217

	// TS-TODO: remove optional chaining once we use TypeContract
	const eventMatches = card
		.getFormulasPaths(typeCard?.data?.schema as JSONSchema)
		.map((p) => ({
			path: p,
			ast: (parse(p.formula).body[0] as ESTree.ExpressionStatement)
				.expression as any,
		}))
		.filter(
			(p) =>
				isMatch(p.ast, LINKS_AGGREGATE_BASE_AST) ||
				isMatch(p.ast, LINKS_UNIQUE_FLATMAP_BASE_AST),
		);

	for (const { path, ast } of eventMatches) {
		const literal =
			ast.callee.name === 'AGGREGATE'
				? ast.arguments[1]
				: ast.arguments[0].arguments[1];

		const arg = runAST(literal, { context: {}, input: {} });
		const valueProperty = `source.${arg}`;

		triggers.push(createEventsTrigger(typeCard, path, valueProperty));
	}

	return triggers;
};

const createEventsTrigger = (
	typeCard: core.ContractDefinition<core.ContractData>,
	path: card.FormulaPath,
	valueProperty: string,
): core.ContractDefinition<core.ContractData> => {
	return {
		slug: slugify(`triggered-action-${typeCard.slug}-${path.output.join('-')}`),
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
	};
};

/**
 * Creates a triggered action that fires when a card gets changed that is linked
 * with the given link verb to a card of the given type
 *
 * @param linkVerb the verb that should trigger
 * @param typeCard the type containing the formula that needs the trigger
 * @returns the triggered action
 */
const createLinkTrigger = (
	linkVerb: string,
	typeCard: core.ContractDefinition<core.ContractData>,
): core.ContractDefinition<any> => {
	// We try to optimize query speed by limiting to valid types or,
	// if all are allowed, by excluding some high frequency internal cards
	const sourceTypes = getSourceTypes(linkVerb);
	const typeFilter =
		sourceTypes.indexOf('*') < 0
			? {
					enum: sourceTypes.map((t) => `${t}@1.0.0`),
			  }
			: {
					not: {
						enum: ['create@1.0.0', 'update@1.0.0'],
					},
			  };

	return {
		slug: slugify(
			`triggered-action-formula-update-${typeCard.slug}-${linkVerb}`,
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
			action: 'action-update-card@1.0.0',
			type: `${typeCard.slug}@${typeCard.version}`,
			target: {
				$map: {
					$eval: `source.links['${linkVerb}']`, // there was a [0:] at the end... :-/
				},
				'each(card)': {
					$eval: 'card.id',
				},
			},
			arguments: {
				reason: 'formula re-evaluation',
				patch: [],
			},
			filter: {
				type: 'object',
				required: ['type', 'data'],
				$$links: {
					[linkVerb]: {
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
						...typeFilter,
					},
				},
			},
		},
	};
};
