/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

// Type definitions for formulajs

declare module '@formulajs/formulajs' {
	function PARTIAL(func: function, ...partials: any[]): any;
	function FLIP(func: function): any;
	function PROPERTY(
		obj: object,
		path: Array<string | number> | string,
		defaultValue?: any,
	): any;
	function FLATMAP<T>(collection: T[] | object, iteratee?: (item: T) => T): any;
	function FILTER<T>(
		collection: List<T> | null | undefined,
		predicate?: ListIterateeCustom<T, boolean>,
	): List<T>;
	function REJECT<T>(
		collection: List<T> | null | undefined,
		predicate?: ListIterateeCustom<T, boolean>,
	): List<T>;
	function EVERY<T>(
		collection: List<T> | null | undefined,
		predicate?: ListIterateeCustom<T, boolean>,
	): boolean;
	function SOME<T>(
		collection: List<T> | null | undefined,
		predicate?: ListIterateeCustom<T, boolean>,
	): boolean;
	function VALUES(obj: object): any[];
	function UNIQUE<T>(array: T[]): T[];
	function REGEX_MATCH(
		regex: string | RegExp,
		str: string,
	): RegExpMatchArray | null;
	function AGGREGATE<T>(list: T[], func: (item: T) => Iterable<T>): T[];
	function ORDER_BY<T>(
		collection: List<T> | null | undefined,
		iteratees?: Many<ListIterator<T, NotVoid>>,
		orders?: Many<boolean | 'asc' | 'desc'>,
	): T[];
	function LAST<T>(array: List<T> | null | undefined): T | undefined;
}
