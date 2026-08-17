/**
 * SETU Mobile — Focus Session Context (ADHD Pomodoro Timer)
 * ---------------------------------------------------------
 * Manages the 25-minute cognitive focus timer with calm start, pause, reset,
 * and warm break dialogs designed to alleviate executive fatigue without guilt.
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { FocusSessionState } from '../types';
import { getFocusSession, saveFocusSession, DEFAULT_FOCUS_STATE } from '../services/storage';

interface FocusContextValue {
  isActive: boolean;
  isPaused: boolean;
  secondsRemaining: number;
  formattedTime: string;
  totalSessionsCompleted: number;
  isBreakDialogOpen: boolean;
  startSession: () => void;
  pauseSession: () => void;
  resetSession: () => void;
  dismissBreakDialog: (takeBreak?: boolean) => void;
}

const FocusContext = createContext<FocusContextValue | null>(null);

export const FocusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<FocusSessionState>(DEFAULT_FOCUS_STATE);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    async function load() {
      const stored = await getFocusSession();
      setSession(stored);
    }
    load();
  }, []);

  useEffect(() => {
    if (session.isActive && !session.isPaused && session.secondsRemaining > 0) {
      timerRef.current = setInterval(() => {
        setSession((prev) => {
          if (prev.secondsRemaining <= 1) {
            // Timer expired — trigger break dialog
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (_) {}
            const completed = {
              ...prev,
              isActive: false,
              isPaused: false,
              secondsRemaining: 25 * 60,
              totalSessionsCompleted: prev.totalSessionsCompleted + 1,
              isBreakDialogOpen: true,
            };
            saveFocusSession(completed);
            return completed;
          }
          const next = {
            ...prev,
            secondsRemaining: prev.secondsRemaining - 1,
          };
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [session.isActive, session.isPaused]);

  const startSession = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}
    setSession((prev) => {
      const next = { ...prev, isActive: true, isPaused: false };
      saveFocusSession(next);
      return next;
    });
  };

  const pauseSession = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    setSession((prev) => {
      const next = { ...prev, isPaused: true };
      saveFocusSession(next);
      return next;
    });
  };

  const resetSession = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    setSession((prev) => {
      const next = {
        ...prev,
        isActive: false,
        isPaused: false,
        secondsRemaining: 25 * 60,
        isBreakDialogOpen: false,
      };
      saveFocusSession(next);
      return next;
    });
  };

  const dismissBreakDialog = (_takeBreak = false) => {
    setSession((prev) => {
      const next = {
        ...prev,
        isActive: false,
        isPaused: false,
        secondsRemaining: 25 * 60,
        isBreakDialogOpen: false,
      };
      saveFocusSession(next);
      return next;
    });
  };

  const minutes = Math.floor(session.secondsRemaining / 60);
  const seconds = session.secondsRemaining % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;

  return (
    <FocusContext.Provider
      value={{
        isActive: session.isActive,
        isPaused: session.isPaused,
        secondsRemaining: session.secondsRemaining,
        formattedTime,
        totalSessionsCompleted: session.totalSessionsCompleted,
        isBreakDialogOpen: session.isBreakDialogOpen,
        startSession,
        pauseSession,
        resetSession,
        dismissBreakDialog,
      }}
    >
      {children}
    </FocusContext.Provider>
  );
};

export function useFocus(): FocusContextValue {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error('useFocus must be used within a FocusProvider');
  }
  return context;
}
