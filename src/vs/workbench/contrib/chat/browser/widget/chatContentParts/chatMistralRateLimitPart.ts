/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../../../base/browser/dom.js';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { Disposable, IDisposable } from '../../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../../base/common/themables.js';
import { localize } from '../../../../../../nls.js';
import { ICommandService } from '../../../../../../platform/commands/common/commands.js';
import { IChatMistralRateLimitPart } from '../../../common/chatService/chatService.js';
import { IChatRendererContent } from '../../../common/model/chatViewModel.js';
import { IChatContentPart } from './chatContentParts.js';
import './media/chatMistralRateLimit.css';

export class ChatMistralRateLimitPart extends Disposable implements IChatContentPart {
	public readonly domNode: HTMLElement;

	constructor(
		private readonly content: IChatMistralRateLimitPart,
		@ICommandService private readonly _commandService: ICommandService,
	) {
		super();

		this.domNode = dom.$('.chat-mistral-rate-limit');

		const icon = dom.append(this.domNode, dom.$('.chat-mistral-rate-limit-icon'));
		icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.warning));

		const msg = dom.append(this.domNode, dom.$('.chat-mistral-rate-limit-message'));

		const timerSpan = dom.append(msg, dom.$('.chat-mistral-rate-limit-timer'));

		const retryBtn = dom.append(this.domNode, dom.$('button.chat-mistral-rate-limit-retry')) as HTMLButtonElement;
		const refreshIcon = dom.append(retryBtn, dom.$('span'));
		refreshIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.refresh));
		dom.append(retryBtn, dom.$(
			'span',
			undefined,
			localize('mistralRateLimit.retry', 'Retry')
		));

		const update = () => {
			const remaining = Math.max(0, Math.ceil((content.resetAt - Date.now()) / 1000));
			if (remaining > 0) {
				msg.textContent = '';
				msg.appendChild(timerSpan);
				timerSpan.textContent = localize('mistralRateLimit.waiting', 'Mistral token limit — retry in {0}s', remaining);
				retryBtn.disabled = true;
			} else {
				timerSpan.textContent = localize('mistralRateLimit.ready', 'Mistral token limit — window reset, ready to retry.');
				retryBtn.disabled = false;
			}
		};

		update();

		const interval = setInterval(update, 1000);
		this._register({ dispose: () => clearInterval(interval) });

		this._register(dom.addDisposableListener(retryBtn, dom.EventType.CLICK, () => {
			this._commandService.executeCommand('void.chat.retryRateLimited');
		}));
	}

	hasSameContent(other: IChatRendererContent): boolean {
		return other.kind === 'mistralRateLimit' && other.resetAt === this.content.resetAt;
	}

	addDisposable(disposable: IDisposable): void {
		this._register(disposable);
	}
}
