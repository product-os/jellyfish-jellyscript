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
	function AGGREGATE<T>(list: T[], path: string, initial: any): T[];
	function ORDER_BY<T>(
		collection: List<T> | null | undefined,
		iteratees?: Many<ListIterator<T, NotVoid>>,
		orders?: Many<boolean | 'asc' | 'desc'>,
	): T[];
	function LAST<T>(array: List<T> | null | undefined): T | undefined;
	function NEEDS(
		contract: any,
		type: string,
		func: (contract: any) => boolean,
	): NEEDS_STATUS;
	function NEEDS_ALL(...statuses: NEEDS_STATUS[]): NEEDS_STATUS;
}
