import { createPersistedState } from './_persisted.svelte';

export const lastChatModel = createPersistedState<string>(
  'cryptex.chat.lastModel',
  'openrouter:openrouter/auto'
);
