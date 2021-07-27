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

test('.evaluate(): should resolve a number formula', () => {
	const result = jellyscript.evaluate('!input', {
		context: {
			number: true,
		},
		input: true,
	});

	expect(result).toEqual({
		value: false,
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
	const result = jellyscript.evaluate('ADD(obj.value1, obj.value2)', {
		context: {
			obj: {
				value1: 2,
				value2: 3,
			},
		},
		input: 0,
	});

	expect(result).toEqual({
		value: 5,
	});
});

test('.evaluate() should handle combinations of functions', () => {
	const result = jellyscript.evaluate(
		'EVERY(FILTER(contract.links["has attached"], { type: "improvement@1.0.0" }), { data: { status: "completed" } })',
		{
			context: {
				contract: {
					links: {
						'has attached': [
							{
								type: 'improvement@1.0.0',
								data: {
									status: 'completed',
								},
							},
							{
								type: 'improvement@1.0.0',
								data: {
									status: 'completed',
								},
							},
							{
								type: 'pull-request@1.0.0',
								data: {
									status: 'open',
								},
							},
						],
					},
				},
			},
			input: 4,
		},
	);

	expect(result).toEqual({
		value: true,
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

test('.evaluateObject() should evaluate a EVERY formula', async () => {
	const result = jellyscript.evaluateObject(
		{
			type: 'object',
			properties: {
				truthy: {
					type: 'boolean',
					$$formula: 'EVERY(input, "data.a")',
				},
				falsy: {
					type: 'boolean',
					$$formula: 'EVERY(input, "data.a")',
				},
				empty: {
					type: 'boolean',
					$$formula: 'EVERY(input, "data.a")',
				},
			},
		},
		{
			truthy: [{ data: { a: 1 } }, { data: { a: 2 } }],
			falsy: [{ data: { a: 1 } }, { data: {} }],
			empty: [],
		},
	);

	expect(result).toEqual({
		truthy: true,
		falsy: false,
		empty: true,
	});
});

test('.evaluateObject() should evaluate a SOME formula', async () => {
	const result = jellyscript.evaluateObject(
		{
			type: 'object',
			properties: {
				truthy: {
					type: 'boolean',
					$$formula: 'SOME(input, "data.a")',
				},
				falsy: {
					type: 'boolean',
					$$formula: 'SOME(input, "data.a")',
				},
				empty: {
					type: 'boolean',
					$$formula: 'SOME(input, "data.a")',
				},
			},
		},
		{
			truthy: [{ data: { a: 1 } }, { data: { b: 2 } }],
			falsy: [{ data: { b: 1 } }, { data: {} }],
			empty: [],
		},
	);

	expect(result).toEqual({
		truthy: true,
		falsy: false,
		empty: false,
	});
});

test('.evaluateObject() should evaluate a VALUES formula', async () => {
	const result = jellyscript.evaluateObject(
		{
			type: 'object',
			properties: {
				obj: {
					type: 'object',
				},
				values: {
					type: 'array',
					$$formula: 'VALUES(contract.obj)',
				},
			},
		},
		{
			obj: { a: 1, b: 2 },
			values: [],
		},
	);

	expect(result).toEqual({
		obj: { a: 1, b: 2 },
		values: [1, 2],
	});
});

test('.evaluateObject() should evaluate a boolean formula', async () => {
	const result = jellyscript.evaluateObject(
		{
			type: 'object',
			properties: {
				foo: {
					type: 'boolean',
					$$formula: '!contract.bar',
				},
				bar: {
					type: 'boolean',
				},
			},
		},
		{
			bar: true,
		},
	);

	expect(result).toEqual({
		bar: true,
		foo: false,
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

test('.evaluateObject(): get the last message/whisper from a timeline', () => {
	const evaluatedContract: any = jellyscript.evaluateObject(
		{
			type: 'object',
			properties: {
				last_message: {
					type: 'object',
					$$formula: `
						PROPERTY(contract, [ "links", "has attached element", "length" ])
						? LAST(
								ORDER_BY(
									FILTER(
										contract.links["has attached element"],
										function (c) { return c && (c.type === "message@1.0.0" || c.type === "whisper@1.0.0"); }
									),
									"data.timestamp"
								)
							)
						: null
				`,
				},
			},
		},
		{
			links: {
				'has attached element': [
					{
						type: 'message@1.0.0',
						data: {
							timestamp: '2020-01-01T00:00:01.000Z',
						},
					},
					{
						type: 'whisper@1.0.0',
						data: {
							timestamp: '2020-01-01T00:00:03.000Z',
						},
					},
					{
						type: 'message@1.0.0',
						data: {
							timestamp: '2020-01-01T00:00:02.000Z',
						},
					},
					{
						type: 'update@1.0.0',
						data: {
							timestamp: '2020-01-01T00:00:04.000Z',
						},
					},
				],
			},
		},
	);

	expect(evaluatedContract.last_message).toEqual({
		type: 'whisper@1.0.0',
		data: {
			timestamp: '2020-01-01T00:00:03.000Z',
		},
	});
});

test('.evaluateObject(): evaluate to undefined if no messages/whispers in a timeline', () => {
	const evaluatedContract: any = jellyscript.evaluateObject(
		{
			type: 'object',
			properties: {
				last_message: {
					type: 'object',
					$$formula: `
						PROPERTY(contract, [ "links", "has attached element", "length" ])
						? LAST(
								ORDER_BY(
									FILTER(
										contract.links["has attached element"],
										function (c) { return c && (c.type === "message@1.0.0" || c.type === "whisper@1.0.0"); }
									),
									"data.timestamp"
								)
							)
						: null
				`,
				},
			},
		},
		{
			links: {
				'has attached element': [
					{
						type: 'create@1.0.0',
						data: {
							timestamp: '2020-01-01T00:00:01.000Z',
						},
					},
					{
						type: 'update@1.0.0',
						data: {
							timestamp: '2020-01-01T00:00:04.000Z',
						},
					},
				],
			},
		},
	);

	expect(evaluatedContract.last_message).toBeUndefined();
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

test('.getTypeTriggers() should properly reverse links', async () => {
	const triggers = jellyscript.getTypeTriggers({
		id: '3fe919b0-a991-4957-99f0-5f7bb926addb',
		data: {
			schema: {
				type: 'object',
				required: ['data', 'name'],
				properties: {
					data: {
						type: 'object',
						required: ['org', 'repo', 'head'],
						properties: {
							org: { type: 'string' },
							head: {
								type: 'object',
								required: ['sha', 'branch'],
								properties: {
									sha: { type: 'string' },
									branch: { type: 'string' },
								},
							},
							repo: { type: 'string' },
							$transformer: {
								type: 'object',
								properties: {
									merged: {
										type: 'boolean',
										default: false,
										readOnly: true,
										$$formula:
											'contract.links["is attached to PR"].length > 0 && contract.links["is attached to PR"][0].data.merged_at && contract.links["is attached to PR"][0].data.head.sha === contract.data.head.sha',
										description: 'PR is merged',
									},
									mergeable: {
										type: 'boolean',
										default: false,
										readOnly: true,
										$$formula:
											'contract.links["was built into"].length > 0 && EVERY(contract.links["was built into"], "data.$transformer.mergeable")',
										description: 'all downstream contracts are mergeable',
									},
									artifactReady: { type: 'boolean' },
								},
							},
						},
					},
					name: { type: 'string', fullTextSearch: true },
				},
			},
		},
		name: 'Commit',
		slug: 'commit',
		type: 'type@1.0.0',
		active: true,
		markers: [],
		version: '1.0.0',
		requires: [],
		capabilities: [],
	});

	expect(triggers).toEqual([
		{
			slug: 'triggered-action-formula-update-commit-has-attached-commit',
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
				type: 'commit@1.0.0',
				target: {
					$map: { $eval: "source.links['has attached commit']" },
					'each(card)': { $eval: 'card.id' },
				},
				arguments: { reason: 'formula re-evaluation', patch: [] },
				filter: {
					type: 'object',
					required: ['type', 'data'],
					$$links: {
						'has attached commit': {
							type: 'object',
							required: ['type'],
							properties: { type: { type: 'string', const: 'commit@1.0.0' } },
						},
					},
					properties: {
						type: { type: 'string', enum: ['pull-request@1.0.0'] },
					},
				},
			},
		},
		{
			slug: 'triggered-action-formula-update-commit-was-built-from',
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
				type: 'commit@1.0.0',
				target: {
					$map: { $eval: "source.links['was built from']" },
					'each(card)': { $eval: 'card.id' },
				},
				arguments: { reason: 'formula re-evaluation', patch: [] },
				filter: {
					type: 'object',
					required: ['type', 'data'],
					$$links: {
						'was built from': {
							type: 'object',
							required: ['type'],
							properties: { type: { type: 'string', const: 'commit@1.0.0' } },
						},
					},
					properties: {
						type: {
							type: 'string',
							not: { enum: ['create@1.0.0', 'update@1.0.0'] },
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
								$$formula: 'contract.links["some link"]',
							},
							mentions2: {
								type: 'array',
								$$formula: '[]+contract.links["some link"]',
							},
							count: {
								type: 'array',
								$$formula:
									'5 + contract.links["other link"].reduce((o,sum)=>sum+1,0)',
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
