/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';

/**
 * A token-bucket rate limiter that smooths request *starts* to at most `rps`
 * per second while still allowing a short burst (the bucket capacity).
 *
 * Used by {@link MistralApiService} to keep the agent host under Mistral's
 * per-workspace request rate limit. Gating the *start* of each request (the
 * outbound POST that opens a conversation stream) is what "requests per second"
 * means here — the stream that follows stays open and is not counted again.
 *
 * A rate of `0` (or negative) disables throttling entirely: {@link acquire}
 * resolves immediately.
 */
export class TokenBucketRateLimiter extends Disposable {

	/** Refill rate in tokens/second. `0` disables throttling. */
	private _refillPerSecond = 0;
	/** Maximum tokens the bucket can hold (the allowed burst). */
	private _capacity = 0;
	/** Current token count, refilled lazily based on elapsed time. */
	private _tokens = 0;
	/** `Date.now()` of the last refill. */
	private _lastRefillMs = Date.now();

	/** FIFO waiters parked until a token is available. */
	private readonly _waiters: Array<() => void> = [];
	private _timer: ReturnType<typeof setTimeout> | undefined;
	private _disposed = false;

	constructor(requestsPerSecond: number, private readonly _now: () => number = Date.now) {
		super();
		this.setRate(requestsPerSecond);
	}

	/**
	 * Change the allowed rate. Resets the bucket to full so a lowered rate does
	 * not retroactively "owe" tokens. Setting `0` flushes any parked waiters.
	 */
	setRate(requestsPerSecond: number): void {
		this._refillPerSecond = requestsPerSecond > 0 ? requestsPerSecond : 0;
		// Allow a burst of one whole second's worth of requests (at least 1).
		this._capacity = this._refillPerSecond > 0 ? Math.max(1, Math.ceil(this._refillPerSecond)) : 0;
		this._tokens = this._capacity;
		this._lastRefillMs = this._now();
		if (this._refillPerSecond === 0) {
			this._flushAll();
		}
	}

	/** The currently configured rate (tokens/second); `0` means disabled. */
	get rate(): number {
		return this._refillPerSecond;
	}

	/**
	 * Resolves once a token is available (immediately when throttling is
	 * disabled or the bucket is non-empty and no one is queued ahead).
	 */
	acquire(): Promise<void> {
		if (this._disposed || this._refillPerSecond === 0) {
			return Promise.resolve();
		}
		this._refill();
		// Honour FIFO order: only take a token directly when nobody is waiting.
		if (this._waiters.length === 0 && this._tokens >= 1) {
			this._tokens -= 1;
			return Promise.resolve();
		}
		return new Promise<void>(resolve => {
			this._waiters.push(resolve);
			this._schedule();
		});
	}

	private _refill(): void {
		const now = this._now();
		const elapsedSec = (now - this._lastRefillMs) / 1000;
		if (elapsedSec > 0) {
			this._tokens = Math.min(this._capacity, this._tokens + elapsedSec * this._refillPerSecond);
			this._lastRefillMs = now;
		}
	}

	private _drain(): void {
		this._refill();
		while (this._waiters.length > 0 && this._tokens >= 1) {
			this._tokens -= 1;
			this._waiters.shift()!();
		}
		if (this._waiters.length > 0) {
			this._schedule();
		}
	}

	private _schedule(): void {
		if (this._timer !== undefined || this._refillPerSecond === 0) {
			return;
		}
		const deficit = Math.max(0, 1 - this._tokens);
		const waitMs = Math.max(1, Math.ceil((deficit / this._refillPerSecond) * 1000));
		this._timer = setTimeout(() => {
			this._timer = undefined;
			this._drain();
		}, waitMs);
	}

	private _flushAll(): void {
		if (this._timer !== undefined) {
			clearTimeout(this._timer);
			this._timer = undefined;
		}
		while (this._waiters.length > 0) {
			this._waiters.shift()!();
		}
	}

	override dispose(): void {
		this._disposed = true;
		this._flushAll();
		super.dispose();
	}
}

/**
 * Duck-typed check for an HTTP 429 (Too Many Requests). Uses property shape
 * rather than `instanceof MistralError` so it survives the error being wrapped
 * or re-thrown across module boundaries.
 */
export function isRateLimitError(err: unknown): boolean {
	return !!err && typeof err === 'object' && (err as { statusCode?: unknown }).statusCode === 429;
}

/**
 * Parses a `Retry-After` header (delay in seconds, or an HTTP date) off an
 * error into milliseconds. Returns `undefined` when absent or unparseable.
 */
export function retryAfterMs(err: unknown, now: number = Date.now()): number | undefined {
	const headers = (err as { headers?: { get?(name: string): string | null } } | undefined)?.headers;
	const value = headers?.get?.('retry-after');
	if (!value) {
		return undefined;
	}
	const seconds = Number(value);
	if (Number.isFinite(seconds)) {
		return Math.max(0, seconds * 1000);
	}
	const dateMs = Date.parse(value);
	return Number.isNaN(dateMs) ? undefined : Math.max(0, dateMs - now);
}
