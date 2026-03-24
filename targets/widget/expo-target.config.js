/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'WordlyWidget',
  displayName: 'Wordly',
  icon: '../../assets/images/icon.png',
  // iOS 17+: `Link` w treści widgetu (Known / Skip). Starsze iOS = tylko tap w cały widget.
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  entitlements: {
    'com.apple.security.application-groups': ['group.com.wordly.mobile'],
  },
});
