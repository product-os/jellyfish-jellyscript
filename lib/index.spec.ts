import { Jellyscript, getReferencedLinkVerbs, getTypeTriggers } from './index';

describe('.evaluate()', () => {
	test('should return null if no input', () => {
		const parser = new Jellyscript();
		const result = parser.evaluate('POW(input, 2)', {
			context: {},
			input: null,
		});

		expect(result).toEqual({
			value: null,
		});
	});

	test('should resolve a number formula', () => {
		const parser = new Jellyscript();
		const result = parser.evaluate('POW(input, 2)', {
			context: {
				number: 2,
			},
			input: 2,
		});

		expect(result).toEqual({
			value: 4,
		});
	});

	test('should throw an error if the formula is bugged', () => {
		const parser = new Jellyscript();
		expect(() =>
			parser.evaluate('FOOBAR(input, 2', {
				context: {},
				input: 1,
			}),
		).toThrow();
	});

	test('should resolve a number formula', () => {
		const parser = new Jellyscript();
		const result = parser.evaluate('!input', {
			context: {
				number: true,
			},
			input: true,
		});

		expect(result).toEqual({
			value: false,
		});
	});

	test('should resolve composite formulas', () => {
		const parser = new Jellyscript();
		const result = parser.evaluate('MAX(POW(input, 2), POW(input, 3))', {
			context: {
				number: 2,
			},
			input: 2,
		});

		expect(result).toEqual({
			value: 8,
		});
	});

	test('should access other properties from the card', () => {
		const parser = new Jellyscript();
		const result = parser.evaluate('ADD(obj.value1, obj.value2)', {
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

	test('should handle combinations of functions', () => {
		const parser = new Jellyscript();
		const result = parser.evaluate(
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
});

test('UNIQUE(FLATMAP()): should aggregate a set of object properties', () => {
	const parser = new Jellyscript();
	const result = parser.evaluate('UNIQUE(FLATMAP(input, "mentions"))', {
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

describe('AGGREGATE', () => {
	test('should ignore duplicates', () => {
		const parser = new Jellyscript();
		const result = parser.evaluate('AGGREGATE(input, "mentions")', {
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
		});

		expect(result).toEqual({
			value: ['foo', 'bar', 'baz', 'qux'],
		});
	});

	test('should ignore missing values', () => {
		const parser = new Jellyscript();
		const result = parser.evaluate('AGGREGATE(input, "mentions")', {
			context: {},
			input: [
				{
					tags: ['foo', 'bar'],
				},
				{
					mentions: ['bar', 'baz'],
				},
				{
					mentions: ['baz', 'qux'],
				},
			],
		});

		expect(result).toEqual({
			value: ['bar', 'baz', 'qux'],
		});
	});

	test('should keep null, 0, and empty string values', () => {
		const parser = new Jellyscript();
		const result = parser.evaluate('AGGREGATE(input, "mentions")', {
			context: {},
			input: [
				{
					mentions: ['bar', 0],
				},
				{
					mentions: ['', null],
				},
			],
		});

		expect(result).toEqual({
			value: ['bar', 0, '', null],
		});
	});

	test('should aggregate a set of object properties', () => {
		const parser = new Jellyscript();
		const result = parser.evaluate('AGGREGATE(input, "mentions")', {
			context: {},
			input: [
				{
					mentions: ['foo'],
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

	test('should accept an initial value', () => {
		const parser = new Jellyscript();
		const result = parser.evaluate('AGGREGATE(input, "mentions", source)', {
			context: {
				source: ['baz'],
			},
			input: [
				{
					mentions: ['foo'],
				},
				{
					mentions: ['bar'],
				},
			],
		});

		expect(result).toEqual({
			value: ['baz', 'foo', 'bar'],
		});
	});

	test("should accept an initial value that isn't an array", () => {
		const parser = new Jellyscript();
		const result = parser.evaluate('AGGREGATE(input, "mentions", source)', {
			context: {
				source: 'baz',
			},
			input: [
				{
					mentions: ['foo'],
				},
				{
					mentions: ['bar'],
				},
			],
		});

		expect(result).toEqual({
			value: ['baz', 'foo', 'bar'],
		});
	});

	test('should just return the initial value as an array if input is empty', () => {
		const parser = new Jellyscript();
		const result = parser.evaluate('AGGREGATE(input, "mentions", source)', {
			context: {
				source: 'baz',
			},
			input: [],
		});

		expect(result).toEqual({
			value: ['baz'],
		});
	});

	test('should just return the initial value if input is missing', () => {
		const parser = new Jellyscript();
		const result = parser.evaluate('AGGREGATE(input, "mentions", source)', {
			context: {
				source: 'baz',
			},
			input: null,
		});

		expect(result).toEqual({
			value: ['baz'],
		});
	});
});

describe('REGEX_MATCH', () => {
	test('should extract a set of mentions', () => {
		const parser = new Jellyscript();
		const result = parser.evaluate('REGEX_MATCH(/(@[a-zA-Z0-9-]+)/g, input)', {
			context: {},
			input: 'Hello @johndoe, and @janedoe',
		});

		expect(result).toEqual({
			value: ['@johndoe', '@janedoe'],
		});
	});

	test('should consider duplicates', () => {
		const parser = new Jellyscript();
		const result = parser.evaluate('REGEX_MATCH(/(@[a-zA-Z0-9-]+)/g, input)', {
			context: {},
			input: 'Hello @johndoe, and @janedoe, and @johndoe',
		});

		expect(result).toEqual({
			value: ['@johndoe', '@janedoe', '@johndoe'],
		});
	});
});

describe('.evaluateObject()', () => {
	test('should evaluate a number formula', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
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

	test('should evaluate a EVERY formula', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
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

	test('should evaluate a SOME formula', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
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

	test('should evaluate a VALUES formula', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
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

	test('should evaluate a boolean formula', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
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

	test('should evaluate a formula in a $ prefixed property', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
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

	test('should evaluate a formula in a $$ prefixed property', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
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

	test('should ignore missing formulas', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					foo: {
						type: 'number',
						$$formula: 'FOOBARBUZ(input, 2)',
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

	test('should not ignore the zero number as missing', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
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

	test('should evaluate nested formulas', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
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

	test('should concatenate string with CONCATENATE function', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					foo: {
						type: 'string',
					},
					bar: {
						type: 'string',
					},
					greeting: {
						type: 'string',
						$$formula: "CONCATENATE(contract.foo, ' ', contract.bar)",
					},
				},
			},
			{
				foo: 'hello',
				bar: 'world',
			},
		);

		expect(result).toEqual({
			foo: 'hello',
			bar: 'world',
			greeting: 'hello world',
		});
	});

	test('should concatenate string with + operator', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					foo: {
						type: 'string',
					},
					bar: {
						type: 'string',
					},
					greeting: {
						type: 'string',
						$$formula: "contract.foo + ' ' + contract.bar",
					},
				},
			},
			{
				foo: 'hello',
				bar: 'world',
			},
		);

		expect(result).toEqual({
			foo: 'hello',
			bar: 'world',
			greeting: 'hello world',
		});
	});

	test('should not do anything if the schema has no formulas', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
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

	test('should get the last message/whisper from a timeline', () => {
		const parser = new Jellyscript();
		const evaluatedContract: any = parser.evaluateObject(
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

	test('should evaluate to undefined if no messages/whispers in a timeline', () => {
		const parser = new Jellyscript();
		const evaluatedContract: any = parser.evaluateObject(
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

	test('should evaluate computed fields that reference computed fields', () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					number: {
						type: 'string',
						$$formula: 'SUM(contract.input, 10)',
					},
					message: {
						type: 'string',
						$$formula: 'contract.lucky ? "lucky" : "not lucky"',
					},
					input: {
						type: 'number',
					},
					lucky: {
						type: 'boolean',
						$$formula: 'contract.number === 13 ? true: false',
					},
				},
			},
			{
				input: 3,
			},
		);

		expect(result).toEqual({
			message: 'lucky',
			lucky: true,
			number: 13,
			input: 3,
		});
	});

	test('should evaluate computed fields that reference nested computed fields', () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					input: {
						type: 'number',
					},
					lucky: {
						type: 'boolean',
						$$formula: 'contract.data.number === 13 ? true: false',
					},
					data: {
						type: 'object',
						properties: {
							number: {
								type: 'string',
								$$formula: 'SUM(contract.input, 10)',
							},
						},
					},
				},
			},
			{
				input: 3,
			},
		);

		expect(result).toEqual({
			input: 3,
			lucky: true,
			data: {
				number: 13,
			},
		});
	});

	test('should merge arrays when using AGGREGATE', () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					tags: {
						type: 'array',
						items: {
							type: 'string',
						},
						$$formula:
							'AGGREGATE(contract.links["has attached element"], "tags", input)',
					},
					links: {},
				},
			},
			{
				tags: ['foo', 'bar'],
				links: {
					'has attached element': [
						{
							tags: ['baz'],
						},
					],
				},
			},
		);

		expect(result.tags).toEqual(['foo', 'bar', 'baz']);
	});
});

describe('NEEDS', () => {
	test('.evaluateObject() should return never if an error exists for passed-in type', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					backflow: {
						type: 'array',
					},
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula: 'NEEDS(contract, "transformer-type")',
					},
				},
			},
			{
				data: {
					$transformer: {
						backflow: [
							{
								data: {
									expectedOutputTypes: ['transformer-type'],
								},
								type: 'error@1.0.0',
							},
						],
					},
				},
			},
		);

		expect(result).toEqual({
			data: {
				$transformer: {
					backflow: [
						{
							data: {
								expectedOutputTypes: ['transformer-type'],
							},
							type: 'error@1.0.0',
						},
					],
				},
			},
			mergeable: 'never',
		});
	});

	test('.evaluateObject() should return pending if an error exists but not for the passed-in type', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					backflow: {
						type: 'array',
					},
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula: 'NEEDS(contract, "transformer-type")',
					},
				},
			},
			{
				data: {
					$transformer: {
						backflow: [
							{
								data: {
									expectedOutputTypes: ['random-type'],
								},
								type: 'error@1.0.0',
							},
						],
					},
				},
			},
		);

		expect(result).toEqual({
			data: {
				$transformer: {
					backflow: [
						{
							data: {
								expectedOutputTypes: ['random-type'],
							},
							type: 'error@1.0.0',
						},
					],
				},
			},
			mergeable: 'pending',
		});
	});

	test('.evaluateObject() should return mergeable if backflow mergeable is "mergeable" and has no error', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					backflow: {
						type: 'array',
					},
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula: 'NEEDS(contract, "transformer-type")',
					},
				},
			},
			{
				data: {
					$transformer: {
						backflow: [
							{
								type: 'transformer-type@1.0.0',
								data: {
									$transformer: {
										mergeable: 'mergeable',
									},
								},
							},
						],
					},
				},
			},
		);

		expect(result).toEqual({
			data: {
				$transformer: {
					backflow: [
						{
							type: 'transformer-type@1.0.0',
							data: {
								$transformer: {
									mergeable: 'mergeable',
								},
							},
						},
					],
				},
			},
			mergeable: 'mergeable',
		});
	});

	test('.evaluateObject() should return mergeable if backflow mergeable is true and has no error', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					backflow: {
						type: 'array',
					},
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula: 'NEEDS(contract, "transformer-type")',
					},
				},
			},
			{
				data: {
					$transformer: {
						backflow: [
							{
								type: 'transformer-type@1.0.0',
								data: {
									$transformer: {
										mergeable: true,
									},
								},
							},
						],
					},
				},
			},
		);

		expect(result).toEqual({
			data: {
				$transformer: {
					backflow: [
						{
							type: 'transformer-type@1.0.0',
							data: {
								$transformer: {
									mergeable: true,
								},
							},
						},
					],
				},
			},
			mergeable: 'mergeable',
		});
	});

	test('.evaluateObject() should return pending if backflow mergeable is false and has no error', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					backflow: {
						type: 'array',
					},
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula: 'NEEDS(contract, "transformer-type")',
					},
				},
			},
			{
				data: {
					$transformer: {
						backflow: [
							{
								type: 'transformer-type@1.0.0',
								data: {
									$transformer: {
										mergeable: false,
									},
								},
							},
						],
					},
				},
			},
		);

		expect(result).toEqual({
			data: {
				$transformer: {
					backflow: [
						{
							type: 'transformer-type@1.0.0',
							data: {
								$transformer: {
									mergeable: false,
								},
							},
						},
					],
				},
			},
			mergeable: 'pending',
		});
	});

	test('.evaluateObject() should return mergeable if backflow mergeable is "mergeable", it has no error and callback succeeds', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					backflow: {
						type: 'array',
					},
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula:
							'NEEDS(contract, "transformer-type", function (c) { return c && c.data.foo === "bar" })',
					},
				},
			},
			{
				data: {
					$transformer: {
						backflow: [
							{
								type: 'transformer-type@1.0.0',
								data: {
									$transformer: {
										mergeable: 'mergeable',
									},
									foo: 'bar',
								},
							},
						],
					},
				},
			},
		);

		expect(result).toEqual({
			data: {
				$transformer: {
					backflow: [
						{
							type: 'transformer-type@1.0.0',
							data: {
								$transformer: {
									mergeable: 'mergeable',
								},
								foo: 'bar',
							},
						},
					],
				},
			},
			mergeable: 'mergeable',
		});
	});

	test('.evaluateObject() should return mergeable if backflow mergeable is "mergeable", it has no error and callback fails', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					backflow: {
						type: 'array',
					},
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula:
							'NEEDS(contract, "transformer-type", function (c) { return c && c.data.foo === "notbar" })',
					},
				},
			},
			{
				data: {
					$transformer: {
						backflow: [
							{
								type: 'transformer-type@1.0.0',
								data: {
									$transformer: {
										mergeable: 'mergeable',
									},
									foo: 'bar',
								},
							},
						],
					},
				},
			},
		);

		expect(result).toEqual({
			data: {
				$transformer: {
					backflow: [
						{
							type: 'transformer-type@1.0.0',
							data: {
								$transformer: {
									mergeable: 'mergeable',
								},
								foo: 'bar',
							},
						},
					],
				},
			},
			mergeable: 'pending',
		});
	});

	test('.evaluateObject() should return never if an error exists for passed-in type and callback succeeds', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					backflow: {
						type: 'array',
					},
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula:
							'NEEDS(contract, "transformer-type", function (c) { return c && c.data.foo === "bar" })',
					},
				},
			},
			{
				data: {
					$transformer: {
						backflow: [
							{
								data: {
									expectedOutputTypes: ['transformer-type'],
									foo: 'bar',
								},
								type: 'error@1.0.0',
							},
						],
					},
				},
			},
		);

		expect(result).toEqual({
			data: {
				$transformer: {
					backflow: [
						{
							data: {
								expectedOutputTypes: ['transformer-type'],
								foo: 'bar',
							},
							type: 'error@1.0.0',
						},
					],
				},
			},
			mergeable: 'never',
		});
	});

	test('.evaluateObject() should return never if an error exists for passed-in type and callback fails', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					backflow: {
						type: 'array',
					},
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula:
							'NEEDS(contract, "transformer-type", function (c) { return c && c.data.foo === "notbar" })',
					},
				},
			},
			{
				data: {
					$transformer: {
						backflow: [
							{
								data: {
									expectedOutputTypes: ['transformer-type'],
									foo: 'bar',
								},
								type: 'error@1.0.0',
							},
						],
					},
				},
			},
		);

		expect(result).toEqual({
			data: {
				$transformer: {
					backflow: [
						{
							data: {
								expectedOutputTypes: ['transformer-type'],
								foo: 'bar',
							},
							type: 'error@1.0.0',
						},
					],
				},
			},
			mergeable: 'pending',
		});
	});
});

describe('NEEDS_ALL', () => {
	test('.evaluateObject() should return never if at least one parameter is never', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					mergeable: {
						type: 'string',
						enum: ['never', 'pending', 'mergeable'],
						$$formula: 'NEEDS_ALL("mergeable", "pending", "never")',
					},
				},
			},
			{
				mergeable: 'random-value',
			},
		);

		expect(result).toEqual({
			mergeable: 'never',
		});
	});

	test('.evaluateObject() should return pending if there is no never parameter and at least one pending', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					mergeable: {
						type: 'string',
						enum: ['pending', 'never', 'mergeable'],
						$$formula: 'NEEDS_ALL("pending", "mergeable")',
					},
				},
			},
			{
				mergeable: 'random-value',
			},
		);

		expect(result).toEqual({
			mergeable: 'pending',
		});
	});

	test('.evaluateObject() should return mergeable if all parameters are mergeable', async () => {
		const parser = new Jellyscript();
		const result = parser.evaluateObject(
			{
				type: 'object',
				properties: {
					mergeable: {
						type: 'string',
						enum: ['pending', 'never', 'mergeable'],
						$$formula: 'NEEDS_ALL("mergeable", "mergeable")',
					},
				},
			},
			{
				mergeable: 'random-value',
			},
		);

		expect(result).toEqual({
			mergeable: 'mergeable',
		});
	});
});

describe('.getTypeTriggers()', () => {
	test('should report back watchers when aggregating events', async () => {
		const triggers = getTypeTriggers({
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

	test('should report back watchers when aggregating events with UNIQUE and FLATMAP', async () => {
		const triggers = getTypeTriggers({
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

	test('should properly reverse links', async () => {
		const triggers = getTypeTriggers({
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
				slug: 'triggered-action-formula-update-commit-is-attached-to',
				type: 'triggered-action@1.0.0',
				version: '1.0.0',
				active: true,
				requires: [],
				capabilities: [],
				markers: [],
				tags: [],
				data: {
					action: 'action-update-card@1.0.0',
					type: 'commit@1.0.0',
					target: {
						$map: {
							$eval: "source.links['is attached to']",
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
							'is attached to': {
								type: 'object',
								required: ['type'],
								properties: {
									type: {
										type: 'string',
										const: 'commit@1.0.0',
									},
								},
							},
						},
						properties: {
							type: {
								type: 'string',
								enum: [
									'message@1.0.0',
									'whisper@1.0.0',
									'create@1.0.0',
									'update@1.0.0',
									'rating@1.0.0',
									'summary@1.0.0',
								],
							},
							updated_at: true,
						},
					},
				},
			},
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
							updated_at: true,
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
								not: { enum: ['create@1.0.0', 'update@1.0.0', 'link@1.0.0'] },
							},
							updated_at: true,
						},
					},
				},
			},
		]);
	});
});

describe('getReferencedLinkVerbs()', () => {
	test('should find all verbs exactly once', async () => {
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

	test('should not fail if no formulas are given', async () => {
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
});
