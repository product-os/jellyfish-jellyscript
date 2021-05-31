declare module 'object-deep-search' {
	function find<TResult>(input: any, filter: any): TResult[];
	function findFirst<TResult>(input: any, filter: any): TResult;
}
