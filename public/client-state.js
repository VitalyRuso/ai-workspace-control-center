export const PENDING_AUTH_DRAFT = "control-center:pending-auth-draft";
const OAUTH_CONTEXT = "control-center:oauth-context";

export function draftKey(chatId) {
  return `control-center:draft:${chatId && chatId !== "new" ? chatId : "new"}`;
}

export function readDraft(storage, chatId) {
  return storage.getItem(chatId == null ? PENDING_AUTH_DRAFT : draftKey(chatId)) || "";
}

export function writeDraft(storage, chatId, value) {
  storage.setItem(chatId == null ? PENDING_AUTH_DRAFT : draftKey(chatId), String(value || ""));
}

export function saveBeforeOAuth(storage, { draft, selectedChatId = null, intendedAction = "github-login", route = "/", state = "logged-out" }) {
  writeDraft(storage, null, draft);
  if (selectedChatId) writeDraft(storage, selectedChatId, draft);
  storage.setItem(OAUTH_CONTEXT, JSON.stringify({ selectedChatId, intendedAction, route, state }));
}

export function restoreAfterOAuth(storage, availableChatIds = []) {
  let context = {};
  try { context = JSON.parse(storage.getItem(OAUTH_CONTEXT) || "{}"); } catch {}
  const selectedChatId = availableChatIds.includes(context.selectedChatId) ? context.selectedChatId : "new";
  const draft = readDraft(storage, null);
  if (draft) writeDraft(storage, selectedChatId, draft);
  storage.removeItem(PENDING_AUTH_DRAFT); storage.removeItem(OAUTH_CONTEXT);
  return { draft, selectedChatId, restored: Boolean(draft) };
}

export function idempotencyKey(storage, chatId, create = () => crypto.randomUUID()) {
  const key = `control-center:idempotency:${chatId && chatId !== "new" ? chatId : "new"}`;
  let value = storage.getItem(key);
  if (!value) { value = create(); storage.setItem(key, value); }
  return value;
}

export function clearAcceptedDraft(storage, fromChatId, toChatId, status) {
  if (status !== 202) return false;
  storage.removeItem(draftKey(fromChatId)); storage.removeItem(draftKey(toChatId));
  storage.removeItem(`control-center:idempotency:${fromChatId && fromChatId !== "new" ? fromChatId : "new"}`);
  return true;
}

export function startLocalConversation() {
  return { id: "new", title: "New conversation", messages: [], local: true };
}

export function applyAcceptedResponse(state, payload) {
  const existing = state.chats.find((chat) => chat.id === payload.chat.id);
  state.chats = existing ? state.chats.map((chat) => chat.id === payload.chat.id ? { ...chat, ...payload.chat } : chat) : [payload.chat, ...state.chats];
  state.chat = { ...payload.chat, messages: [], local: false };
  return state.chat;
}
