/**
 * SETU Mobile — application entry point.
 *
 * Provider order is deliberate: accessibility preferences load first because
 * every layer above them reads from that state, the theme derives from it, and
 * the navigation container needs a resolved palette before it paints anything.
 * The shell sits inside the theme (its panels are themed) but outside the
 * navigator (its panels have to outlive any screen). The error boundary wraps
 * the lot so a failure anywhere inside still leaves the user a readable screen
 * with a way out.
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

import { AccessibilityProvider } from './src/context/AccessibilityContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { FocusProvider } from './src/context/FocusContext';
import { IdentityProvider } from './src/context/IdentityContext';
import { ShellProvider } from './src/context/ShellContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { ErrorBoundary } from './src/components/ErrorBoundary';

/**
 * The navigation shell.
 *
 * Split out so it can read the live palette — the navigation theme and the
 * status bar both have to flip when someone switches to a dark ground, and a
 * component that sits above ThemeProvider cannot see it.
 */
function Shell() {
  const { colors, isDark } = useTheme();

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        dark: isDark,
        colors: {
          primary: colors.cyan,
          background: colors.bg,
          card: colors.bg,
          text: colors.text,
          border: colors.dividerSubtle,
          notification: colors.magenta,
        },
        fonts: {
          regular: { fontFamily: 'serif', fontWeight: 'normal' },
          medium: { fontFamily: 'serif', fontWeight: '500' },
          bold: { fontFamily: 'serif', fontWeight: 'bold' },
          heavy: { fontFamily: 'serif', fontWeight: '900' },
        },
      }}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AccessibilityProvider>
            <ThemeProvider>
              <FocusProvider>
                <IdentityProvider>
                  <ShellProvider>
                    <Shell />
                  </ShellProvider>
                </IdentityProvider>
              </FocusProvider>
            </ThemeProvider>
          </AccessibilityProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
