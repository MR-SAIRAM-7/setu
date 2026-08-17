/**
 * SETU Mobile — Offline-First Persistent Storage Service
 * ------------------------------------------------------
 * Wraps AsyncStorage for secure local-first persistence of user preferences,
 * stable anonymous x-user-id token, researched mind maps, conversation threads,
 * and cognitive mode history.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  UserPreferences,
  MindMapDocument,
  ConversationThread,
  ChatMessage,
  FocusSessionState,
} from '../types';
import { SEED_MIND_MAPS } from './seedData';
import { syncInBackground } from './api';

const MAX_MAPS = 40;

const KEYS = {
  USER_ID: 'setu.mobile.user_id.v1',
  PREFERENCES: 'setu.mobile.preferences.v1',
  MIND_MAPS: 'setu.mobile.mind_maps.v1',
  CONVERSATIONS: 'setu.mobile.conversations.v1',
  MESSAGES_PREFIX: 'setu.mobile.messages.v1.',
  SUMMARIES: 'setu.mobile.summaries.v1',
  FOCUS_SESSION: 'setu.mobile.focus.v1',
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  profile: ['adhd', 'dyslexia'],
  font: 'serif',
  size: 'normal',
  motion: 'movement',
  bionic: false,
  readingRuler: false,
  speechRate: 1.0,
  speechPitch: 1.0,
  hasCompletedOnboarding: false,
  customApiUrl: 'http://10.0.2.2:3000', // Android Emulator localhost bridge, or custom IP
};

export const DEFAULT_FOCUS_STATE: FocusSessionState = {
  isActive: false,
  isPaused: false,
  secondsRemaining: 25 * 60,
  totalSessionsCompleted: 0,
  isBreakDialogOpen: false,
};

/* -------------------------------------------------------------------------- */
/* Device Identity & Token                                                    */
/* -------------------------------------------------------------------------- */

let cachedUserId: string | null = null;

function generateRandomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let rand = '';
  for (let i = 0; i < 16; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `u_mob_${Date.now().toString(36)}_${rand}`;
}

export async function getUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  try {
    const stored = await AsyncStorage.getItem(KEYS.USER_ID);
    if (stored) {
      cachedUserId = stored;
      return stored;
    }
  } catch (_) {}

  const newId = generateRandomId();
  cachedUserId = newId;
  try {
    await AsyncStorage.setItem(KEYS.USER_ID, newId);
  } catch (_) {}
  return newId;
}

export async function resetUserId(): Promise<string> {
  cachedUserId = null;
  const newId = generateRandomId();
  cachedUserId = newId;
  await AsyncStorage.setItem(KEYS.USER_ID, newId);
  return newId;
}

/* -------------------------------------------------------------------------- */
/* Accessibility Preferences                                                  */
/* -------------------------------------------------------------------------- */

export async function getStoredPreferences(): Promise<UserPreferences> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PREFERENCES);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch (_) {
    return DEFAULT_PREFERENCES;
  }
}

export async function saveStoredPreferences(
  prefs: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await getStoredPreferences();
  const updated = { ...current, ...prefs };
  await AsyncStorage.setItem(KEYS.PREFERENCES, JSON.stringify(updated));
  syncInBackground('POST', '/api/settings', updated);
  return updated;
}
export const savePreferences = saveStoredPreferences;

/* -------------------------------------------------------------------------- */
/* Mind Map Storage                                                           */
/* -------------------------------------------------------------------------- */

export async function getSavedMindMaps(): Promise<MindMapDocument[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.MIND_MAPS);
    if (!raw) {
      // First run: populate seed library
      await AsyncStorage.setItem(KEYS.MIND_MAPS, JSON.stringify(SEED_MIND_MAPS));
      return SEED_MIND_MAPS;
    }
    const maps: MindMapDocument[] = JSON.parse(raw);
    return maps.length > 0 ? maps : SEED_MIND_MAPS;
  } catch (_) {
    return SEED_MIND_MAPS;
  }
}

export async function saveMindMap(map: MindMapDocument): Promise<MindMapDocument[]> {
  const current = await getSavedMindMaps();
  const mapId = map.id || map._id || `map_${Date.now()}`;
  const mapWithId = {
    ...map,
    id: mapId,
    updatedAt: new Date().toISOString(),
  };

  const filtered = current.filter((m) => (m.id || m._id) !== mapId);
  const updated = [mapWithId, ...filtered].slice(0, MAX_MAPS);
  await AsyncStorage.setItem(KEYS.MIND_MAPS, JSON.stringify(updated));
  syncInBackground('POST', '/api/mindmaps', mapWithId);
  return updated;
}
export const saveMap = saveMindMap;

export async function deleteMindMap(id: string): Promise<MindMapDocument[]> {
  const current = await getSavedMindMaps();
  const updated = current.filter((m) => m.id !== id && m._id !== id);
  await AsyncStorage.setItem(KEYS.MIND_MAPS, JSON.stringify(updated));
  syncInBackground('DELETE', `/api/mindmaps/${encodeURIComponent(id)}`);
  return updated;
}
export const deleteMap = deleteMindMap;

export async function restoreReferenceLibrary(): Promise<MindMapDocument[]> {
  const current = await getSavedMindMaps();
  const userMaps = current.filter((m) => m.sourceType !== 'seed');
  
  const existingIds = new Set(current.map(m => m.id || m._id));
  const missing = SEED_MIND_MAPS.filter(m => !existingIds.has(m.id || m._id));
  
  const combined = [...userMaps, ...SEED_MIND_MAPS];
  await AsyncStorage.setItem(KEYS.MIND_MAPS, JSON.stringify(combined));
  
  for (const seed of missing) {
    syncInBackground('POST', '/api/mindmaps', seed);
  }
  return combined;
}
export const restoreSeedMaps = restoreReferenceLibrary;

export async function clearAllMaps(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.MIND_MAPS);
  syncInBackground('DELETE', '/api/mindmaps');
}
export const clearAllMindMaps = clearAllMaps;

/* -------------------------------------------------------------------------- */
/* Summary Storage                                                            */
/* -------------------------------------------------------------------------- */

export async function getSavedSummaries(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SUMMARIES);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export async function saveSummaryAndSync(summary: any): Promise<any[]> {
  const current = await getSavedSummaries();
  const updated = [summary, ...current.filter(s => s.id !== summary.id)];
  await AsyncStorage.setItem(KEYS.SUMMARIES, JSON.stringify(updated));
  syncInBackground('POST', '/api/summaries', summary);
  return updated;
}

/* -------------------------------------------------------------------------- */
/* Conversation History Storage                                               */
/* -------------------------------------------------------------------------- */

export async function getSavedConversations(): Promise<ConversationThread[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CONVERSATIONS);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export async function saveConversation(
  conv: ConversationThread
): Promise<ConversationThread[]> {
  const current = await getSavedConversations();
  const filtered = current.filter((c) => c.id !== conv.id);
  const updated = [conv, ...filtered];
  await AsyncStorage.setItem(KEYS.CONVERSATIONS, JSON.stringify(updated));
  return updated;
}

export async function getConversationMessages(
  convId: string
): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(`${KEYS.MESSAGES_PREFIX}${convId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export async function saveConversationMessage(
  convId: string,
  message: ChatMessage
): Promise<ChatMessage[]> {
  const current = await getConversationMessages(convId);
  const updated = [...current, message];
  await AsyncStorage.setItem(
    `${KEYS.MESSAGES_PREFIX}${convId}`,
    JSON.stringify(updated)
  );
  return updated;
}

/* -------------------------------------------------------------------------- */
/* Focus Session State Storage                                                */
/* -------------------------------------------------------------------------- */

export async function getFocusSession(): Promise<FocusSessionState> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.FOCUS_SESSION);
    return raw ? { ...DEFAULT_FOCUS_STATE, ...JSON.parse(raw) } : DEFAULT_FOCUS_STATE;
  } catch (_) {
    return DEFAULT_FOCUS_STATE;
  }
}

export async function saveFocusSession(
  state: Partial<FocusSessionState>
): Promise<FocusSessionState> {
  const current = await getFocusSession();
  const updated = { ...current, ...state };
  await AsyncStorage.setItem(KEYS.FOCUS_SESSION, JSON.stringify(updated));
  return updated;
}

/* -------------------------------------------------------------------------- */
/* Wipe All Data                                                              */
/* -------------------------------------------------------------------------- */

export async function clearAllLocalData(): Promise<void> {
  await AsyncStorage.clear();
  cachedUserId = null;
}
