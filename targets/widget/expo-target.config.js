/**
 * Widget extension — ładowane gdy `app.config.ts` nie ma `EXPO_NO_WIDGET=1`
 * (plugin `@bacons/apple-targets` w `plugins`).
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'widget',
  name: 'WordlyWidget',
  // Must differ from the host app; `.Name` appends to ios.bundleIdentifier (see @bacons/apple-targets README).
  bundleIdentifier: '.WordlyWidget',
  displayName: 'Wordly',
  icon: '../../assets/icons/ios-light.png',
  // iOS 17+: `Link` w treści widgetu (Known / Skip). Starsze iOS = tylko tap w cały widget.
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  entitlements: {
    'com.apple.security.application-groups': [
      'group.com.damianmichalowski.wordly',
    ],
  },
});
