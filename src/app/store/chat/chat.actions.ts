import { createAction, props } from '@ngrx/store';
import { ChatMessage, QueueInfo, StartChatPayload, AgentLoginPayload } from '../../core/models';

// =====================================================
// ACTIONS CLIENT
// =====================================================

export const connectSocket = createAction('[Chat] Connect Socket');
export const socketConnected = createAction('[Chat] Socket Connected');
export const socketDisconnected = createAction('[Chat] Socket Disconnected');

export const startChat = createAction(
  '[Chat/Client] Start Chat',
  props<{ payload: StartChatPayload }>()
);

export const chatStarted = createAction(
  '[Chat/Client] Chat Started',
  props<{ sessionId: string; agentName: string; messages: ChatMessage[] }>()
);

export const chatQueued = createAction(
  '[Chat/Client] Chat Queued',
  props<{ sessionId: string; position: number; estimatedWait: number; messages: ChatMessage[] }>()
);

export const chatAssigned = createAction(
  '[Chat/Client] Chat Assigned',
  props<{ sessionId: string; agentName: string }>()
);

export const sendClientMessage = createAction(
  '[Chat/Client] Send Message',
  props<{ sessionId: string; content: string }>()
);

export const sendClientTyping = createAction(
  '[Chat/Client] Send Typing',
  props<{ sessionId: string; isTyping: boolean }>()
);

export const endClientChat = createAction(
  '[Chat/Client] End Chat',
  props<{ sessionId: string; rating: number; feedback: string }>()
);

// =====================================================
// ACTIONS AGENT
// =====================================================

export const agentLogin = createAction(
  '[Chat/Agent] Login',
  props<{ payload: AgentLoginPayload }>()
);

export const agentLoggedIn = createAction(
  '[Chat/Agent] Logged In',
  props<{ agentId: string; name: string }>()
);

export const newSessionAssigned = createAction(
  '[Chat/Agent] New Session Assigned',
  props<{ sessionId: string; clientName: string; subject?: string; messages: ChatMessage[] }>()
);

export const sendAgentMessage = createAction(
  '[Chat/Agent] Send Message',
  props<{ sessionId: string; content: string }>()
);

export const sendAgentTyping = createAction(
  '[Chat/Agent] Send Typing',
  props<{ sessionId: string; isTyping: boolean }>()
);

export const setAgentAvailability = createAction(
  '[Chat/Agent] Set Availability',
  props<{ available: boolean }>()
);

export const agentAvailabilityChanged = createAction(
  '[Chat/Agent] Availability Changed',
  props<{ available: boolean }>()
);

export const agentEndChat = createAction(
  '[Chat/Agent] End Chat',
  props<{ sessionId: string }>()
);

export const clientDisconnected = createAction(
  '[Chat/Agent] Client Disconnected',
  props<{ sessionId: string }>()
);

export const agentDisconnected = createAction(
  '[Chat/Client] Agent Disconnected',
  props<{ sessionId: string }>()
);

// =====================================================
// ACTIONS COMMUNES
// =====================================================

export const messageReceived = createAction(
  '[Chat] Message Received',
  props<{ message: ChatMessage }>()
);

export const typingIndicator = createAction(
  '[Chat] Typing Indicator',
  props<{ sessionId: string; isTyping: boolean; from: string }>()
);

export const chatEnded = createAction(
  '[Chat] Chat Ended',
  props<{ sessionId: string; transcript?: ChatMessage[]; rating?: number; feedback?: string }>()
);

export const ratingRequested = createAction(
  '[Chat] Rating Requested',
  props<{ sessionId: string }>()
);

export const queuePositionUpdated = createAction(
  '[Chat] Queue Position Updated',
  props<{ position: number; estimatedWait: number }>()
);

export const chatError = createAction(
  '[Chat] Error',
  props<{ message: string }>()
);

export const clearError = createAction('[Chat] Clear Error');

export const selectAgentSession = createAction(
  '[Chat/Agent] Select Session',
  props<{ activeSessionId: string }>()
);
