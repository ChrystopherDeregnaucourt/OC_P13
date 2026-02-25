import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ChatState } from './chat.reducer';

/** Sélectionne la slice 'chat' du store global */
export const selectChatState = createFeatureSelector<ChatState>('chat');

// ── Connexion ────────────────────────────────────
export const selectConnected = createSelector(selectChatState, (s) => s.connected);

// ── Client ───────────────────────────────────────
export const selectSessionId = createSelector(selectChatState, (s) => s.sessionId);
export const selectAgentName = createSelector(selectChatState, (s) => s.agentName);
export const selectMessages = createSelector(selectChatState, (s) => s.messages);
export const selectStatus = createSelector(selectChatState, (s) => s.status);
export const selectQueuePosition = createSelector(selectChatState, (s) => s.queuePosition);
export const selectEstimatedWait = createSelector(selectChatState, (s) => s.estimatedWait);
export const selectIsAgentTyping = createSelector(selectChatState, (s) => s.isAgentTyping);
export const selectShowRating = createSelector(selectChatState, (s) => s.showRating);

// ── Agent ────────────────────────────────────────
export const selectAgentId = createSelector(selectChatState, (s) => s.agentId);
export const selectAgentNameSelf = createSelector(selectChatState, (s) => s.agentNameSelf);
export const selectAgentAvailable = createSelector(selectChatState, (s) => s.agentAvailable);
export const selectAgentSessions = createSelector(selectChatState, (s) => s.agentSessions);
export const selectActiveSessionId = createSelector(selectChatState, (s) => s.activeSessionId);

export const selectActiveSession = createSelector(
  selectAgentSessions,
  selectActiveSessionId,
  (sessions, activeId) => sessions.find((s) => s.sessionId === activeId) ?? null
);

export const selectActiveAgentSessions = createSelector(
  selectAgentSessions,
  (sessions) => sessions.filter((s) => s.status === 'active')
);

// ── Commun ───────────────────────────────────────
export const selectError = createSelector(selectChatState, (s) => s.error);
