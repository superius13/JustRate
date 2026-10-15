import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

const ALL_EDGES: Edge[] = ['top', 'right', 'bottom', 'left'];
/** Inside the tab navigator the tab bar already covers the bottom inset. */
export const TAB_EDGES: Edge[] = ['top', 'right', 'left'];

/** Paper-coloured page with safe-area padding that scrolls above the keyboard. */
export function Screen({ children, edges = ALL_EDGES }: { children: ReactNode; edges?: Edge[] }) {
  return (
    <SafeAreaView className="flex-1 bg-background-50" edges={edges}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerClassName="flex-grow px-5 py-6"
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
