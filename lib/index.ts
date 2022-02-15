import * as assert from '@balena/jellyfish-assert';
import type { LinkConstraint } from '@balena/jellyfish-client-sdk';
import { getLogger, LogContext } from '@balena/jellyfish-logger';
import type { JsonSchema } from '@balena/jellyfish-types';
import type {
	ContractData,
	ContractDefinition,
	TypeContract,
} from '@balena/jellyfish-types/build/core';
import * as esprima from 'esprima';
import * as ESTree from 'estree';
import { applyPatch, compare, Operation } from 'fast-json-patch';
import formula from '@formulajs/formulajs';
import type { JSONSchema7Object } from 'json-schema';
import _, { Dictionary } from 'lodash';
import * as objectDeepSearch from 'object-deep-search';
import staticEval from 'static-eval';
import { FormulaPath, getFormulasPaths } from './card';
import { reverseLink } from './link-traversal';

const logger = getLogger(__filename);
const logContext: LogContext = {
	id: 'jellyscript',
};

enum NEEDS_STATUS {
	PENDING = 'pending',
	MERGEABLE = 'mergeable',
	NEVER = 'never',
}

// TS-TODO: The esprima @types package doesn't include a definition for 'parse',
// so we've manually defined it here.
// Ideally the return type should be 'esprima.Program | esprima.Script'.
interface WithParse {
	parse: (expression: string) => esprima.Program;
}
const parse = (esprima as unknown as WithParse).parse;

formula.PARTIAL = _.partial;
formula.FLIP = _.flip;
formula.PROPERTY = _.get;
formula.FLATMAP = _.flatMap;
formula.UNIQUE = _.uniq;
formula.EVERY = _.every;
formula.SOME = _.some;
formula.VALUES = _.values;
formula.FILTER = _.filter;
formula.REJECT = _.reject;
formula.ORDER_BY = _.orderBy;
formula.LAST = _.last;

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

formula.NEEDS_ALL = (...statuses: NEEDS_STATUS[]) => {
	let result = NEEDS_STATUS.MERGEABLE;

	for (const status of statuses) {
		if (status === NEEDS_STATUS.NEVER) {
			result = NEEDS_STATUS.NEVER;
			break;
		}

		if (status === NEEDS_STATUS.PENDING) {
			result = NEEDS_STATUS.PENDING;
		}
	}

	return result;
};

/**
 * Looks at a contract and checks whether there is a backflow that meets the type and
 * filter callback (optional). If no, it means a transformer is still running and status
 * is pending. If yes, then if there is an error for the expected type, it concludes
 * it is never mergeable, otherwise if no error exists it is mergeable.
 *
 * @param contract Contract to look for a backflow
 * @param type The expexted output type of the backflow
 * @param func A filter function to match the backflow contract
 * @returns NEEDS_STATUS status
 */
formula.NEEDS = (
	contract: any,
	type: string,
	func: (contract: any) => boolean = () => true,
) => {
	const backflowHasError = contract.data.$transformer.backflow.some((c) => {
		return (
			c.type.split('@')[0] === 'error' &&
			c.data.expectedOutputTypes.includes(type) &&
			func(c)
		);
	});
	if (backflowHasError) {
		return NEEDS_STATUS.NEVER;
	}

	const backflowisMergeable = contract.data.$transformer.backflow.some(
		(c) =>
			c.type.split('@')[0] === type &&
			func(c) &&
			[NEEDS_STATUS.MERGEABLE, true].includes(c.data.$transformer.mergeable),
	);
	if (backflowisMergeable) {
		return NEEDS_STATUS.MERGEABLE;
	}

	return NEEDS_STATUS.PENDING;
};

export interface Options {
	context: any;
	input: any;
}

const runAST = (ast: ESTree.Expression, evalContext: any = {}): any => {
	return staticEval(ast, Object.assign({}, evalContext, formula));
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
		...options.context,
		input: options.input,
	});

	if (_.isError(result)) {
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

export const evaluatePatch = (
	schema: JsonSchema,
	object: JSONSchema7Object,
	patches: Operation[],
) => {
	// The patch may affect other evaluated fields on the card.
	// Generate a patched object and evaluate it. Then compare it to the original
	// object to get a final list of patches to apply.
	const patchedObject = _.cloneDeep(object);
	const failedPatches: Operation[] = [];
	for (const patch of patches) {
		try {
			applyPatch(patchedObject, [patch], false, true);
		} catch (err) {
			failedPatches.push(patch);
		}
	}
	const evaluatedPatchedObject = evaluateObject(schema, patchedObject);
	const evaluatedPatches = compare(object, evaluatedPatchedObject);
	return evaluatedPatches.concat(failedPatches);
};

export const evaluateObject = <T extends JSONSchema7Object>(
	schema: JsonSchema,
	object: T,
): T => {
	if (_.isEmpty(object)) {
		return object;
	}
	const formulaPaths = getFormulasPaths(schema);
	const parsed = formulaPaths.map((p) => ({
		...p,
		ast: (parse(p.formula).body[0] as ESTree.ExpressionStatement).expression,
	}));

	// Apply a topological sort to the formulas to ensure that the formulas are
	// evaluated in the correct order.
	parsed.sort((a, b) => {
		// check if b references a
		const match = objectDeepSearch.findFirst(b.ast, {
			type: 'MemberExpression',
			computed: false,
			object: {
				type: 'Identifier',
				name: 'contract',
			},
			property: {
				type: 'Identifier',
				name: a.output[0],
			},
		});
		if (match) {
			return -1;
		}

		return 0;
	});

	// Given formulapath.output and a parsed AST, sort formula evaluation based on AST output
	for (const path of parsed) {
		const input = _.get(object, path.output, getDefaultValueForType(path.type));

		const result = evaluate(path.formula, {
			context: { contract: object },
			input,
		});

		if (!_.isNull(result.value)) {
			// Mutates input object
			_.set(object, path.output, result.value);
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

const CONTRACT_LINKS_REFERENCE_AST = {
	type: 'MemberExpression',
	object: {
		type: 'MemberExpression',
		object: {
			type: 'Identifier',
			name: 'contract',
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

type ContractLinkRef = typeof CONTRACT_LINKS_REFERENCE_AST & {
	property: { value: string };
};

export const getReferencedLinkVerbs = <T extends Pick<TypeContract, 'data'>>(
	typeCard: T,
): string[] => {
	const formulas = getFormulasPaths(typeCard.data.schema).map((f) => f.formula);
	const formulaAst = formulas.map((f) => parse(f));
	const linkExpressions = formulaAst.flatMap((ast) => {
		// TODO: Remove the check for LINKS_REFERENCE_AST once we're sure there are no
		// remaining references to 'this' in $$formulas! (Better to find them and
		// log an error for now).
		const linkRefs = objectDeepSearch.find<LinkRef>(ast, LINKS_REFERENCE_AST);
		const contractLinkRefs = objectDeepSearch.find<ContractLinkRef>(
			ast,
			CONTRACT_LINKS_REFERENCE_AST,
		);
		if (linkRefs.length) {
			logger.error(
				logContext,
				"Found unsupported $$formula references to 'this'",
				{
					typeCard,
				},
			);
		}
		return contractLinkRefs;
	});
	const linkVerbs = linkExpressions.reduce(
		(linkSet, l) => linkSet.add(l.property.value),
		new Set<string>(),
	);
	return [...linkVerbs];
};

// TS-TODO: use TypeContract interface instead of Contract
export const getTypeTriggers = (typeCard: ContractDefinition) => {
	// TS-TODO: use TriggeredActionDefinition interface instead of ContractDefinition
	const triggers: ContractDefinition[] = [];

	// We create empty updates to cards that reference other cards in links
	// whenever those linked cards change.
	// This forces a reevaluation of formulas in the referencing card.
	const linkVerbs = getReferencedLinkVerbs(typeCard as TypeContract);
	triggers.push(
		...linkVerbs.flatMap((lv) =>
			createLinkTrigger(reverseLink(typeCard.slug, lv), typeCard),
		),
	);

	// This is to support $events and can be removed after changing all
	// call sites to `contract.links["xyz"]` AND re-adding a efficient way
	// to do aggregations. see https://github.com/product-os/jellyfish-jellyscript/blob/evaluating-links/lib/index.js#L217

	// TS-TODO: remove optional chaining once we use TypeContract
	const eventMatches = getFormulasPaths(typeCard?.data?.schema as JsonSchema)
		.map((p) => ({
			path: p,
			ast: (parse(p.formula).body[0] as ESTree.ExpressionStatement)
				.expression as any,
		}))
		.filter(
			(p) =>
				_.isMatch(p.ast, LINKS_AGGREGATE_BASE_AST) ||
				_.isMatch(p.ast, LINKS_UNIQUE_FLATMAP_BASE_AST),
		);

	for (const { path, ast } of eventMatches) {
		const literal =
			ast.callee.name === 'AGGREGATE'
				? ast.arguments[1]
				: ast.arguments[0].arguments[1];

		const arg = runAST(literal);
		const valueProperty = `source.${arg}`;

		triggers.push(createEventsTrigger(typeCard, path, valueProperty));
	}

	return triggers;
};

const createEventsTrigger = (
	typeCard: ContractDefinition<ContractData>,
	path: FormulaPath,
	valueProperty: string,
): ContractDefinition<ContractData> => {
	return {
		slug: slugify(`triggered-action-${typeCard.slug}-${path.output.join('-')}`),
		type: 'triggered-action@1.0.0',
		version: typeCard.version,
		active: true,
		requires: [],
		capabilities: [],
		markers: [],
		tags: [],
		data: {
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
	linkGroups: Dictionary<LinkConstraint[]>,
	typeCard: ContractDefinition<ContractData>,
): Array<ContractDefinition<any>> => {
	if (Object.keys(linkGroups).length === 0) {
		return [];
	}
	return Object.entries(linkGroups)
		.filter(([, links]) => links.length)
		.map(([linkVerb, links]) => {
			// We try to optimize query speed by limiting to valid types or,
			// if all are allowed, by excluding some high frequency internal cards
			const typeFilter =
				links.filter((l) => l.data.from === '*').length === 0
					? {
							enum: links.map((t) => `${t.data.from}@1.0.0`),
					  }
					: {
							not: {
								enum: ['create@1.0.0', 'update@1.0.0', 'link@1.0.0'],
							},
					  };
			return {
				slug: slugify(
					`triggered-action-formula-update-${typeCard.slug}-${linkVerb}`,
				),
				type: 'triggered-action@1.0.0',
				version: typeCard.version,
				active: true,
				requires: [],
				capabilities: [],
				markers: [],
				tags: [],
				data: {
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
							updated_at: true,
						},
					},
				},
			};
		});
};
