import isString from 'lodash/isString';
import cloneDeep from 'lodash/cloneDeep';
import { hashObject } from './hash-object';

describe('hashObject', () => {
	test('should return a string', () => {
		expect(
			isString(
				hashObject({
					foo: 'bar',
				}),
			),
		).toBe(true);
	});

	test('should not care about properties order', () => {
		const hash1 = hashObject({
			foo: 'bar',
			bar: 'baz',
		});

		const hash2 = hashObject({
			bar: 'baz',
			foo: 'bar',
		});

		expect(hash1).toEqual(hash2);
	});

	test('should not rely on object references', () => {
		const object = {
			foo: 'bar',
		};

		const hash1 = hashObject(cloneDeep(object));
		const hash2 = hashObject(cloneDeep(object));
		const hash3 = hashObject(cloneDeep(object));

		expect(hash1).toEqual(hash2);
		expect(hash2).toEqual(hash3);
		expect(hash3).toEqual(hash1);
	});

	test('should return different hashes for different objects', () => {
		const hash1 = hashObject({
			foo: 'bar',
		});

		const hash2 = hashObject({
			foo: 'baz',
		});

		const hash3 = hashObject({
			foo: 'qux',
		});

		expect(hash1).not.toEqual(hash2);
		expect(hash2).not.toEqual(hash3);
		expect(hash3).not.toEqual(hash1);
	});
});
