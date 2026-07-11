/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// past values:
// 'void.settingsServiceStorage'
// 'void.settingsServiceStorageI' // 1.0.2

// 1.0.3
export const VOID_SETTINGS_STORAGE_KEY = 'void.settingsServiceStorageII'


// past values:
// 'void.chatThreadStorage'
// 'void.chatThreadStorageI' // 1.0.2

// 1.0.3
export const THREAD_STORAGE_KEY = 'void.chatThreadStorageII'



export const OPT_OUT_KEY = 'void.app.optOutAll'

export const PROJECT_MEMORY_STORAGE_KEY = 'void.projectMemory.v1'

// set once we've attempted to auto-bootstrap project memory for a workspace, so we never retry
// (even if the run failed or the user later clears the memory on purpose)
export const PROJECT_MEMORY_BOOTSTRAP_ATTEMPTED_KEY = 'void.projectMemory.bootstrapAttempted.v1'
