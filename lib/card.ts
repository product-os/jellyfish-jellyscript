import type { JsonSchema } from 'autumndb';
import type { JSONSchema7Object, JSONSchema7Type } from 'json-schema';
import _ from 'lodash';
import { hashObject } from './hash-object';

const FORMULA_PROPERTY = '$$formula';

export type KeyPath = Array<string | number>;

export interface FormulaPath {
	formula: string;
	output: KeyPath;
	type: string;
}

const eachDeep = (
	object: JSONSchema7Object,
	callback: (value: JSONSchema7Type, key: KeyPath) => void,
	breadcrumb: KeyPath = [],
): void => {
	for (const key of Object.keys(object)) {
		const value = object[key];
		const absoluteKey = breadcrumb.concat([key]);

		if (_.isPlainObject(value)) {
			eachDeep(value as JSONSchema7Object, callback, absoluteKey);
			continue;
		}

		if (_.isArray(value)) {
			_.each(value, (element, index) => {
				if (_.isString(element)) {
					return;
				}

				eachDeep(
					element as JSONSchema7Object,
					callback,
					absoluteKey.concat([index]),
				);
			});

			continue;
		}

		// eslint-disable-next-line callback-return
		callback(value, absoluteKey);
	}
};

const getRealObjectPath = (schemaPath: KeyPath): KeyPath => {
	return schemaPath.slice(0, schemaPath.length - 1).filter((fragment) => {
		if (_.isNumber(fragment)) {
			return false;
		}

		return !['properties', 'anyOf', 'allOf', 'oneOf'].includes(fragment);
	});
};

const formulaSchemaCache = new Map();

export const getFormulasPaths = (schema: JsonSchema): FormulaPath[] => {
	const hash = hashObject(schema);

	if (formulaSchemaCache.has(hash)) {
		return formulaSchemaCache.get(hash);
	}

	const paths: FormulaPath[] = [];

	eachDeep(schema as JSONSchema7Object, (value, key) => {
		if (_.last(key) === FORMULA_PROPERTY) {
			paths.push({
				formula: value as string,
				output: getRealObjectPath(key),
				type: _.get(schema, _.initial(key).concat(['type'])),
			});
		}
	});

	formulaSchemaCache.set(hash, paths);
	return paths;
};
