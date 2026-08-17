/**
 * SETU Mobile — Root Application Entry Point
 * ------------------------------------------
 * Connects Context Providers, Navigation Container, and Global Status Bar.
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

import { AccessibilityProvider } from './src/context/AccessibilityContext';
import { FocusProvider } from './src/context/FocusContext';
import { IdentityProvider } from './src/context/IdentityContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { COLORS } from './src/constants/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <AccessibilityProvider>
        <FocusProvider>
          <IdentityProvider>
            <NavigationContainer
              theme={{
                dark: false,
                colors: {
                  primary: COLORS.cyan,
                  background: COLORS.bg,
                  card: COLORS.bg,
                  text: COLORS.text,
                  border: COLORS.dividerSubtle,
                  notification: COLORS.magenta,
                },
                fonts: {
                  regular: {
                    fontFamily: 'serif',
                    fontWeight: 'normal',
                  },
                  medium: {
                    fontFamily: 'serif',
                    fontWeight: '500',
                  },
                  bold: {
                    fontFamily: 'serif',
                    fontWeight: 'bold',
                  },
                  heavy: {
                    fontFamily: 'serif',
                    fontWeight: '900',
                  },
                },
              }}
            >
              <StatusBar style="dark" />
              <RootNavigator />
            </NavigationContainer>
          </IdentityProvider>
        </FocusProvider>
      </AccessibilityProvider>
    </SafeAreaProvider>
  );
}
