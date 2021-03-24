/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isPlainObject from 'lodash/isPlainObject';
import isArray from 'lodash/isArray';
import each from 'lodash/each';
import isString from 'lodash/isString';
import isNumber from 'lodash/isNumber';
import get from 'lodash/get';
import initial from 'lodash/initial';
import last from 'lodash/last';
import type { JSONSchema7Object, JSONSchema7Type } from 'json-schema';
import { hashObject } from './utils';
import type { JSONSchema } from './types';

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

		if (isPlainObject(value)) {
			eachDeep(value as JSONSchema7Object, callback, absoluteKey);
			continue;
		}

		if (isArray(value)) {
			each(value, (element, index) => {
				if (isString(element)) {
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
		if (isNumber(fragment)) {
			return false;
		}

		return !['properties', 'anyOf', 'allOf', 'oneOf'].includes(fragment);
	});
};

const formulaSchemaCache = new Map();

export const getFormulasPaths = (schema: JSONSchema): FormulaPath[] => {
	const hash = hashObject(schema);

	if (formulaSchemaCache.has(hash)) {
		return formulaSchemaCache.get(hash);
	}

	const paths: FormulaPath[] = [];

	eachDeep(schema as JSONSchema7Object, (value, key) => {
		if (last(key) === FORMULA_PROPERTY) {
			paths.push({
				formula: value as string,
				output: getRealObjectPath(key),
				type: get(schema, initial(key).concat(['type'])),
			});
		}
	});

	formulaSchemaCache.set(hash, paths);
	return paths;
};
