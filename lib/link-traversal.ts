/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as sdk from '@balena/jellyfish-client-sdk';
import _ from 'lodash';

const linkConstraintsBySlug = _.keyBy(sdk.linkConstraints, (lc) => lc.slug);
const linkConstraintsByVerb = _.groupBy(sdk.linkConstraints, (lc) => lc.name);
// "verb__type" => "inverse"
const inverseLinksPerType = sdk.linkConstraints.reduce(
	(map, lc) =>
		map.set(
			`${lc.name}__${lc.data.to}`,
			linkConstraintsBySlug[lc.data.inverse].name,
		),
	new Map<string, string>(),
);

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
		inverseLinksPerType.get(`${linkVerb}__${toType}`) ||
		inverseLinksPerType.get(`${linkVerb}__*`) ||
		linkVerb
	);
};

export const getSourceTypes = (linkVerb: string) => {
	return _.uniq(linkConstraintsByVerb[linkVerb]?.map((lc) => lc.data.from));
};
