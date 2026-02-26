import { createReducer, on } from '@ngrx/store';
import { ChatMessage } from '../../core/models';
import * as ChatActions from './chat.actions';
import { selectAgentSession } from './chat.actions';

/**
 * Interface représentant une session active côté agent.
 * Un agent peut gérer plusieurs sessions simultanément.
 */
export interface AgentSession {
  sessionId: string;
  clientName: string;
  subject?: string;
  messages: ChatMessage[];
  isClientTyping: boolean;
  status: 'active' | 'ended';
}

/**
 * État global du store Chat.
 * Gère à la fois l'état client et l'état agent.
 */
export interface ChatState {
  // Connexion
  connected: boolean;

  // État client
  sessionId: string | null;
  agentName: string | null;
  messages: ChatMessage[];
  status: 'idle' | 'waiting' | 'active' | 'ended';
  queuePosition: number | null;
  estimatedWait: number | null;
  isAgentTyping: boolean;
  showRating: boolean;

  // État agent
  agentId: string | null;
  agentNameSelf: string | null;
  agentAvailable: boolean;
  agentSessions: AgentSession[];
  activeSessionId: string | null;

  // Commun
  error: string | null;
}

export const initialState: ChatState = {
  connected: false,
  sessionId: null,
  agentName: null,
  messages: [],
  status: 'idle',
  queuePosition: null,
  estimatedWait: null,
  isAgentTyping: false,
  showRating: false,
  agentId: null,
  agentNameSelf: null,
  agentAvailable: false,
  agentSessions: [],
  activeSessionId: null,
  error: null
};

export const chatReducer = createReducer(
  initialState,

  // ── Connexion ──────────────────────────────────────
  on(ChatActions.socketConnected, (state) => ({
    ...state,
    connected: true
  })),

  on(ChatActions.socketDisconnected, (state) => ({
    ...state,
    connected: false
  })),

  // ── Client : démarrage ─────────────────────────────
  on(ChatActions.chatStarted, (state, { sessionId, agentName, messages }) => ({
    ...state,
    sessionId,
    agentName,
    messages,
    status: 'active' as const
  })),

  on(ChatActions.chatQueued, (state, { sessionId, position, estimatedWait, messages }) => ({
    ...state,
    sessionId,
    messages,
    status: 'waiting' as const,
    queuePosition: position,
    estimatedWait
  })),

  on(ChatActions.chatAssigned, (state, { sessionId, agentName }) => ({
    ...state,
    sessionId,
    agentName,
    status: 'active' as const,
    queuePosition: null,
    estimatedWait: null
  })),

  on(ChatActions.queuePositionUpdated, (state, { position, estimatedWait }) => ({
    ...state,
    queuePosition: position,
    estimatedWait
  })),

  // ── Messages ───────────────────────────────────────
  on(ChatActions.messageReceived, (state, { message }) => {
    // Dédupliquer (le serveur renvoie le message au sender aussi)
    const exists = state.messages.some((m) => m.id === message.id);
    if (exists) {
      return state;
    }

    // Mise à jour côté client
    const newClientMessages = [...state.messages, message];

    // Mise à jour côté agent si la session correspond
    const agentSessions = state.agentSessions.map((s) => {
      if (s.sessionId === message.sessionId) {
        const msgExists = s.messages.some((m) => m.id === message.id);
        if (msgExists) return s;
        return {
          ...s,
          messages: [...s.messages, message],
          isClientTyping: false
        };
      }
      return s;
    });

    return {
      ...state,
      messages: newClientMessages,
      isAgentTyping: false,
      agentSessions
    };
  }),

  // ── Typing ─────────────────────────────────────────
  on(ChatActions.typingIndicator, (state, { sessionId, isTyping, from }) => {
    if (from === 'agent') {
      return { ...state, isAgentTyping: isTyping };
    }

    // Typing du client côté agent
    const agentSessions = state.agentSessions.map((s) =>
      s.sessionId === sessionId
        ? { ...s, isClientTyping: isTyping }
        : s
    );
    return { ...state, agentSessions };
  }),

  // ── Fin de chat ────────────────────────────────────
  on(ChatActions.chatEnded, (state, { sessionId }) => {
    // Côté client
    if (state.sessionId === sessionId) {
      return {
        ...state,
        status: 'ended' as const,
        isAgentTyping: false
      };
    }

    // Côté agent
    const agentSessions = state.agentSessions.map((s) =>
      s.sessionId === sessionId ? { ...s, status: 'ended' as const } : s
    );
    return { ...state, agentSessions };
  }),

  on(ChatActions.ratingRequested, (state) => ({
    ...state,
    showRating: true
  })),

  // ── Agent : connexion ──────────────────────────────
  on(ChatActions.agentLoggedIn, (state, { agentId, name }) => ({
    ...state,
    agentId,
    agentNameSelf: name,
    agentAvailable: true
  })),

  on(ChatActions.agentAvailabilityChanged, (state, { available }) => ({
    ...state,
    agentAvailable: available
  })),

  // ── Agent : sessions ───────────────────────────────
  on(ChatActions.newSessionAssigned, (state, { sessionId, clientName, subject, messages }) => ({
    ...state,
    agentSessions: [
      ...state.agentSessions,
      {
        sessionId,
        clientName,
        subject,
        messages,
        isClientTyping: false,
        status: 'active' as const
      }
    ],
    activeSessionId: state.activeSessionId ?? sessionId
  })),

  on(ChatActions.agentDisconnected, (state, { sessionId }) => {
    if (state.sessionId === sessionId) {
      return {
        ...state,
        status: 'waiting' as const,
        agentName: null,
        isAgentTyping: false
      };
    }
    return state;
  }),

  on(ChatActions.clientDisconnected, (state, { sessionId }) => ({
    ...state,
    agentSessions: state.agentSessions.map((s) =>
      s.sessionId === sessionId ? { ...s, status: 'ended' as const } : s
    )
  })),

  // ── Erreurs ────────────────────────────────────────
  on(ChatActions.chatError, (state, { message }) => ({
    ...state,
    error: message
  })),

  on(ChatActions.clearError, (state) => ({
    ...state,
    error: null
  })),

  // Sélection d'une session par l'agent
  on(selectAgentSession, (state, { activeSessionId }) => ({
    ...state,
    activeSessionId
  }))
);
