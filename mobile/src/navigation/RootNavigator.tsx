/**
 * SETU Mobile — app shell and navigation.
 *
 * Six tabs rather than five. Listen earns a permanent slot instead of living
 * behind Home, because the moment somebody needs it is the moment they have the
 * least patience for hunting through a menu — and Settings earns one because for
 * an accessibility app the typeface, size and theme controls are not a
 * "configure once" screen, they are part of using the thing.
 *
 * Everything that must survive a tab change — the focus banner, the reading
 * ruler, the parking lot, reward toasts and the colour film — is mounted above
 * the navigator rather than inside a screen.
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
  Heart,
  Pause,
  Play,
} from 'lucide-react-native';

import { RADIUS, SPACING, SHADOWS } from '../constants/theme';
import { Palette } from '../constants/themes';
import { useThemeColors, useThemedStyles } from '../context/ThemeContext';
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
import { ListenScreen } from '../screens/ListenScreen';
import { MomentumScreen } from '../screens/MomentumScreen';

import { BreakDialogModal } from '../components/BreakDialogModal';
import { ReadingRuler } from '../components/ReadingRuler';
import { ParkingLot } from '../components/ParkingLot';
import { RewardToast } from '../components/RewardToast';
import { ColorOverlay } from '../components/ColorOverlay';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * Floating focus indicator.
 *
 * Shown across every tab while a session runs, because the timer's whole job is
 * to be glanceable — a countdown you have to navigate to is a countdown you
 * forget about.
 */
function FloatingFocusBanner() {
  const COLORS = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { isActive, isPaused, isBreak, formattedTime, pauseSession, startSession } = useFocus();

  if (!isActive) return null;

  return (
    <View style={styles.focusBannerContainer} pointerEvents="box-none">
      <View style={styles.focusBannerContent}>
        <View style={styles.focusBannerLeft}>
          <View
            style={[styles.focusDot, !isPaused ? styles.focusDotActive : styles.focusDotPaused]}
          />
          <Text variant="caption" weight="bold">
            {isBreak ? 'Break:' : 'Focus:'}
          </Text>
          <Text variant="caption" weight="bold" color={COLORS.cyan} style={{ marginLeft: 6 }}>
            {formattedTime}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.focusActionBtn}
          onPress={isPaused ? startSession : pauseSession}
          accessibilityRole="button"
          accessibilityLabel={isPaused ? 'Resume the timer' : 'Pause the timer'}
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
  const COLORS = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { sizeScale } = useAccessibility();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: COLORS.bg,
            borderTopWidth: 1,
            borderTopColor: COLORS.dividerSubtle,
            // Grows with the reading-size setting: six labels at a fixed height
            // is exactly where a large-text user loses the bottom row.
            height: 60 + (sizeScale - 1) * 46,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarActiveTintColor: COLORS.cyan,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarLabelStyle: {
            fontSize: Math.round(10 * sizeScale),
            fontWeight: '600',
          },
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeScreen}
          options={{
            tabBarLabel: 'Home',
            tabBarAccessibilityLabel: 'Home',
            tabBarIcon: ({ color, size }) => <Sparkles size={size - 4} color={color} />,
          }}
        />
        <Tab.Screen
          name="MindMapTab"
          component={MindMapScreen}
          options={{
            tabBarLabel: 'Map',
            tabBarAccessibilityLabel: 'Mind map',
            tabBarIcon: ({ color, size }) => <Network size={size - 4} color={color} />,
          }}
        />
        <Tab.Screen
          name="ModesTab"
          component={ModesScreen}
          options={{
            tabBarLabel: 'Modes',
            tabBarAccessibilityLabel: 'Cognitive modes',
            tabBarIcon: ({ color, size }) => <Waves size={size - 4} color={color} />,
          }}
        />
        <Tab.Screen
          name="ListenTab"
          component={ListenScreen}
          options={{
            tabBarLabel: 'Listen',
            tabBarAccessibilityLabel: 'Listen — somewhere to put it',
            tabBarIcon: ({ color, size }) => <Heart size={size - 4} color={color} />,
          }}
        />
        <Tab.Screen
          name="LibraryTab"
          component={LibraryScreen}
          options={{
            tabBarLabel: 'Library',
            tabBarAccessibilityLabel: 'Library',
            tabBarIcon: ({ color, size }) => <BookOpen size={size - 4} color={color} />,
          }}
        />
        <Tab.Screen
          name="SettingsTab"
          component={SettingsScreen}
          options={{
            tabBarLabel: 'Settings',
            tabBarAccessibilityLabel: 'Reading and voice settings',
            tabBarIcon: ({ color, size }) => <Settings size={size - 4} color={color} />,
          }}
        />
      </Tab.Navigator>

      <FloatingFocusBanner />
      <ParkingLot />
    </View>
  );
}

export const RootNavigator: React.FC = () => {
  const COLORS = useThemeColors();
  const { hasCompletedOnboarding, isLoading } = useAccessibility();

  if (isLoading) return null;

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
            title: 'Scan a document',
            headerStyle: { backgroundColor: COLORS.bg },
            headerTintColor: COLORS.text,
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />

        <Stack.Screen
          name="Momentum"
          component={MomentumScreen}
          options={{
            headerShown: true,
            title: 'Momentum',
            headerStyle: { backgroundColor: COLORS.bg },
            headerTintColor: COLORS.text,
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
      </Stack.Navigator>

      <BreakDialogModal />
      <ReadingRuler />
      <RewardToast />
      <ColorOverlay />
    </>
  );
};

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    focusBannerContainer: {
      position: 'absolute',
      bottom: 70,
      left: SPACING.md,
      right: SPACING.md + 56,
      zIndex: 99,
    },
    focusBannerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: t.surface,
      paddingHorizontal: SPACING.md,
      paddingVertical: 8,
      borderRadius: RADIUS.pill,
      borderWidth: 1.5,
      borderColor: t.cyanBorder,
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
      backgroundColor: t.cyan,
    },
    focusDotPaused: {
      backgroundColor: t.yellow,
    },
    focusActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
      borderRadius: RADIUS.pill,
      backgroundColor: t.bg,
      borderWidth: 1,
      borderColor: t.dividerSubtle,
      minHeight: 36,
    },
  });
