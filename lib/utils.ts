/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import objectHash from 'object-hash';
import * as sdk from '@balena/jellyfish-client-sdk';

/**
 * @summary Hash a JavaScript object
 * @function
 * @public
 *
 * @param {Object} object - object
 * @returns {String} object hash
 *
 * @example
 * const string = utils.hashObject({ foo: 'bar' })
 * console.log(string)
 */
export const hashObject = (object: any): string => {
	return objectHash(object, {
		algorithm: 'sha1',
		ignoreUnknown: true,

		// This in particular is a HUGE improvement
		respectType: false,
	});
};

const linkConstraints = sdk.linkConstraints.reduce(
	(all, lc) => all.set(lc.slug, lc),
	new Map<string, typeof sdk.linkConstraints[0]>(),
);
const reverseLinks = sdk.linkConstraints.reduce((reverse, lc) => {
	reverse.set(
		`${lc.name}__${lc.data.to}`,
		linkConstraints.get(lc.data.inverse)?.name,
	);
	return reverse;
}, new Map<string, string | undefined>());

/**
 * reverses link verbs as they are defined in the SDK.
 * If the link is not defined in the SDK, we assume it to be named
 * symmetrically.
 *
 * @param linkVerb the link ver to reverse
 * @param targetTypeSlug the type the link is pointing to
 * @returns the reverse link verb, pointing away from the type
 */
export const reverseLink = (
	linkVerb: string,
	targetTypeSlug: string,
): string => {
	const [toType] = targetTypeSlug.split('@');
	return (
		reverseLinks.get(`${linkVerb}__${toType}`) ||
		reverseLinks.get(`${linkVerb}__*`) ||
		linkVerb
	);
};
