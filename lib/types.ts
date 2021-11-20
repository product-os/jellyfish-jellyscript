import {
	JSONSchema7Version,
	JSONSchema7TypeName,
	JSONSchema7Type,
} from 'json-schema';

type JellyfishJSONSchema7Definition = (JSONSchema | boolean) & {
	$$formula?: string;
};

export interface JSONSchema {
	$$formula?: string;
	$$links?: {
		[key: string]: JSONSchema;
	};
	$id?: string;
	$ref?: string;
	$schema?: JSONSchema7Version;
	$comment?: string;

	/**
	 * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-6.1
	 */
	type?: JSONSchema7TypeName | JSONSchema7TypeName[];
	enum?: JSONSchema7Type[];
	const?: JSONSchema7Type;

	/**
	 * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-6.2
	 */
	multipleOf?: number;
	maximum?: number;
	exclusiveMaximum?: number;
	minimum?: number;
	exclusiveMinimum?: number;

	/**
	 * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-6.3
	 */
	maxLength?: number;
	minLength?: number;
	pattern?: string;

	/**
	 * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-6.4
	 */
	items?: JellyfishJSONSchema7Definition | JellyfishJSONSchema7Definition[];
	additionalItems?: JellyfishJSONSchema7Definition;
	maxItems?: number;
	minItems?: number;
	uniqueItems?: boolean;
	contains?: JSONSchema;

	/**
	 * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-6.5
	 */
	maxProperties?: number;
	minProperties?: number;
	required?: string[];
	properties?: {
		[key: string]: JellyfishJSONSchema7Definition;
	};
	patternProperties?: {
		[key: string]: JellyfishJSONSchema7Definition;
	};
	additionalProperties?: JellyfishJSONSchema7Definition;
	dependencies?: {
		[key: string]: JellyfishJSONSchema7Definition | string[];
	};
	propertyNames?: JellyfishJSONSchema7Definition;

	/**
	 * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-6.6
	 */
	if?: JellyfishJSONSchema7Definition;
	then?: JellyfishJSONSchema7Definition;
	else?: JellyfishJSONSchema7Definition;

	/**
	 * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-6.7
	 */
	allOf?: JellyfishJSONSchema7Definition[];
	anyOf?: JellyfishJSONSchema7Definition[];
	oneOf?: JellyfishJSONSchema7Definition[];
	not?: JellyfishJSONSchema7Definition;

	/**
	 * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-7
	 */
	format?: string;

	/**
	 * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-8
	 */
	contentMediaType?: string;
	contentEncoding?: string;

	/**
	 * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-9
	 */
	definitions?: {
		[key: string]: JellyfishJSONSchema7Definition;
	};

	/**
	 * @see https://tools.ietf.org/html/draft-handrews-json-schema-validation-01#section-10
	 */
	title?: string;
	description?: string;
	default?: JSONSchema7Type;
	readOnly?: boolean;
	writeOnly?: boolean;
	examples?: JSONSchema7Type;
}
