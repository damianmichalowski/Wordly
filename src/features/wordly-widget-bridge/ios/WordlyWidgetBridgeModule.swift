import ExpoModulesCore
import Foundation
import WidgetKit

private let appGroupId = "group.com.wordly.mobile"
private let snapshotKey = "wordly.widget.snapshot.v1"
/// Must match `WordlyDailyWidget.kind` in the widget extension.
private let widgetKind = "WordlyDailyWidget"

public class WordlyWidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WordlyWidgetBridge")

    AsyncFunction("setSnapshotJson") { (json: String) in
      guard let defaults = UserDefaults(suiteName: appGroupId) else {
        throw NSError(
          domain: "WordlyWidgetBridge",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: "App Group UserDefaults unavailable (check entitlements)."]
        )
      }
      defaults.set(json, forKey: snapshotKey)
      defaults.synchronize()

      #if arch(arm64) || arch(x86_64)
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
      }
      #endif
    }
  }
}
