import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

/** Colors taken from the web dashboard shell and holographic widgets. */
export const shell = {
  bg: '#121212',
  bar: '#1a1a1a',
  line: '#262626',
  side: '#161616',
  sideLine: '#222222',
  text: '#e1e1e1',
  white: '#ffffff',
  muted: '#8e8e93',
  faint: '#9ca3af',
  cyan: '#00d4ff',
  magenta: '#ff00ff',
  magentaSoft: '#ff6bff',
  pink: '#ff8fab',
  pinkSoft: '#ffb3c6',
  active: '#2d1b4e',
  badge: '#ff2d55',
  gold: '#f59e0b',
  goldText: '#fbbf24',
  cream: '#fde68a',
  ok: '#10b981',
  danger: '#ff6b8a',
};

export function StageFrame({ children }: { children: ReactNode }) {
  return (
    <View style={styles.pad}>
      <View style={styles.holo}>
        <View style={styles.widget}>{children}</View>
      </View>
    </View>
  );
}

export function PanelTitle({ icon, children }: { icon?: string; children: string }) {
  return (
    <View style={styles.titleRow}>
      <Text style={styles.title}>
        {icon ? `${icon}  ` : ''}
        {children}
      </Text>
      <View style={styles.titleRule} />
    </View>
  );
}

export function Hint({ children }: { children: string }) {
  return <Text style={styles.hint}>{children}</Text>;
}

export function Notice({ children, tone = 'cyan' }: { children: string; tone?: 'cyan' | 'magenta' | 'gold' | 'danger' }) {
  return (
    <Text
      style={[
        styles.notice,
        tone === 'magenta' && styles.noticeMagenta,
        tone === 'gold' && styles.noticeGold,
        tone === 'danger' && styles.noticeDanger,
      ]}
    >
      {children}
    </Text>
  );
}

export function Field({
  label,
  ...input
}: { label?: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={shell.faint}
        autoCapitalize="none"
        style={[styles.input, input.multiline && styles.inputMulti]}
        {...input}
      />
    </View>
  );
}

export function NeonButton({
  label,
  onPress,
  tone = 'cyan',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  tone?: 'cyan' | 'magenta' | 'gold' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.neon,
        tone === 'magenta' && styles.neonMagenta,
        tone === 'gold' && styles.neonGold,
        tone === 'ghost' && styles.neonGhost,
        tone === 'danger' && styles.neonDanger,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.neonText,
          tone === 'magenta' && { color: shell.magenta },
          tone === 'gold' && { color: shell.goldText },
          tone === 'ghost' && { color: shell.text },
          tone === 'danger' && { color: shell.pinkSoft },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function PersonRow({
  name,
  meta,
  action,
  onAction,
}: {
  name: string;
  meta?: string;
  action?: string;
  onAction?: () => void;
}) {
  const initial = name.replace(/^@/, '').slice(0, 1).toUpperCase() || '?';
  return (
    <View style={styles.person}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.personCopy}>
        <Text style={styles.personName} numberOfLines={1}>
          {name}
        </Text>
        {meta ? <Text style={styles.personMeta}>{meta}</Text> : null}
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} style={styles.personAction}>
          <Text style={styles.personActionText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  holo: {
    borderWidth: 2,
    borderColor: 'rgba(255, 140, 175, 0.75)',
    borderRadius: 12,
    backgroundColor: 'rgba(30, 10, 28, 0.55)',
    padding: 2,
  },
  widget: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.45)',
    padding: 16,
    gap: 12,
  },
  titleRow: { gap: 8, marginBottom: 2 },
  title: { color: shell.white, fontSize: 18, fontWeight: '700', letterSpacing: 0.4 },
  titleRule: { height: 2, width: 60, backgroundColor: shell.pink, borderRadius: 2 },
  hint: { color: shell.faint, fontSize: 12, lineHeight: 18, letterSpacing: 0.2 },
  notice: {
    color: shell.cyan,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.45)',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderRadius: 10,
    padding: 10,
    overflow: 'hidden',
  },
  noticeMagenta: {
    color: shell.magenta,
    borderColor: shell.magenta,
    backgroundColor: 'rgba(255, 0, 255, 0.15)',
  },
  noticeGold: {
    color: shell.cream,
    borderColor: 'rgba(251, 191, 36, 0.65)',
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
  },
  noticeDanger: {
    color: shell.danger,
    borderColor: 'rgba(255, 107, 138, 0.6)',
    backgroundColor: 'rgba(255, 107, 138, 0.12)',
  },
  field: { gap: 6 },
  fieldLabel: {
    color: shell.faint,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 255, 0.5)',
    borderRadius: 8,
    color: shell.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputMulti: { minHeight: 88, textAlignVertical: 'top' },
  neon: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: shell.cyan,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  neonMagenta: {
    borderColor: shell.magenta,
    backgroundColor: 'rgba(255, 0, 255, 0.12)',
  },
  neonGold: {
    borderColor: shell.gold,
    backgroundColor: 'rgba(234, 88, 12, 0.22)',
  },
  neonGhost: { borderColor: '#333', backgroundColor: '#1a1a1a' },
  neonDanger: { borderColor: '#5a2438', backgroundColor: 'rgba(90, 36, 56, 0.35)' },
  neonText: { color: shell.cyan, fontSize: 13, fontWeight: '700', letterSpacing: 0.3, textAlign: 'center' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.82 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: shell.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: shell.pinkSoft, fontWeight: '700', fontSize: 16 },
  personCopy: { flex: 1, gap: 2 },
  personName: { color: shell.white, fontSize: 15, fontWeight: '700' },
  personMeta: { color: shell.faint, fontSize: 11 },
  personAction: {
    borderWidth: 1,
    borderColor: shell.cyan,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  personActionText: { color: shell.cyan, fontSize: 12, fontWeight: '700' },
});
