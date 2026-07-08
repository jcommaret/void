/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as git from './git.ts';

export function getVersion(root: string): string | undefined {
	let version = process.env['BUILD_SOURCEVERSION'];

	if (!version || !/^[0-9a-f]{40}$/i.test(version.trim())) {
		version = git.getVersion(root);
	}

	return version;
}

/**
 * The CI tags each build as `<vscodeVersion>-<kodiaVersion>` (e.g. `1.121.0-2.0.19`),
 * incrementing the kodia patch number per build. Read it from the nearest tag reachable
 * from HEAD so the About dialog reflects the actual build instead of the last value
 * someone happened to check into product.json.
 */
export function getVoidVersion(root: string, fallback: string): string {
	try {
		const tag = cp.execSync('git describe --tags --match "[0-9]*.[0-9]*.[0-9]*-[0-9]*.[0-9]*.[0-9]*"', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
		const match = /^\d+\.\d+\.\d+-(\d+\.\d+\.\d+)/.exec(tag);
		if (match) {
			return match[1];
		}
	} catch (e) {
		// not a git checkout, no matching tags reachable from HEAD, or git unavailable
	}
	return fallback;
}
