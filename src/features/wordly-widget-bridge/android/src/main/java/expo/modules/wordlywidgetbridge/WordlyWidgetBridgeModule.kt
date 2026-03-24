package expo.modules.wordlywidgetbridge

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WordlyWidgetBridgeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WordlyWidgetBridge")

    AsyncFunction("setSnapshotJson") { json: String ->
      val context =
        appContext.reactContext?.applicationContext
          ?: throw Exceptions.ReactContextLost()
      val prefs = context.getSharedPreferences("wordly_widget", Context.MODE_PRIVATE)
      prefs.edit().putString("snapshot_json", json).apply()
    }
  }
}
