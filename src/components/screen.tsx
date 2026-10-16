import type { ReactNode } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

const ALL_EDGES: Edge[] = ['top', 'right', 'bottom', 'left'];
/** Inside the tab navigator the tab bar already covers the bottom inset. */
export const TAB_EDGES: Edge[] = ['top', 'right', 'left'];

/** Gap kept between the focused field and the top of the keyboard. */
const KEYBOARD_GAP = 24;

/**
 * Paper-coloured page with safe-area padding. When the keyboard opens it scrolls the focused
 * field above it; the app draws edge to edge on Android, so the window itself never shrinks.
 */
export function Screen({ children, edges = ALL_EDGES }: { children: ReactNode; edges?: Edge[] }) {
  return (
    <SafeAreaView className="flex-1 bg-background-50" edges={edges}>
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingVertical: 24 }}
        keyboardShouldPersistTaps="handled">
        {children}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
