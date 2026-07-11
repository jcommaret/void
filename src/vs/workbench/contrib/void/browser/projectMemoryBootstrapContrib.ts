/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { PROJECT_MEMORY_BOOTSTRAP_ATTEMPTED_KEY, PROJECT_MEMORY_STORAGE_KEY } from '../common/storageKeys.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';
import { isFeatureNameDisabled } from '../common/voidSettingsTypes.js';
import { IChatThreadService } from './chatThreadService.js';

const BOOTSTRAP_PROMPT = `This project has no saved project memory yet. Briefly explore this codebase (structure, purpose, tech stack, and any conventions worth remembering) and then call write_project_memory once with a concise initial summary to help future sessions. Don't make any other changes and don't ask any questions.`

// Automatically bootstraps project memory the first time a workspace is opened, if none exists yet.
class ProjectMemoryBootstrapContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.void.projectMemoryBootstrap'

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IWorkspaceContextService private readonly workspaceContext: IWorkspaceContextService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@IChatThreadService private readonly chatThreadService: IChatThreadService,
	) {
		super()

		this._register(this.workspaceContext.onDidChangeWorkspaceFolders(() => this._maybeBootstrap()))
		this._maybeBootstrap()
	}

	private async _maybeBootstrap() {
		if (this.workspaceContext.getWorkspace().folders.length === 0) return
		if (this.storageService.getBoolean(PROJECT_MEMORY_BOOTSTRAP_ATTEMPTED_KEY, StorageScope.WORKSPACE, false)) return
		if (this.storageService.get(PROJECT_MEMORY_STORAGE_KEY, StorageScope.WORKSPACE)) return // already has memory; never overwrite

		await this.voidSettingsService.waitForInitState

		const settingsState = this.voidSettingsService.state
		if (!settingsState.globalSettings.isOnboardingComplete) return
		if (settingsState.globalSettings.chatMode !== 'agent') return // needs tool-calling to write memory
		if (isFeatureNameDisabled('Chat', settingsState)) return // no usable model configured yet

		// re-check after the await, and mark as attempted before running so we never fire twice
		if (this.storageService.getBoolean(PROJECT_MEMORY_BOOTSTRAP_ATTEMPTED_KEY, StorageScope.WORKSPACE, false)) return
		this.storageService.store(PROJECT_MEMORY_BOOTSTRAP_ATTEMPTED_KEY, true, StorageScope.WORKSPACE, StorageTarget.MACHINE)

		const thread = this.chatThreadService.getCurrentThread()
		this.chatThreadService.addUserMessageAndStreamResponse({ userMessage: BOOTSTRAP_PROMPT, threadId: thread.id })
	}
}

registerWorkbenchContribution2(ProjectMemoryBootstrapContribution.ID, ProjectMemoryBootstrapContribution, WorkbenchPhase.AfterRestored);
