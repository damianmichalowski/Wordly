import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import Colors from '@/src/constants/Colors';
import { useColorScheme } from '@/src/hooks/useColorScheme';
import { StitchColors } from '@/src/theme/wordlyStitchTheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        tabBarInactiveTintColor: Colors[colorScheme].tabIconDefault,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#121418' : StitchColors.surfaceContainerLowest,
          borderTopColor: StitchColors.surfaceContainer,
          paddingHorizontal: 12,
          paddingTop: 6,
          paddingBottom: 6,
        },
        tabBarIconStyle: {
          marginBottom: 5,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        /** Nagłówki w `ScreenHeader` na każdym ekranie (bez domyślnego title z Tabs). */
        headerShown: false,
      }}>
      {/* `app/(tabs)/index.tsx`: redirect na `home`; bez tego Expo pokazuje czwarty tab „index”. */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="home"
        options={{
          title: 'Daily Word',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'text.book.closed',
                android: 'home',
                web: 'home',
              }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="revision"
        options={{
          title: 'Revision Hub',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'rectangle.stack',
                android: 'history',
                web: 'history',
              }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Szukaj',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'magnifyingglass',
                android: 'search',
                web: 'search',
              }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'gearshape',
                android: 'settings',
                web: 'settings',
              }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
    </Tabs>
  );
}
