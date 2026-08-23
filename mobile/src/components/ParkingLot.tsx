/**
 * SETU Mobile — the parking lot.
 *
 * The direct accommodation for the one memory finding from the clinical review:
 * long-term memory in this group is intact, working memory is not. The problem
 * is never "I forgot how to do this", it is "I cannot hold that while I finish
 * this". Offloading beats any amount of reminding.
 *
 * Everything about it is built to cost nothing to use — one tap from anywhere,
 * the field already focused, one tap to file, and you are back where you were.
 * A note that takes three taps to write is a note nobody writes, and the thought
 * is gone by then anyway.
 *
 * Notes never leave the phone.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Pin, Plus, Trash2, X } from 'lucide-react-native';

import { Palette } from '../constants/themes';
import { RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { useThemeColors, useThemedStyles } from '../context/ThemeContext';
import {
  clearDoneNotes,
  deleteParkedNote,
  getParkedNotes,
  parkNote,
  toggleParkedNote,
} from '../services/localStore';
import { award } from '../services/progress';
import { ParkedNote } from '../types';
import { Text, Kicker } from './Typography';
import { VoiceInputButton } from './VoiceInputButton';

export const ParkingLot: React.FC = () => {
  const COLORS = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<ParkedNote[]>([]);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    getParkedNotes().then(setNotes);
  }, []);

  const openSheet = useCallback(() => {
    setOpen(true);
    // Focusing after the modal has actually mounted; focusing during the same
    // frame is dropped on Android.
    setTimeout(() => inputRef.current?.focus(), 120);
  }, []);

  const file = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setNotes(await parkNote(text));
    award('noteParked');
    inputRef.current?.focus();
  }, [draft]);

  const pending = notes.filter((note) => !note.done).length;

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={
          pending
            ? `Parking lot, ${pending} ${pending === 1 ? 'thought' : 'thoughts'} parked`
            : 'Parking lot — park a thought so you can let go of it'
        }
        activeOpacity={0.85}
        onPress={openSheet}
        style={[styles.fab, { bottom: 76 + insets.bottom }]}
      >
        <Pin size={18} color={COLORS.textInverse} />
        {pending > 0 ? (
          <View style={styles.badge}>
            <Text variant="caption" weight="bold" color={COLORS.textInverse}>
              {pending}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheet, { paddingBottom: SPACING.lg + insets.bottom }]}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Kicker color={COLORS.cyan}>Parking lot</Kicker>
                <Text variant="titleSm" weight="bold">
                  Put it down for now
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close the parking lot"
                style={styles.iconButton}
              >
                <X size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <Text variant="caption" color={COLORS.textMuted} style={{ marginBottom: SPACING.sm }}>
              Anything that just interrupted you. It stays on this phone, and you can come back to
              it when you are finished with what you were doing.
            </Text>

            <View style={styles.composer}>
              <TextInput
                ref={inputRef}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={file}
                returnKeyType="done"
                blurOnSubmit={false}
                placeholder="Remind me to check the invoice date…"
                placeholderTextColor={COLORS.textSubtle}
                style={styles.input}
                accessibilityLabel="What do you want to park?"
                multiline
              />
              <VoiceInputButton
                onTranscript={(text) => setDraft((prev) => (prev ? `${prev} ${text}` : text))}
                size={36}
                showError={false}
              />
              <TouchableOpacity
                onPress={file}
                disabled={!draft.trim()}
                accessibilityRole="button"
                accessibilityLabel="Park this thought"
                style={[styles.fileButton, !draft.trim() ? styles.fileButtonDisabled : null]}
              >
                <Plus size={18} color={COLORS.textInverse} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {notes.length === 0 ? (
                <Text variant="bodySm" color={COLORS.textMuted} style={styles.empty}>
                  Nothing parked. That is a perfectly good state to be in.
                </Text>
              ) : (
                notes.map((note) => (
                  <View key={note.id} style={styles.noteRow}>
                    <TouchableOpacity
                      onPress={async () => setNotes(await toggleParkedNote(note.id))}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: note.done }}
                      accessibilityLabel={note.text}
                      style={[styles.checkbox, note.done ? styles.checkboxDone : null]}
                    >
                      {note.done ? <Check size={13} color={COLORS.textInverse} /> : null}
                    </TouchableOpacity>

                    <Text
                      variant="bodySm"
                      color={note.done ? COLORS.textSubtle : COLORS.text}
                      style={[{ flex: 1 }, note.done ? styles.noteDone : null]}
                    >
                      {note.text}
                    </Text>

                    <TouchableOpacity
                      onPress={async () => setNotes(await deleteParkedNote(note.id))}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete: ${note.text}`}
                      style={styles.iconButton}
                    >
                      <Trash2 size={15} color={COLORS.textSubtle} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            {notes.some((note) => note.done) ? (
              <TouchableOpacity
                onPress={async () => setNotes(await clearDoneNotes())}
                accessibilityRole="button"
                style={styles.clearDone}
              >
                <Text variant="caption" weight="semibold" color={COLORS.cyan}>
                  Clear the ones you have done
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    fab: {
      position: 'absolute',
      right: SPACING.md,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: t.cyan,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 90,
      ...SHADOWS.lg,
    },
    badge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 20,
      height: 20,
      paddingHorizontal: 5,
      borderRadius: 10,
      backgroundColor: t.magenta,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: t.bg,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    sheetWrap: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: t.bg,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: SPACING.lg,
      maxHeight: '82%',
      borderTopWidth: 1,
      borderColor: t.divider,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: SPACING.xs,
    },
    iconButton: {
      minWidth: 40,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: SPACING.sm,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 110,
      backgroundColor: t.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: t.divider,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      color: t.text,
      fontSize: 15,
    },
    fileButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.cyan,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fileButtonDisabled: {
      backgroundColor: t.surfaceAlt,
    },
    list: {
      marginTop: SPACING.md,
    },
    empty: {
      paddingVertical: SPACING.xl,
      textAlign: 'center',
    },
    noteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: t.dividerSubtle,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: RADIUS.sm,
      borderWidth: 1.5,
      borderColor: t.divider,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxDone: {
      backgroundColor: t.success,
      borderColor: t.success,
    },
    noteDone: {
      textDecorationLine: 'line-through',
    },
    clearDone: {
      alignSelf: 'center',
      paddingVertical: SPACING.sm,
      minHeight: 44,
      justifyContent: 'center',
    },
  });

export default ParkingLot;
