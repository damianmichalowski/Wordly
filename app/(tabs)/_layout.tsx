import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { ThemeProvider } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Colors from '@/src/constants/Colors';
import { WordlyNavigationLight } from '@/src/theme/navigationTheme';
import { StitchColors } from '@/src/theme/wordlyStitchTheme';
import { logUserAction } from '@/src/utils/userActionLog';

/** Tab bar zawsze w palecie jasnej — apka jest świadomie „light”; nie podążamy za systemowym dark mode. */
const tabColors = Colors.light;

export default function TabLayout() {
  const { t } = useTranslation();
  return (
    <ThemeProvider value={WordlyNavigationLight}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: tabColors.tint,
          tabBarInactiveTintColor: tabColors.tabIconDefault,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: StitchColors.surfaceContainerLowest,
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
          listeners={{
            tabPress: () =>
              logUserAction('tab_press', { target: 'daily_word' }),
          }}
          options={{
            title: t('tabs.dailyWord'),
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
          listeners={{
            tabPress: () =>
              logUserAction('tab_press', { target: 'revision_hub' }),
          }}
          options={{
            title: t('tabs.revisionHub'),
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
          name="library"
          listeners={{
            tabPress: () =>
              logUserAction('tab_press', { target: 'library' }),
          }}
          options={{
            title: t('tabs.library'),
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{
                  ios: 'books.vertical.fill',
                  android: 'library_books',
                  web: 'library_books',
                }}
                tintColor={color}
                size={28}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          listeners={{
            tabPress: () =>
              logUserAction('tab_press', { target: 'settings' }),
          }}
          options={{
            title: t('tabs.settings'),
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
    </ThemeProvider>
  );
}
