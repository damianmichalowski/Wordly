import { Redirect } from 'expo-router';

/**
 * Route: `/(tabs)`: domyślna zakładka.
 */
export default function TabsIndexRoute() {
  return <Redirect href="/(tabs)/home" />;
}
