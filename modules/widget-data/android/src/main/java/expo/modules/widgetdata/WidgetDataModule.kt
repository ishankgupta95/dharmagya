package expo.modules.widgetdata

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS → SharedPreferences bridge for the Today's Panchang home-screen widget.
 *
 * RN side computes the daily snapshot and calls `write(json)`. We persist it
 * under a known key (`PREFS_NAME / KEY_PAYLOAD`) and ping the AppWidget
 * provider via the standard ACTION_APPWIDGET_UPDATE broadcast so onUpdate()
 * re-reads the prefs and rebuilds RemoteViews.
 *
 * The widget provider class is referenced by FQCN at runtime so this module
 * doesn't compile-couple to the app's widget package.
 */
class WidgetDataModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WidgetData")

    Function("write") { json: String ->
      appContext.reactContext?.let { ctx ->
        val prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_PAYLOAD, json).apply()
      }
    }

    Function("notifyAll") {
      appContext.reactContext?.let { ctx -> notifyTodayWidget(ctx) }
    }
  }

  private fun notifyTodayWidget(ctx: Context) {
    val componentName = ComponentName(ctx.packageName, WIDGET_PROVIDER_FQCN)
    val mgr = AppWidgetManager.getInstance(ctx) ?: return
    val ids = try {
      mgr.getAppWidgetIds(componentName)
    } catch (e: Exception) {
      // No widget instances pinned yet — nothing to notify.
      return
    }
    if (ids == null || ids.isEmpty()) return

    val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
      component = componentName
      putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
    }
    ctx.sendBroadcast(intent)
  }

  companion object {
    private const val PREFS_NAME = "dharmagya_widget_prefs"
    private const val KEY_PAYLOAD = "today_panchang_payload"
    /** Concrete class lives in the host app at this FQCN, written by the
     *  withTodayPanchangWidget config plugin at prebuild time. */
    private const val WIDGET_PROVIDER_FQCN =
      "com.ishank1995.dharmagya.widget.TodayPanchangWidget"
  }
}
