/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as jellyscript from './index';
import { getReferencedLinkVerbs } from './index';

test('.evaluate(): should return null if no input', () => {
	const result = jellyscript.evaluate('POW(input, 2)', {
		context: {},
		input: null,
	});

	expect(result).toEqual({
		value: null,
	});
});

test('.evaluate(): should resolve a number formula', () => {
	const result = jellyscript.evaluate('POW(input, 2)', {
		context: {
			number: 2,
		},
		input: 2,
	});

	expect(result).toEqual({
		value: 4,
	});
});

test('.evaluate(): should resolve composite formulas', () => {
	const result = jellyscript.evaluate('MAX(POW(input, 2), POW(input, 3))', {
		context: {
			number: 2,
		},
		input: 2,
	});

	expect(result).toEqual({
		value: 8,
	});
});

test('.evaluate(): should access other properties from the card', () => {
	const result = jellyscript.evaluate('ADD(this.value1, this.value2)', {
		context: {
			value1: 2,
			value2: 3,
		},
		input: 0,
	});

	expect(result).toEqual({
		value: 5,
	});
});

test('UNIQUE(FLATMAP()): should aggregate a set of object properties', () => {
	const result = jellyscript.evaluate('UNIQUE(FLATMAP(input, "mentions"))', {
		context: {},
		input: [
			{
				mentions: ['foo', 'bar'],
			},
			{
				mentions: ['bar'],
			},
		],
	});

	expect(result).toEqual({
		value: ['foo', 'bar'],
	});
});

test('AGGREGATE: should ignore duplicates', () => {
	const result = jellyscript.evaluate(
		'AGGREGATE(input, PARTIAL(FLIP(PROPERTY), "mentions"))',
		{
			context: {},
			input: [
				{
					mentions: ['foo', 'bar'],
				},
				{
					mentions: ['bar', 'baz'],
				},
				{
					mentions: ['baz', 'qux'],
				},
			],
		},
	);

	expect(result).toEqual({
		value: ['foo', 'bar', 'baz', 'qux'],
	});
});

test('AGGREGATE: should aggregate a set of object properties', () => {
	const result = jellyscript.evaluate(
		'AGGREGATE(input, PARTIAL(FLIP(PROPERTY), "mentions"))',
		{
			context: {},
			input: [
				{
					mentions: ['foo'],
				},
				{
					mentions: ['bar'],
				},
			],
		},
	);

	expect(result).toEqual({
		value: ['foo', 'bar'],
	});
});

test('REGEX_MATCH: should extract a set of mentions', () => {
	const result = jellyscript.evaluate(
		'REGEX_MATCH(/(@[a-zA-Z0-9-]+)/g, input)',
		{
			context: {},
			input: 'Hello @johndoe, and @janedoe',
		},
	);

	expect(result).toEqual({
		value: ['@johndoe', '@janedoe'],
	});
});

test('REGEX_MATCH: should consider duplicates', () => {
	const result = jellyscript.evaluate(
		'REGEX_MATCH(/(@[a-zA-Z0-9-]+)/g, input)',
		{
			context: {},
			input: 'Hello @johndoe, and @janedoe, and @johndoe',
		},
	);

	expect(result).toEqual({
		value: ['@johndoe', '@janedoe', '@johndoe'],
	});
});

test('.evaluateObject() should evaluate a number formula', async () => {
	const result = jellyscript.evaluateObject(
		{
			type: 'object',
			properties: {
				foo: {
					type: 'number',
					$$formula: 'POW(input, 2)',
				},
			},
		},
		{
			foo: 3,
		},
	);

	expect(result).toEqual({
		foo: 9,
	});
});

test('.evaluateObject() should evaluate a formula in a $ prefixed property', async () => {
	const result = jellyscript.evaluateObject(
		{
			type: 'object',
			properties: {
				$foo: {
					type: 'number',
					$$formula: 'POW(input, 2)',
				},
			},
		},
		{
			$foo: 3,
		},
	);

	expect(result).toEqual({
		$foo: 9,
	});
});

test('.evaluateObject() should evaluate a formula in a $$ prefixed property', async () => {
	const result = jellyscript.evaluateObject(
		{
			type: 'object',
			properties: {
				$$foo: {
					type: 'number',
					$$formula: 'POW(input, 2)',
				},
			},
		},
		{
			$$foo: 3,
		},
	);

	expect(result).toEqual({
		$$foo: 9,
	});
});

test('.evaluateObject() should ignore missing formulas', async () => {
	const result = jellyscript.evaluateObject(
		{
			type: 'object',
			properties: {
				foo: {
					type: 'number',
					$$formula: 'POW(input, 2)',
				},
			},
		},
		{
			bar: 3,
		},
	);

	expect(result).toEqual({
		bar: 3,
	});
});

test('.evaluateObject() should not ignore the zero number as missing', async () => {
	const result = jellyscript.evaluateObject(
		{
			type: 'object',
			properties: {
				foo: {
					type: 'number',
					$$formula: 'MAX(input, 2)',
				},
			},
		},
		{
			foo: 0,
		},
	);

	expect(result).toEqual({
		foo: 2,
	});
});

test('.evaluateObject() should evaluate nested formulas', async () => {
	const result = jellyscript.evaluateObject(
		{
			type: 'object',
			properties: {
				foo: {
					type: 'object',
					properties: {
						bar: {
							type: 'object',
							properties: {
								baz: {
									type: 'number',
									$$formula: 'POW(input, 2)',
								},
							},
						},
					},
				},
			},
		},
		{
			foo: {
				bar: {
					baz: 2,
				},
			},
		},
	);

	expect(result).toEqual({
		foo: {
			bar: {
				baz: 4,
			},
		},
	});
});

test('.evaluateObject() should not do anything if the schema has no formulas', async () => {
	const result = jellyscript.evaluateObject(
		{
			type: 'object',
			properties: {
				foo: {
					type: 'string',
				},
				bar: {
					type: 'number',
				},
			},
		},
		{
			foo: '1',
			bar: 2,
		},
	);

	expect(result).toEqual({
		foo: '1',
		bar: 2,
	});
});

test('.getTypeTriggers() should report back watchers when aggregating events', async () => {
	const triggers = jellyscript.getTypeTriggers({
		slug: 'thread',
		type: 'type@1.0.0',
		version: '1.0.0',
		data: {
			schema: {
				type: 'object',
				properties: {
					data: {
						type: 'object',
						properties: {
							mentions: {
								type: 'array',
								$$formula: 'AGGREGATE($events, "data.mentions")',
							},
						},
					},
				},
			},
		},
	});

	expect(triggers).toEqual([
		{
			type: 'triggered-action@1.0.0',
			version: '1.0.0',
			slug: 'triggered-action-thread-data-mentions',
			requires: [],
			capabilities: [],
			active: true,
			tags: [],
			markers: [],
			data: {
				schedule: 'async',
				type: 'thread@1.0.0',
				action: 'action-set-add@1.0.0',
				target: {
					$eval: "source.links['is attached to'][0].id",
				},
				arguments: {
					property: 'data.mentions',
					value: {
						$if: 'source.data.mentions',
						then: {
							$eval: 'source.data.mentions',
						},
						else: [],
					},
				},
				filter: {
					type: 'object',
					$$links: {
						'is attached to': {
							type: 'object',
							required: ['type'],
							properties: {
								type: {
									type: 'string',
									const: 'thread@1.0.0',
								},
							},
						},
					},
					required: ['type', 'data'],
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
		},
	]);
});

test('.getTypeTriggers() should report back watchers when aggregating events with UNIQUE and FLATMAP', async () => {
	const triggers = jellyscript.getTypeTriggers({
		slug: 'thread',
		type: 'type@1.0.0',
		version: '1.0.0',
		data: {
			schema: {
				type: 'object',
				properties: {
					data: {
						type: 'object',
						properties: {
							mentions: {
								type: 'array',
								$$formula: 'UNIQUE(FLATMAP($events, "data.mentions"))',
							},
						},
					},
				},
			},
		},
	});

	expect(triggers).toEqual([
		{
			type: 'triggered-action@1.0.0',
			version: '1.0.0',
			slug: 'triggered-action-thread-data-mentions',
			requires: [],
			capabilities: [],
			active: true,
			tags: [],
			markers: [],
			data: {
				schedule: 'async',
				type: 'thread@1.0.0',
				action: 'action-set-add@1.0.0',
				target: {
					$eval: "source.links['is attached to'][0].id",
				},
				arguments: {
					property: 'data.mentions',
					value: {
						$if: 'source.data.mentions',
						then: {
							$eval: 'source.data.mentions',
						},
						else: [],
					},
				},
				filter: {
					type: 'object',
					$$links: {
						'is attached to': {
							type: 'object',
							required: ['type'],
							properties: {
								type: {
									type: 'string',
									const: 'thread@1.0.0',
								},
							},
						},
					},
					required: ['type', 'data'],
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
		},
	]);
});

test('getReferencedLinkVerbs() should find all verbs exactly once', async () => {
	const links = getReferencedLinkVerbs({
		id: 'fake',
		slug: 'thread',
		type: 'type@1.0.0',
		version: '1.0.0',
		data: {
			schema: {
				type: 'object',
				properties: {
					data: {
						type: 'object',
						properties: {
							mentions: {
								type: 'array',
								$$formula: 'this.links["some link"]',
							},
							mentions2: {
								type: 'array',
								$$formula: '[]+this.links["some link"]',
							},
							count: {
								type: 'array',
								$$formula:
									'5 + this.links["other link"].reduce((o,sum)=>sum+1,0)',
							},
						},
					},
				},
			},
		},
	});
	expect(links).toContain('some link');
	expect(links).toContain('other link');
});

test('getReferencedLinkVerbs() should not fail if no formulas are given', async () => {
	const links = getReferencedLinkVerbs({
		id: 'fake',
		slug: 'thread',
		type: 'type@1.0.0',
		version: '1.0.0',
		data: {
			schema: {
				type: 'object',
				properties: {
					data: {
						type: 'object',
					},
				},
			},
		},
	});
	expect(links.length).toEqual(0);
});
