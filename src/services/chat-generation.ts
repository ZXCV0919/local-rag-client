/** 当前会话的 AbortController（由 ChatInterface 在发送时设置；离开路由不再自动中止）。 */

let attached: AbortController | null = null;

export function setChatAbortController(next: AbortController | null): void {
  attached = next;
}

export function getChatAbortController(): AbortController | null {
  return attached;
}

export function abortChatGeneration(): void {
  attached?.abort();
  attached = null;
}

export function clearChatAbortIf(controller: AbortController): void {
  if (attached === controller) attached = null;
}
