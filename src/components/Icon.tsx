import { SymbolView, type AndroidSymbol, type SymbolViewProps } from 'expo-symbols';

// SF Symbols on iOS, Material Symbols on Android and web.
const ICONS = {
  history: { ios: 'clock.arrow.circlepath', android: 'history' },
  settings: { ios: 'gearshape', android: 'settings' },
  newChat: { ios: 'square.and.pencil', android: 'edit_square' },
  send: { ios: 'arrow.up', android: 'arrow_upward' },
  stop: { ios: 'stop.fill', android: 'stop' },
  delete: { ios: 'trash', android: 'delete' },
  add: { ios: 'plus', android: 'add' },
  check: { ios: 'checkmark', android: 'check' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more' },
  show: { ios: 'eye', android: 'visibility' },
  hide: { ios: 'eye.slash', android: 'visibility_off' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh' },
  copy: { ios: 'doc.on.doc', android: 'content_copy' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome' },
  search: { ios: 'magnifyingglass', android: 'search' },
  error: { ios: 'exclamationmark.triangle', android: 'warning' },
} satisfies Record<string, { ios: SymbolViewProps['name'] & string; android: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: string }) {
  const { ios, android } = ICONS[name];
  return <SymbolView name={{ ios, android, web: android }} size={size} tintColor={color} />;
}
