import type { JsonSchema } from 'autumndb';
import { Jellyscript } from './index';

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

describe('.getObjectMemberExpressions()', () => {
	test('should find all values exactly once', async () => {
		const links = Jellyscript.getObjectMemberExpressions(
			{
				type: 'object',
				properties: {
					data: {
						type: 'object',
						properties: {
							mentions: {
								type: 'array',
								$$formula: 'contract.links()["some other link"]',
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
			'contract',
			'links',
		);
		expect(links).toContain('some link');
		expect(links).toContain('other link');
	});

	test('should not fail if no formulas are given', async () => {
		const links = Jellyscript.getObjectMemberExpressions(
			{
				type: 'object',
				properties: {
					data: {
						type: 'object',
					},
				},
			},
			'contract',
			'links',
		);
		expect(links.length).toEqual(0);
	});
});

describe('custom formulas', () => {
	it('should allow a custom formula to be used', () => {
		const schema: JsonSchema = {
			type: 'object',
			properties: {
				value: {
					type: 'string',
				},
				message: {
					type: 'string',
					$$formula: 'GREET(contract.value)',
				},
			},
		};

		const formulaFn = (value: string): string => {
			return `Hello ${value}`;
		};

		const parser = new Jellyscript({
			formulas: {
				GREET: formulaFn,
			},
		});

		const result = parser.evaluateObject(schema, {
			value: 'world',
			message: '',
		});

		expect(result.message).toEqual('Hello world');
	});

	it('custom formulas should not be overwritten by different instances', () => {
		const NAME = 'SPEAK';

		const parser1 = new Jellyscript({
			formulas: {
				[NAME]: () => 'woof',
			},
		});

		const result1 = parser1.evaluate(`${NAME}()`, {
			context: {},
			input: '',
		});

		expect(result1).toEqual({
			value: 'woof',
		});

		const parser2 = new Jellyscript({
			formulas: {
				[NAME]: () => 'meow',
			},
		});

		const result = parser2.evaluate(`${NAME}()`, {
			context: {},
			input: '',
		});

		expect(result).toEqual({
			value: 'meow',
		});
	});
});
