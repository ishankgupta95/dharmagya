/**
 * P4.2 — Today's Panchang Android home-screen widget config plugin.
 *
 * Runs at `expo prebuild` time. It:
 *   1. Adds an AppWidgetProvider <receiver> to AndroidManifest.xml.
 *   2. Writes the AppWidgetProvider Kotlin class into the host app's package.
 *   3. Writes res/xml provider info, res/layout for small + medium sizes,
 *      res/drawable backgrounds, and a sidecar widget_colors.xml /
 *      widget_strings.xml under res/values.
 *
 * The companion `modules/widget-data` local Expo module supplies the JS bridge
 * (`writeWidgetPayload` / `notifyWidgets`). This plugin is the visual surface.
 *
 * Decisions (locked 2026-05-06):
 *  - System fonts only on widget surface (`serif` + `sans-serif-*`). Hindi
 *    renders via Android's bundled Noto Sans Devanagari fallback. Rationale:
 *    Sacred Editorial parity sacrificed to keep the widget bundle small +
 *    avoid asset duplication.
 *  - Single deep-ink palette (no day/night theme split). Matches the dark
 *    register that already dominates the in-app aesthetic.
 *  - Refresh strategy: foreground refresh (App.tsx AppState listener) +
 *    explicit Refresh tap zone on the medium widget. No 4 AM WorkManager fire
 *    in v1 — Doze + OEM restrictions are unreliable on the Android long tail.
 */
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ── Receiver injection ───────────────────────────────────────────────────────

const WIDGET_PROVIDER_NAME = '.widget.TodayPanchangWidget';
const WIDGET_PROVIDER_INFO_RES = '@xml/today_panchang_widget_info';

function injectReceiver(manifest) {
  const application = manifest.manifest.application?.[0];
  if (!application) return manifest;
  application.receiver = application.receiver || [];
  const exists = application.receiver.some(
    (r) => r.$ && r.$['android:name'] === WIDGET_PROVIDER_NAME,
  );
  if (exists) return manifest;
  application.receiver.push({
    $: {
      'android:name': WIDGET_PROVIDER_NAME,
      'android:exported': 'true',
      'android:label': '@string/widget_today_label',
    },
    'intent-filter': [
      {
        action: [
          { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } },
        ],
      },
    ],
    'meta-data': [
      {
        $: {
          'android:name': 'android.appwidget.provider',
          'android:resource': WIDGET_PROVIDER_INFO_RES,
        },
      },
    ],
  });
  return manifest;
}

// ── File templates ───────────────────────────────────────────────────────────

const widgetInfoXml = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="70dp"
    android:targetCellWidth="4"
    android:targetCellHeight="1"
    android:minResizeWidth="250dp"
    android:minResizeHeight="70dp"
    android:resizeMode="horizontal|vertical"
    android:initialLayout="@layout/widget_today_small"
    android:previewLayout="@layout/widget_today_medium"
    android:updatePeriodMillis="0"
    android:widgetCategory="home_screen" />
`;

const layoutSmallXml = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="@drawable/widget_background"
    android:padding="14dp">

    <TextView
        android:id="@+id/today_label"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:textColor="@color/widget_accent"
        android:textSize="10sp"
        android:fontFamily="sans-serif-medium"
        android:letterSpacing="0.18"
        android:text="TODAY" />

    <TextView
        android:id="@+id/tithi_line"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="6dp"
        android:textColor="@color/widget_text_primary"
        android:textSize="15sp"
        android:fontFamily="serif"
        android:maxLines="1"
        android:ellipsize="end" />

    <TextView
        android:id="@+id/footer_line"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="4dp"
        android:textColor="@color/widget_text_secondary"
        android:textSize="11sp"
        android:fontFamily="sans-serif"
        android:maxLines="1"
        android:ellipsize="end" />
</LinearLayout>
`;

const layoutMediumXml = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="@drawable/widget_background"
    android:padding="14dp">

    <RelativeLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content">

        <TextView
            android:id="@+id/today_label"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:textColor="@color/widget_accent"
            android:textSize="10sp"
            android:fontFamily="sans-serif-medium"
            android:letterSpacing="0.18"
            android:text="TODAY" />

        <TextView
            android:id="@+id/date_long"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_toEndOf="@id/today_label"
            android:layout_marginStart="8dp"
            android:layout_alignBaseline="@id/today_label"
            android:textColor="@color/widget_text_secondary"
            android:textSize="10sp"
            android:fontFamily="sans-serif" />

        <FrameLayout
            android:id="@+id/refresh_zone"
            android:layout_width="32dp"
            android:layout_height="22dp"
            android:layout_alignParentEnd="true"
            android:background="@drawable/widget_refresh_background">
            <TextView
                android:id="@+id/refresh_icon"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_gravity="center"
                android:text="↻"
                android:textColor="@color/widget_accent"
                android:textSize="13sp"
                android:fontFamily="sans-serif" />
        </FrameLayout>
    </RelativeLayout>

    <TextView
        android:id="@+id/tithi_label"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="10dp"
        android:textColor="@color/widget_text_tertiary"
        android:textSize="9sp"
        android:fontFamily="sans-serif-medium"
        android:letterSpacing="0.18" />

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:baselineAligned="true">
        <TextView
            android:id="@+id/tithi_value"
            android:layout_width="0dp"
            android:layout_weight="1"
            android:layout_height="wrap_content"
            android:textColor="@color/widget_text_primary"
            android:textSize="15sp"
            android:fontFamily="serif"
            android:maxLines="1"
            android:ellipsize="end" />
        <TextView
            android:id="@+id/tithi_until"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginStart="6dp"
            android:textColor="@color/widget_text_tertiary"
            android:textSize="10sp"
            android:fontFamily="sans-serif" />
    </LinearLayout>

    <TextView
        android:id="@+id/nakshatra_label"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="6dp"
        android:textColor="@color/widget_text_tertiary"
        android:textSize="9sp"
        android:fontFamily="sans-serif-medium"
        android:letterSpacing="0.18" />

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:baselineAligned="true">
        <TextView
            android:id="@+id/nakshatra_value"
            android:layout_width="0dp"
            android:layout_weight="1"
            android:layout_height="wrap_content"
            android:textColor="@color/widget_text_primary"
            android:textSize="15sp"
            android:fontFamily="serif"
            android:maxLines="1"
            android:ellipsize="end" />
        <TextView
            android:id="@+id/nakshatra_until"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginStart="6dp"
            android:textColor="@color/widget_text_tertiary"
            android:textSize="10sp"
            android:fontFamily="sans-serif" />
    </LinearLayout>

    <LinearLayout
        android:id="@+id/divider_line"
        android:layout_width="match_parent"
        android:layout_height="1dp"
        android:layout_marginTop="10dp"
        android:layout_marginBottom="6dp"
        android:background="@color/widget_divider" />

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal">

        <LinearLayout
            android:layout_width="0dp"
            android:layout_weight="1"
            android:layout_height="wrap_content"
            android:orientation="vertical">
            <TextView
                android:id="@+id/sunrise_label"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:textColor="@color/widget_text_tertiary"
                android:textSize="9sp"
                android:fontFamily="sans-serif-medium"
                android:letterSpacing="0.18" />
            <TextView
                android:id="@+id/sunrise_value"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:textColor="@color/widget_text_primary"
                android:textSize="13sp"
                android:fontFamily="sans-serif" />
        </LinearLayout>

        <LinearLayout
            android:layout_width="0dp"
            android:layout_weight="1"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:layout_marginStart="10dp">
            <TextView
                android:id="@+id/rahu_label"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:textColor="@color/widget_text_tertiary"
                android:textSize="9sp"
                android:fontFamily="sans-serif-medium"
                android:letterSpacing="0.18" />
            <TextView
                android:id="@+id/rahu_value"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:textColor="@color/widget_text_primary"
                android:textSize="13sp"
                android:fontFamily="sans-serif" />
        </LinearLayout>

    </LinearLayout>
</LinearLayout>
`;

const widgetBgDrawableXml = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="@color/widget_bg" />
    <corners android:radius="20dp" />
    <stroke android:width="1dp" android:color="@color/widget_border" />
</shape>
`;

const widgetBgLightDrawableXml = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="@color/widget_bg_light" />
    <corners android:radius="20dp" />
    <stroke android:width="1dp" android:color="@color/widget_border_light" />
</shape>
`;

const refreshBgDrawableXml = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="@color/widget_refresh_bg" />
    <corners android:radius="11dp" />
</shape>
`;

const refreshBgLightDrawableXml = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="@color/widget_refresh_bg_light" />
    <corners android:radius="11dp" />
</shape>
`;

const widgetColorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Dark register (Sacred Editorial deep ink) — default. -->
    <color name="widget_bg">#1A1008</color>
    <color name="widget_border">#33F3E5C8</color>
    <color name="widget_refresh_bg">#262B1A0F</color>
    <color name="widget_accent">#C99B3A</color>
    <color name="widget_text_primary">#F3E5C8</color>
    <color name="widget_text_secondary">#A8F3E5C8</color>
    <color name="widget_text_tertiary">#7AF3E5C8</color>
    <color name="widget_divider">#33F3E5C8</color>

    <!-- Light register (parchment + ink + sindoor). Applied at runtime by
         TodayPanchangWidget.kt when payload.isDarkMode is false. -->
    <color name="widget_bg_light">#F4E9CE</color>
    <color name="widget_border_light">#2D1B140A</color>
    <color name="widget_refresh_bg_light">#1FA5301C</color>
    <color name="widget_accent_light">#A5301C</color>
    <color name="widget_text_primary_light">#1B140A</color>
    <color name="widget_text_secondary_light">#B03A2F1F</color>
    <color name="widget_text_tertiary_light">#806A5A40</color>
    <color name="widget_divider_light">#B8A670</color>
</resources>
`;

const widgetStringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="widget_today_label">Today’s Panchang</string>
</resources>
`;

const kotlinWidget = (pkg) => `package ${pkg}.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.RemoteViews
import ${pkg}.R
import org.json.JSONObject

/**
 * Today's Panchang home-screen widget. Reads its content from
 * SharedPreferences (\`dharmagya_widget_prefs / today_panchang_payload\`) which
 * the RN side populates via the WidgetData native module.
 *
 * Two visual sizes (4x1 small, 4x2 medium) selected by current widget options
 * minHeight. No own scheduled updates — \`updatePeriodMillis\` is 0 in
 * widget_info.xml; we rely on JS-driven notifyAppWidgetUpdate broadcasts.
 */
class TodayPanchangWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        appWidgetIds.forEach { id ->
            val options = appWidgetManager.getAppWidgetOptions(id)
            val views = buildViews(context, options)
            appWidgetManager.updateAppWidget(id, views)
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        val views = buildViews(context, newOptions)
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun buildViews(context: Context, options: Bundle): RemoteViews {
        val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
        // 4x2 cells ≈ 110dp+ on most launchers; below that we render the compact 4x1.
        val isMedium = minHeight >= 110
        val layoutId = if (isMedium) R.layout.widget_today_medium else R.layout.widget_today_small
        val views = RemoteViews(context.packageName, layoutId)

        val payload = readPayload(context)
        val labels = payload.optJSONObject("labels")
        val untilLabel = labels?.optString("until", "until") ?: "until"
        val tithiName = payload.optString("tithiName", "—")
        val tithiEnd = payload.optString("tithiEndTime", "")
        val nakshatraName = payload.optString("nakshatraName", "—")
        val nakshatraEnd = payload.optString("nakshatraEndTime", "")
        val sunrise = payload.optString("sunrise", "—")
        val rahuKalam = payload.optString("rahuKalam", "—")
        val todayLabel = payload.optString("todayLabel", "Today")
        // Layouts default to dark colors at compile time. Light mode overrides
        // backgrounds + every text colour at render time.
        val isDark = payload.optBoolean("isDarkMode", true)
        val accent = context.getColor(if (isDark) R.color.widget_accent else R.color.widget_accent_light)
        val textPrimary = context.getColor(if (isDark) R.color.widget_text_primary else R.color.widget_text_primary_light)
        val textSecondary = context.getColor(if (isDark) R.color.widget_text_secondary else R.color.widget_text_secondary_light)
        val textTertiary = context.getColor(if (isDark) R.color.widget_text_tertiary else R.color.widget_text_tertiary_light)
        val divider = context.getColor(if (isDark) R.color.widget_divider else R.color.widget_divider_light)

        if (!isDark) {
            views.setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_background_light)
        }

        views.setTextViewText(R.id.today_label, todayLabel.uppercase())
        views.setTextColor(R.id.today_label, accent)

        if (isMedium) {
            views.setTextViewText(R.id.date_long, payload.optString("dateLong", ""))
            views.setTextColor(R.id.date_long, textSecondary)
            views.setTextViewText(
                R.id.tithi_label,
                (labels?.optString("tithi", "Tithi") ?: "Tithi").uppercase()
            )
            views.setTextColor(R.id.tithi_label, textTertiary)
            views.setTextViewText(R.id.tithi_value, tithiName)
            views.setTextColor(R.id.tithi_value, textPrimary)
            views.setTextViewText(
                R.id.tithi_until,
                if (tithiEnd.isNotEmpty()) "$untilLabel $tithiEnd" else ""
            )
            views.setTextColor(R.id.tithi_until, textTertiary)
            views.setTextViewText(
                R.id.nakshatra_label,
                (labels?.optString("nakshatra", "Nakshatra") ?: "Nakshatra").uppercase()
            )
            views.setTextColor(R.id.nakshatra_label, textTertiary)
            views.setTextViewText(R.id.nakshatra_value, nakshatraName)
            views.setTextColor(R.id.nakshatra_value, textPrimary)
            views.setTextViewText(
                R.id.nakshatra_until,
                if (nakshatraEnd.isNotEmpty()) "$untilLabel $nakshatraEnd" else ""
            )
            views.setTextColor(R.id.nakshatra_until, textTertiary)
            views.setTextViewText(
                R.id.sunrise_label,
                (labels?.optString("sunrise", "Sunrise") ?: "Sunrise").uppercase()
            )
            views.setTextColor(R.id.sunrise_label, textTertiary)
            views.setTextViewText(R.id.sunrise_value, sunrise)
            views.setTextColor(R.id.sunrise_value, textPrimary)
            views.setTextViewText(
                R.id.rahu_label,
                (labels?.optString("rahuKalam", "Rahu Kalam") ?: "Rahu Kalam").uppercase()
            )
            views.setTextColor(R.id.rahu_label, textTertiary)
            views.setTextViewText(R.id.rahu_value, rahuKalam)
            views.setTextColor(R.id.rahu_value, textPrimary)

            views.setInt(R.id.divider_line, "setBackgroundColor", divider)
            views.setTextColor(R.id.refresh_icon, accent)
            if (!isDark) {
                views.setInt(R.id.refresh_zone, "setBackgroundResource", R.drawable.widget_refresh_background_light)
            }

            views.setOnClickPendingIntent(
                R.id.refresh_zone,
                deepLinkPendingIntent(context, REQ_REFRESH, "dharmagya:///refresh-widget")
            )
        } else {
            views.setTextViewText(R.id.tithi_line, tithiName)
            views.setTextColor(R.id.tithi_line, textPrimary)
            val sub = StringBuilder()
                .append(nakshatraName)
                .append("  ·  ")
                .append(sunrise)
                .toString()
            views.setTextViewText(R.id.footer_line, sub)
            views.setTextColor(R.id.footer_line, textSecondary)
        }

        views.setOnClickPendingIntent(
            R.id.widget_root,
            deepLinkPendingIntent(context, REQ_OPEN, "dharmagya:///panchang")
        )

        return views
    }

    private fun deepLinkPendingIntent(context: Context, requestCode: Int, uri: String): PendingIntent {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }

    private fun readPayload(context: Context): JSONObject {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_PAYLOAD, null) ?: return JSONObject()
        return try {
            JSONObject(raw)
        } catch (e: Exception) {
            JSONObject()
        }
    }

    companion object {
        private const val PREFS_NAME = "dharmagya_widget_prefs"
        private const val KEY_PAYLOAD = "today_panchang_payload"
        private const val REQ_OPEN = 0
        private const val REQ_REFRESH = 1
    }
}
`;

// ── File-write helpers ───────────────────────────────────────────────────────

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

// ── Plugin entry ─────────────────────────────────────────────────────────────

const withTodayPanchangWidget = (config) => {
  config = withAndroidManifest(config, (cfg) => {
    cfg.modResults = injectReceiver(cfg.modResults);
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkg = cfg.android?.package;
      if (!pkg) {
        throw new Error('[withTodayPanchangWidget] expo.android.package is required.');
      }
      const projectRoot = cfg.modRequest.platformProjectRoot;
      const appSrcMain = path.join(projectRoot, 'app', 'src', 'main');
      const packagePath = path.join(appSrcMain, 'java', ...pkg.split('.'), 'widget');
      const resXml = path.join(appSrcMain, 'res', 'xml');
      const resLayout = path.join(appSrcMain, 'res', 'layout');
      const resDrawable = path.join(appSrcMain, 'res', 'drawable');
      const resValues = path.join(appSrcMain, 'res', 'values');

      writeFile(path.join(packagePath, 'TodayPanchangWidget.kt'), kotlinWidget(pkg));
      writeFile(path.join(resXml, 'today_panchang_widget_info.xml'), widgetInfoXml);
      writeFile(path.join(resLayout, 'widget_today_small.xml'), layoutSmallXml);
      writeFile(path.join(resLayout, 'widget_today_medium.xml'), layoutMediumXml);
      writeFile(path.join(resDrawable, 'widget_background.xml'), widgetBgDrawableXml);
      writeFile(path.join(resDrawable, 'widget_background_light.xml'), widgetBgLightDrawableXml);
      writeFile(path.join(resDrawable, 'widget_refresh_background.xml'), refreshBgDrawableXml);
      writeFile(path.join(resDrawable, 'widget_refresh_background_light.xml'), refreshBgLightDrawableXml);
      // Sidecar files — Android merges all *.xml under res/values, so we don't
      // touch the stock colors.xml / strings.xml that other plugins also write.
      writeFile(path.join(resValues, 'widget_colors.xml'), widgetColorsXml);
      writeFile(path.join(resValues, 'widget_strings.xml'), widgetStringsXml);

      return cfg;
    },
  ]);

  return config;
};

module.exports = withTodayPanchangWidget;
