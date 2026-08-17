/**
 * SETU Mobile — Root App Navigation & Shell (Phase 13)
 * ---------------------------------------------------
 * Connects Onboarding, Bottom Tab Navigator (Home, Mind Map, Modes, Library, Settings),
 * and auxiliary modal stacks with Broadsheet newsprint design styling.
 *
 * Features:
 * - Dynamic Focus Session persistent floating bar across all tabs
 * - Floating Reading Ruler overlay
 * - Break Dialog modal prompt
 * - Full deep-linking parameter passing across stacks
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  Sparkles,
  Network,
  Waves,
  BookOpen,
  Settings,
  Pause,
  Play,
  Clock,
} from 'lucide-react-native';

import { COLORS, RADIUS, SPACING, SHADOWS } from '../constants/theme';
import { Text } from '../components/Typography';
import { useAccessibility } from '../context/AccessibilityContext';
import { useFocus } from '../context/FocusContext';

import { OnboardingScreen } from '../screens/OnboardingScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MindMapScreen } from '../screens/MindMapScreen';
import { ModesScreen } from '../screens/ModesScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { CameraOcrScreen } from '../screens/CameraOcrScreen';
import { BreakDialogModal } from '../components/BreakDialogModal';
import { ReadingRuler } from '../components/ReadingRuler';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * Floating Focus Session Indicator Banner
 * Displays across all tabs when a Pomodoro focus timer is active.
 */
function FloatingFocusBanner() {
  const { isActive, isPaused, formattedTime, pauseSession, startSession } = useFocus();

  if (!isActive) return null;

  return (
    <View style={styles.focusBannerContainer}>
      <View style={styles.focusBannerContent}>
        <View style={styles.focusBannerLeft}>
          <View style={[styles.focusDot, !isPaused ? styles.focusDotActive : styles.focusDotPaused]} />
          <Text variant="caption" weight="bold" color={COLORS.text}>
            Focus Session:
          </Text>
          <Text variant="caption" weight="bold" color={COLORS.cyan} style={{ marginLeft: 6 }}>
            {formattedTime}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.focusActionBtn}
          onPress={isPaused ? startSession : pauseSession}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={isPaused ? 'Resume focus timer' : 'Pause focus timer'}
        >
          {isPaused ? (
            <Play size={14} color={COLORS.cyan} />
          ) : (
            <Pause size={14} color={COLORS.magenta} />
          )}
          <Text
            variant="caption"
            weight="bold"
            color={isPaused ? COLORS.cyan : COLORS.magenta}
            style={{ marginLeft: 4 }}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MainTabNavigator() {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: COLORS.bg,
            borderTopWidth: 1,
            borderTopColor: COLORS.dividerSubtle,
            height: 60,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarActiveTintColor: COLORS.cyan,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeScreen}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color, size }) => <Sparkles size={size - 2} color={color} />,
          }}
        />
        <Tab.Screen
          name="MindMapTab"
          component={MindMapScreen}
          options={{
            tabBarLabel: 'Mind Map',
            tabBarIcon: ({ color, size }) => <Network size={size - 2} color={color} />,
          }}
        />
        <Tab.Screen
          name="ModesTab"
          component={ModesScreen}
          options={{
            tabBarLabel: 'Modes',
            tabBarIcon: ({ color, size }) => <Waves size={size - 2} color={color} />,
          }}
        />
        <Tab.Screen
          name="LibraryTab"
          component={LibraryScreen}
          options={{
            tabBarLabel: 'Library',
            tabBarIcon: ({ color, size }) => <BookOpen size={size - 2} color={color} />,
          }}
        />
        <Tab.Screen
          name="SettingsTab"
          component={SettingsScreen}
          options={{
            tabBarLabel: 'Settings',
            tabBarIcon: ({ color, size }) => <Settings size={size - 2} color={color} />,
          }}
        />
      </Tab.Navigator>

      {/* Floating Active Focus Session Banner */}
      <FloatingFocusBanner />
    </View>
  );
}

export const RootNavigator: React.FC = () => {
  const { hasCompletedOnboarding, isLoading } = useAccessibility();

  if (isLoading) {
    return null;
  }

  return (
    <>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.bg },
        }}
      >
        {!hasCompletedOnboarding ? (
          <Stack.Screen name="Onboarding">
            {(props) => (
              <OnboardingScreen
                {...props}
                onComplete={() => props.navigation.replace('MainTabs')}
              />
            )}
          </Stack.Screen>
        ) : null}

        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        <Stack.Screen
          name="CameraOCR"
          component={CameraOcrScreen}
          options={{
            headerShown: true,
            title: 'Scan Document OCR',
            headerStyle: { backgroundColor: COLORS.bg },
            headerTintColor: COLORS.text,
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
      </Stack.Navigator>

      {/* Global Break Dialog Modal */}
      <BreakDialogModal />

      {/* Global Reading Ruler Overlay (if enabled in settings) */}
      <ReadingRuler />
    </>
  );
};

const styles = StyleSheet.create({
  focusBannerContainer: {
    position: 'absolute',
    bottom: 64,
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 99,
  },
  focusBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: COLORS.cyanBorder,
    ...SHADOWS.md,
  },
  focusBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  focusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  focusDotActive: {
    backgroundColor: COLORS.cyan,
  },
  focusDotPaused: {
    backgroundColor: COLORS.yellow,
  },
  focusActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.dividerSubtle,
  },
});
