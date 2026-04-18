import type { MessageRow } from '$lib/chat/types';

export interface ShareGPTMessage {
  from: 'human' | 'gpt' | 'system';
  value: string;
}

export interface ShareGPTConversation {
  conversations: ShareGPTMessage[];
}

/**
 * Convert an array of MessageRows into ShareGPT conversation format.
 * Rows are grouped by chatId; within each chat they are ordered by createdAt.
 * System messages from systemPromptSnapshot on the first assistant message are prepended.
 */
export function toShareGPT(rows: MessageRow[]): ShareGPTConversation[] {
  // Group by chatId preserving insertion-sorted order
  const byChat = new Map<string, MessageRow[]>();
  for (const row of rows) {
    const bucket = byChat.get(row.chatId) ?? [];
    bucket.push(row);
    byChat.set(row.chatId, bucket);
  }

  const result: ShareGPTConversation[] = [];

  for (const [, msgs] of byChat) {
    // Sort ascending by createdAt within the chat
    msgs.sort((a, b) => a.createdAt - b.createdAt);

    const conversations: ShareGPTMessage[] = [];

    // Emit system prompt if any assistant message has one
    const sysMsg = msgs.find((m) => m.role === 'assistant' && m.systemPromptSnapshot);
    if (sysMsg?.systemPromptSnapshot) {
      conversations.push({ from: 'system', value: sysMsg.systemPromptSnapshot });
    }

    for (const m of msgs) {
      if (m.role === 'user') {
        conversations.push({ from: 'human', value: m.content });
      } else if (m.role === 'assistant') {
        conversations.push({ from: 'gpt', value: m.content });
      }
      // 'system' and 'tool' roles are not mapped to ShareGPT turns
    }

    if (conversations.length > 0) {
      result.push({ conversations });
    }
  }

  return result;
}

/**
 * Serialise ShareGPT conversations to JSONL (one JSON object per line).
 */
export function shareGPTToJsonl(rows: MessageRow[]): string {
  const conversations = toShareGPT(rows);
  return conversations.map((c) => JSON.stringify(c)).join('\n');
}
