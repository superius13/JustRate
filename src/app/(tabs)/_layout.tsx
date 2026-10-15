import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/components/colors';
import { FriendsIcon, ProfileIcon, ShelfIcon } from '@/components/icons';

// The default bar is too short for an icon plus a label in Golos Text, so give it room explicitly.
const BAR_HEIGHT = 58;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.paper },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: BAR_HEIGHT + insets.bottom,
        },
        tabBarLabelStyle: { fontFamily: 'GolosText_600SemiBold', fontSize: 11, lineHeight: 14 },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Полка', tabBarIcon: ({ color }) => <ShelfIcon color={color as string} /> }}
      />
      <Tabs.Screen
        name="friends"
        options={{ title: 'Друзья', tabBarIcon: ({ color }) => <FriendsIcon color={color as string} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Профиль', tabBarIcon: ({ color }) => <ProfileIcon color={color as string} /> }}
      />
    </Tabs>
  );
}
