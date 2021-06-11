/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import objectHash from 'object-hash';

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
