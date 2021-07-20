/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as sdk from '@balena/jellyfish-client-sdk';
import _ from 'lodash';

const linkConstraintsBySlug = _.keyBy(sdk.linkConstraints, (lc) => lc.slug);
const inverseLinks = _.groupBy(
	sdk.linkConstraints,
	(lc) => linkConstraintsBySlug[lc.data.inverse].name,
);

/**
 * reverses link verbs as they are defined in the SDK.
 * If the link is not defined in the SDK, we assume it to be named
 * symmetrically.
 *
 * @param targetTypeSlug the type the link is starting from
 * @param linkVerb the link verb to reverse
 * @returns a reverse link verbs
 */
export const reverseLink = (versionedSourceType: string, linkVerb: string) => {
	const [srcType] = versionedSourceType.split('@');
	if (!inverseLinks[linkVerb]) {
		return {};
	}
	const relevantInverseLinks = inverseLinks[linkVerb].filter(
		(l) => l.data.to === srcType || l.data.to === '*',
	);
	return _.groupBy(relevantInverseLinks, (l) => l.name);
};
