/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { fromNow } from '../../../base/common/date.js';
import { localize } from '../../../nls.js';
import { IProductService } from '../../product/common/productService.js';

export function createNativeAboutDialogDetails(productService: IProductService): { title: string; details: string; detailsToCopy: string } {
	// Use the Kodia version from productService
	const voidVersion = productService.voidVersion || '1.5.0';
	let version = productService.version;
	if (productService.target) {
		version = `${version} (${productService.target} setup)`;
	} else if (productService.darwinUniversalAssetId) {
		version = `${version} (Universal)`;
	}

	const getDetails = (useAgo: boolean): string => {
		return localize('aboutDetail',
			"Version: {0}\nKodia Version: {1}\nCommit: {2}\nDate: {3}",
			version,
			voidVersion,
			productService.commit || 'Unknown',
			productService.date ? `${productService.date}${useAgo ? ' (' + fromNow(new Date(productService.date), true) + ')' : ''}` : 'Unknown'
		);
	};

	const details = getDetails(true);
	const detailsToCopy = getDetails(false);

	return {
		title: productService.nameLong,
		details: details,
		detailsToCopy: detailsToCopy
	};
}
