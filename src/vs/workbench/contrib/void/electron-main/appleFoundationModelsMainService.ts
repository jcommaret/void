/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { spawn, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec as _exec } from 'child_process';
import { existsSync } from 'fs';
import { isMacintosh } from '../../../../base/common/platform.js';
import {
	AFM_HOMEBREW_FORMULA,
	AFM_HOMEBREW_TAP,
	AFM_PIP_PACKAGE,
	APPLE_FOUNDATION_MODELS_DEFAULT_PORT,
	AppleFoundationModelsEnsureResult,
	FM_CLI_DEFAULT_PORT,
	FM_CLI_MIN_MACOS_VERSION,
	FM_CLI_PATH,
	IAppleFoundationModelsMainService,
	MACLOCAL_API_REPO_URL,
} from '../common/appleFoundationModelsTypes.js';

const exec = promisify(_exec);

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class AppleFoundationModelsMainService implements IAppleFoundationModelsMainService {
	readonly _serviceBrand: undefined;

	private _child: ChildProcess | null = null;
	private _spawnedByVoid = false;

	async ensureReady(options: { installIfMissing: boolean; startServer: boolean; port?: number }): Promise<AppleFoundationModelsEnsureResult> {
		const log: string[] = [];

		if (!isMacintosh) {
			return { ok: false, reason: 'not-mac', log };
		}

		// decide macOS-version-appropriate backend (and its own default port) before checking anything already listening,
		// so a leftover/manually-started `afm` process on the legacy port is never mistaken for `fm serve`, or vice versa
		const macOSMajorVersion = await this._getMacOSMajorVersion();
		const useFm = macOSMajorVersion !== null && macOSMajorVersion >= FM_CLI_MIN_MACOS_VERSION;

		const port = options.port ?? (useFm ? FM_CLI_DEFAULT_PORT : APPLE_FOUNDATION_MODELS_DEFAULT_PORT);
		const endpoint = `http://127.0.0.1:${port}`;

		if (useFm) {
			return this._ensureReadyViaFm(options, port, endpoint, log);
		}

		if (await this._isServerUp(endpoint)) {
			log.push(`maclocal-api (afm) already running at ${endpoint}`);
			return { ok: true, endpoint, action: 'already-running', log };
		}

		let didInstall = false;
		let afmPath = await this._whichAfm();
		if (!afmPath) {
			if (!options.installIfMissing) {
				log.push('`afm` not found (maclocal-api).');
				return {
					ok: false,
					reason: 'afm-missing',
					log,
					errorMessage: `Install from ${MACLOCAL_API_REPO_URL} — Homebrew: brew tap ${AFM_HOMEBREW_TAP} && brew install ${AFM_HOMEBREW_FORMULA} — or pip: pip install ${AFM_PIP_PACKAGE}`,
				};
			}

			const installedViaBrew = await this._tryInstallViaHomebrew(log);
			if (installedViaBrew) {
				didInstall = true;
			} else {
				const installedViaPip = await this._tryInstallViaPip(log);
				if (installedViaPip) {
					didInstall = true;
				} else {
					return {
						ok: false,
						reason: 'install-failed',
						log,
						errorMessage: `Could not install afm. See ${MACLOCAL_API_REPO_URL}`,
					};
				}
			}

			afmPath = await this._whichAfm();
			if (!afmPath) {
				log.push('`afm` still not on PATH after install.');
				return { ok: false, reason: 'afm-missing', log };
			}
		} else {
			log.push(`Found afm: ${afmPath}`);
		}

		if (options.startServer) {
			await this._startServer(afmPath, port, log);
		}

		for (let i = 0; i < 45; i++) {
			if (await this._isServerUp(endpoint)) {
				const action = didInstall ? 'installed-and-started' as const : 'started' as const;
				log.push(`maclocal-api ready at ${endpoint} (model: foundation)`);
				return { ok: true, endpoint, action, log };
			}
			await sleep(1000);
		}

		log.push('Timed out waiting for afm.');
		return {
			ok: false,
			reason: 'server-timeout',
			log,
			errorMessage: `Server did not respond at ${endpoint}. Run manually: afm -p ${port} -H 127.0.0.1`,
		};
	}

	private async _getMacOSMajorVersion(): Promise<number | null> {
		try {
			const { stdout } = await exec('sw_vers -productVersion', { timeout: 5_000 });
			const major = parseInt(stdout.trim().split('.')[0], 10);
			return Number.isFinite(major) ? major : null;
		} catch {
			return null;
		}
	}

	// macOS 27+ ships the `fm` CLI as a system binary (no install step); use `fm serve` instead of the third-party `afm` tool
	private async _ensureReadyViaFm(
		options: { installIfMissing: boolean; startServer: boolean; port?: number },
		port: number,
		endpoint: string,
		log: string[],
	): Promise<AppleFoundationModelsEnsureResult> {
		if (await this._isServerUp(endpoint)) {
			log.push(`fm serve already running at ${endpoint}`);
			return { ok: true, endpoint, action: 'already-running', log };
		}

		const fmPath = await this._whichFm();
		if (!fmPath) {
			log.push('`fm` not found (expected to ship with macOS 27+).');
			return {
				ok: false,
				reason: 'fm-missing',
				log,
				errorMessage: `\`fm\` was not found at ${FM_CLI_PATH} or on PATH. It ships with macOS ${FM_CLI_MIN_MACOS_VERSION}+; make sure macOS is up to date.`,
			};
		}
		log.push(`Found fm: ${fmPath}`);

		let getCrashInfo: () => string | null = () => null;
		if (options.startServer) {
			getCrashInfo = await this._startFmServer(fmPath, port, log);
		}

		for (let i = 0; i < 45; i++) {
			if (await this._isServerUp(endpoint)) {
				log.push(`fm serve ready at ${endpoint}`);
				return { ok: true, endpoint, action: 'started', log };
			}
			const crashInfo = getCrashInfo();
			if (crashInfo) {
				log.push(crashInfo);
				return { ok: false, reason: 'fm-crashed', log, errorMessage: crashInfo };
			}
			await sleep(1000);
		}

		log.push('Timed out waiting for fm.');
		return {
			ok: false,
			reason: 'server-timeout',
			log,
			errorMessage: `Server did not respond at ${endpoint}. Run manually: fm serve --port ${port} --host 127.0.0.1`,
		};
	}

	private async _whichFm(): Promise<string | null> {
		if (existsSync(FM_CLI_PATH)) {
			return FM_CLI_PATH;
		}
		try {
			const { stdout } = await exec('which fm', { timeout: 5_000 });
			const path = stdout.trim();
			return path || null;
		} catch {
			return null;
		}
	}

	// returns a getter for the crash message (exit code + captured stdout/stderr) if `fm` has already exited, or null while it's still running
	private async _startFmServer(fmPath: string, port: number, log: string[]): Promise<() => string | null> {
		if (this._child && !this._child.killed) {
			log.push('Kodia fm process already running.');
			return () => null;
		}

		// NOT detached: `detached: true` calls setsid(2), moving the child to a new session and
		// severing its lineage from Kodia's own (Terminal/Aqua-rooted) session. Confirmed by testing:
		// `fm respond --model pcc` succeeds when run from a normal Terminal session, and succeeds when
		// Kodia talks to an `fm serve` started that way — but fails with "PCC inference is not
		// available in this context" when Kodia spawns `fm serve` detached. PCC (unlike the on-device
		// `system` model) apparently checks the caller's session lineage. `unref()` below still lets
		// Kodia's main process exit without waiting on this child.
		log.push(`Starting fm: fm serve --port ${port} --host 127.0.0.1…`);
		const child = spawn(fmPath, ['serve', '--port', String(port), '--host', '127.0.0.1'], {
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		const output: string[] = [];
		let crashInfo: string | null = null;
		const capture = (chunk: Buffer) => {
			output.push(chunk.toString());
			if (output.length > 50) {
				output.shift();
			}
		};
		child.stdout?.on('data', capture);
		child.stderr?.on('data', capture);
		child.on('exit', (code, signal) => {
			crashInfo = `fm exited (code=${code ?? 'null'}, signal=${signal ?? 'null'}): ${output.join('').trim() || '(no output)'}`;
		});

		child.unref();
		this._child = child;
		this._spawnedByVoid = true;

		return () => crashInfo;
	}

	async stopServerIfSpawnedByVoid(): Promise<void> {
		if (!this._spawnedByVoid || !this._child || this._child.killed) {
			return;
		}
		try {
			this._child.kill();
		} catch {
			// ignore
		}
		this._child = null;
		this._spawnedByVoid = false;
	}

	private _brewExecEnv(brewPath: string): NodeJS.ProcessEnv {
		// Ensure the Homebrew bin dir is in PATH so brew's own scripts work
		const brewBin = brewPath.replace(/\/brew$/, '');
		const existing = process.env['PATH'] ?? '/usr/bin:/bin:/usr/sbin:/sbin';
		return { ...process.env, PATH: existing.includes(brewBin) ? existing : `${brewBin}:${existing}` };
	}

	private async _tryInstallViaHomebrew(log: string[]): Promise<boolean> {
		const brewPath = await this._whichBrew();
		if (!brewPath) {
			log.push('Homebrew not found; will try pip install macafm.');
			return false;
		}

		const env = this._brewExecEnv(brewPath);
		log.push(`Installing afm via Homebrew (${AFM_HOMEBREW_FORMULA})…`);
		try {
			await exec(`"${brewPath}" tap ${AFM_HOMEBREW_TAP}`, { timeout: 120_000, env });
			await exec(`"${brewPath}" install ${AFM_HOMEBREW_FORMULA}`, { timeout: 600_000, env });
			log.push('Homebrew install finished.');
			return true;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			log.push(`Homebrew install failed: ${msg}`);
			return false;
		}
	}

	private async _tryInstallViaPip(log: string[]): Promise<boolean> {
		const pythonPath = await this._whichPython3();
		if (!pythonPath) {
			log.push('python3 not found; cannot pip install macafm.');
			return false;
		}

		log.push(`Installing ${AFM_PIP_PACKAGE} via pip (${MACLOCAL_API_REPO_URL})…`);
		try {
			await exec(`"${pythonPath}" -m pip install --upgrade ${AFM_PIP_PACKAGE}`, { timeout: 600_000 });
			log.push('pip install finished.');
			return true;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			log.push(`pip install failed: ${msg}`);
			return false;
		}
	}

	private async _whichPython3(): Promise<string | null> {
		// GUI apps on macOS don't inherit the full shell PATH; check known locations first
		for (const candidate of [
			'/opt/homebrew/bin/python3',
			'/usr/local/bin/python3',
			'/usr/bin/python3',
		]) {
			if (existsSync(candidate)) {
				return candidate;
			}
		}
		for (const cmd of ['python3', 'python']) {
			try {
				const { stdout } = await exec(`which ${cmd}`, { timeout: 5_000 });
				const path = stdout.trim();
				if (path) {
					return path;
				}
			} catch {
				// try next
			}
		}
		return null;
	}

	private async _whichAfm(): Promise<string | null> {
		// GUI apps on macOS don't inherit the full shell PATH; check known locations first
		for (const candidate of [
			'/opt/homebrew/bin/afm',   // Apple Silicon Homebrew
			'/usr/local/bin/afm',       // Intel Homebrew
		]) {
			if (existsSync(candidate)) {
				return candidate;
			}
		}
		try {
			const brewPath = await this._whichBrew();
			if (brewPath) {
				const brewPrefix = brewPath.replace(/\/bin\/brew$/, '');
				const candidate = `${brewPrefix}/bin/afm`;
				if (existsSync(candidate)) {
					return candidate;
				}
			}
		} catch {
			// fall through to which
		}
		try {
			const { stdout } = await exec('which afm', { timeout: 5_000 });
			const path = stdout.trim();
			return path || null;
		} catch {
			return null;
		}
	}

	private async _whichBrew(): Promise<string | null> {
		// GUI apps on macOS don't inherit the full shell PATH; check known locations first
		for (const candidate of [
			'/opt/homebrew/bin/brew',  // Apple Silicon
			'/usr/local/bin/brew',      // Intel
		]) {
			if (existsSync(candidate)) {
				return candidate;
			}
		}
		try {
			const { stdout } = await exec('which brew', { timeout: 5_000 });
			const path = stdout.trim();
			return path || null;
		} catch {
			return null;
		}
	}

	private async _isServerUp(endpoint: string): Promise<boolean> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 2_500);
		try {
			const health = await fetch(`${endpoint}/health`, { signal: controller.signal });
			if (health.ok) {
				return true;
			}
		} catch {
			// try /v1/models next
		} finally {
			clearTimeout(timeout);
		}

		const controller2 = new AbortController();
		const timeout2 = setTimeout(() => controller2.abort(), 2_500);
		try {
			const models = await fetch(`${endpoint}/v1/models`, { signal: controller2.signal });
			return models.ok;
		} catch {
			return false;
		} finally {
			clearTimeout(timeout2);
		}
	}

	private async _startServer(afmPath: string, port: number, log: string[]): Promise<void> {
		if (this._child && !this._child.killed) {
			log.push('Kodia afm process already running.');
			return;
		}

		log.push(`Starting maclocal-api: afm -p ${port} -H 127.0.0.1…`);
		const child = spawn(afmPath, ['-p', String(port), '-H', '127.0.0.1'], {
			detached: true,
			stdio: 'ignore',
		});
		child.unref();
		this._child = child;
		this._spawnedByVoid = true;
	}
}
