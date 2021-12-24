import { getFormulasPaths } from './card';

describe('getFormulasPaths', () => {
	test('should return an empty array given no formulas', () => {
		const paths = getFormulasPaths({
			type: 'object',
			properties: {
				foo: {
					type: 'string',
				},
				bar: {
					type: 'string',
				},
			},
		});

		expect(paths).toEqual([]);
	});

	test('should return one property with formulas', () => {
		const paths = getFormulasPaths({
			type: 'object',
			properties: {
				foo: {
					type: 'string',
					$$formula: 'UPPER(input)',
				},
				bar: {
					type: 'string',
				},
			},
		});

		expect(paths).toEqual([
			{
				formula: 'UPPER(input)',
				output: ['foo'],
				type: 'string',
			},
		]);
	});

	test('should return nested properties with formulas', () => {
		const paths = getFormulasPaths({
			type: 'object',
			properties: {
				foo: {
					type: 'string',
					$$formula: 'UPPER(input)',
				},
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
		});

		expect(paths).toEqual([
			{
				formula: 'UPPER(input)',
				output: ['foo'],
				type: 'string',
			},
			{
				formula: 'POW(input, 2)',
				output: ['bar', 'baz'],
				type: 'number',
			},
		]);
	});

	test('should return properties inside arrays', () => {
		const paths = getFormulasPaths({
			type: 'object',
			anyOf: [
				{
					properties: {
						foo: {
							type: 'string',
							$$formula: 'UPPER(input)',
						},
					},
				},
				{
					properties: {
						bar: {
							type: 'string',
							$$formula: 'LOWER(input)',
						},
					},
				},
			],
		});

		expect(paths).toEqual([
			{
				formula: 'UPPER(input)',
				output: ['foo'],
				type: 'string',
			},
			{
				formula: 'LOWER(input)',
				output: ['bar'],
				type: 'string',
			},
		]);
	});
});
