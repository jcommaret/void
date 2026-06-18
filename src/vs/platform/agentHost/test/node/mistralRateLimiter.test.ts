/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { isRateLimitError, retryAfterMs, TokenBucketRateLimiter } from '../../node/mistral/mistralRateLimiter.js';

/** Flush a few microtask turns, then report whether `p` has resolved. */
async function resolvedSynchronously(p: Promise<void>): Promise<boolean> {
	let resolved = false;
	p.then(() => { resolved = true; });
	for (let i = 0; i < 3; i++) { await Promise.resolve(); }
	return resolved;
}

suite('Mistral - TokenBucketRateLimiter', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('rate 0 disables throttling: every acquire resolves at once', async () => {
		const limiter = new TokenBucketRateLimiter(0);
		for (let i = 0; i < 20; i++) {
			assert.strictEqual(await resolvedSynchronously(limiter.acquire()), true);
		}
		limiter.dispose();
	});

	test('allows a burst up to capacity, then parks the next request', async () => {
		let clock = 1_000;
		const limiter = new TokenBucketRateLimiter(4, () => clock); // capacity 4
		for (let i = 0; i < 4; i++) {
			assert.strictEqual(await resolvedSynchronously(limiter.acquire()), true, `burst token ${i}`);
		}
		// Bucket empty (clock frozen) → the 5th request must park.
		assert.strictEqual(await resolvedSynchronously(limiter.acquire()), false);
		limiter.dispose();
	});

	test('refills proportionally to elapsed time', async () => {
		let clock = 1_000;
		const limiter = new TokenBucketRateLimiter(10, () => clock); // capacity 10
		// Drain the full bucket. Do not park a waiter here: a queued waiter would
		// make every later acquire fall in behind it regardless of refill.
		for (let i = 0; i < 10; i++) {
			assert.strictEqual(await resolvedSynchronously(limiter.acquire()), true);
		}
		// Advance 500ms → 5 tokens refill (10/s). Acquire itself triggers refill.
		clock += 500;
		for (let i = 0; i < 5; i++) {
			assert.strictEqual(await resolvedSynchronously(limiter.acquire()), true, `refilled token ${i}`);
		}
		assert.strictEqual(await resolvedSynchronously(limiter.acquire()), false);
		limiter.dispose();
	});

	test('a parked request resolves once a token becomes available (real timer)', async () => {
		const limiter = new TokenBucketRateLimiter(100); // capacity 100, ~10ms/token
		for (let i = 0; i < 100; i++) { await limiter.acquire(); }
		// The next acquire parks; the internal timer must release it shortly.
		await limiter.acquire();
		limiter.dispose();
	});

	test('setRate(0) releases parked waiters', async () => {
		let clock = 1_000;
		const limiter = new TokenBucketRateLimiter(3, () => clock); // capacity 3
		for (let i = 0; i < 3; i++) { await limiter.acquire(); }
		const parked = limiter.acquire();
		assert.strictEqual(await resolvedSynchronously(parked), false);
		limiter.setRate(0); // disabling must flush the queue
		await parked; // resolves, otherwise this test times out
		assert.strictEqual(limiter.rate, 0);
		limiter.dispose();
	});

	test('setRate updates the effective rate', () => {
		const limiter = new TokenBucketRateLimiter(2);
		assert.strictEqual(limiter.rate, 2);
		limiter.setRate(7);
		assert.strictEqual(limiter.rate, 7);
		limiter.setRate(-5); // negative clamps to disabled
		assert.strictEqual(limiter.rate, 0);
		limiter.dispose();
	});
});

suite('Mistral - rate limit error helpers', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('isRateLimitError detects 429 by shape', () => {
		assert.strictEqual(isRateLimitError({ statusCode: 429 }), true);
		assert.strictEqual(isRateLimitError({ statusCode: 500 }), false);
		assert.strictEqual(isRateLimitError(new Error('429')), false);
		assert.strictEqual(isRateLimitError(undefined), false);
		assert.strictEqual(isRateLimitError(null), false);
		assert.strictEqual(isRateLimitError('429'), false);
	});

	function errWithRetryAfter(value: string | null): unknown {
		return { statusCode: 429, headers: { get: (name: string) => name === 'retry-after' ? value : null } };
	}

	test('retryAfterMs parses a delay in seconds', () => {
		assert.strictEqual(retryAfterMs(errWithRetryAfter('2')), 2000);
		assert.strictEqual(retryAfterMs(errWithRetryAfter('0')), 0);
	});

	test('retryAfterMs parses an HTTP date relative to now', () => {
		const now = 1_000_000;
		const future = new Date(now + 4000).toUTCString(); // whole-second precision
		assert.strictEqual(retryAfterMs(errWithRetryAfter(future), now), 4000);
	});

	test('retryAfterMs returns undefined when absent or unparseable', () => {
		assert.strictEqual(retryAfterMs(errWithRetryAfter(null)), undefined);
		assert.strictEqual(retryAfterMs(errWithRetryAfter('not-a-date')), undefined);
		assert.strictEqual(retryAfterMs({ statusCode: 429 }), undefined);
		assert.strictEqual(retryAfterMs(undefined), undefined);
	});
});
