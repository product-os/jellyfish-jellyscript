import baseFormulas from '@formulajs/formulajs';
import type { JsonSchema } from 'autumndb';
import * as esprima from 'esprima';
import * as ESTree from 'estree';
import { applyPatch, compare, Operation } from 'fast-json-patch';
import type { JSONSchema7Object } from 'json-schema';
import _ from 'lodash';
import * as objectDeepSearch from 'object-deep-search';
import staticEval from 'static-eval';
import { getFormulasPaths } from './card';

// TS-TODO: The esprima @types package doesn't include a definition for 'parse',
// so we've manually defined it here.
// Ideally the return type should be 'esprima.Program | esprima.Script'.
interface WithParse {
	parse: (expression: string) => esprima.Program;
}
const parse = (esprima as unknown as WithParse).parse;

baseFormulas.PARTIAL = _.partial;
baseFormulas.FLIP = _.flip;
baseFormulas.PROPERTY = _.get;
baseFormulas.FLATMAP = _.flatMap;
baseFormulas.UNIQUE = _.uniq;
baseFormulas.EVERY = _.every;
baseFormulas.SOME = _.some;
baseFormulas.VALUES = _.values;
baseFormulas.FILTER = _.filter;
baseFormulas.REJECT = _.reject;
baseFormulas.ORDER_BY = _.orderBy;
baseFormulas.LAST = _.last;
baseFormulas.COUNT_BY = _.countBy;

baseFormulas.REGEX_MATCH = (
	regex: string | RegExp,
	str: string,
): RegExpMatchArray | null => {
	return str.match(regex);
};

baseFormulas.AGGREGATE = <T>(list: any[], path: string, initial: any): T[] => {
	if (!path) {
		throw new Error('Cannot run AGGREGATE without a path');
	}
	// 1. get the current value and default to an empty array
	const current: T[] = _.castArray(initial || []);
	// 2. get the list of values to aggregate
	const values = current.concat(_.flatMap(list || [], path));
	// 3. If there aren't any values, leave the input unchanged
	if (values.length === 0) {
		return initial;
	}
	// 4. Create a unique list of values, excluding any that are undefined
	const result: any = _.uniq(_.without(values, undefined));

	return result;
};

export interface Options {
	context: any;
	input: any;
}

const runAST = (
	ast: ESTree.Expression,
	evalContext: any = {},
	formulas: { [key: string]: FormulaFn },
): any => {
	return staticEval(ast, Object.assign({}, evalContext, formulas));
};

const getDefaultValueForType = (type: string): null | [] => {
	switch (type) {
		case 'array':
			return [];
		default:
			return null;
	}
};

type FormulaReturnValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| { [key: string]: FormulaReturnValue }
	| FormulaReturnValue[];

type FormulaFn = (...args: any[]) => FormulaReturnValue;

interface JellyscriptOptions {
	formulas?: {
		[key: string]: FormulaFn;
	};
}

export class Jellyscript {
	formulas: { [key: string]: FormulaFn };

	constructor(options: JellyscriptOptions = {}) {
		this.formulas = {
			...baseFormulas,
			...(options.formulas || {}),
		};
	}

	evaluate = (
		expression: string,
		options: Options,
	): {
		value: any;
	} => {
		try {
			const ast = (parse(expression).body[0] as ESTree.ExpressionStatement)
				.expression;

			const result = runAST(
				ast,
				{
					...options.context,
					input: options.input,
				},
				this.formulas,
			);

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
		} catch (error: any) {
			// If we hit an error parsing or running the expression
			// throw a more useful error message
			throw new Error(
				`Encountered error whilst evaluating formula expression: ${expression}\n${error.message}`,
			);
		}
	};

	evaluatePatch = (
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
		const evaluatedPatchedObject = this.evaluateObject(schema, patchedObject);
		const evaluatedPatches = compare(object, evaluatedPatchedObject);
		return evaluatedPatches.concat(failedPatches);
	};

	evaluateObject = <T extends JSONSchema7Object>(
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
			const input = _.get(
				object,
				path.output,
				getDefaultValueForType(path.type),
			);

			const result = this.evaluate(path.formula, {
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

	// Introspect a schema for formulas that access given `property` on `object`, returning any found values as an array
	static getObjectMemberExpressions(
		schema: JsonSchema,
		object: string,
		property: string,
	): string[] {
		const referenceAst = {
			type: 'MemberExpression',
			object: {
				type: 'MemberExpression',
				object: {
					type: 'Identifier',
					name: object,
				},
				property: {
					type: 'Identifier',
					name: property,
				},
			},
			property: {
				type: 'Literal',
			},
		};
		const formulas = getFormulasPaths(schema).map((f) => f.formula);
		const formulaAst = formulas.map((f) => parse(f));
		const expressions = formulaAst.flatMap((ast) => {
			const refs = objectDeepSearch.find<{ property: { value: string } }>(
				ast,
				referenceAst,
			);
			return refs;
		});
		const results = expressions.reduce(
			(linkSet, l) => linkSet.add(l.property.value),
			new Set<string>(),
		);
		return [...results];
	}
}
