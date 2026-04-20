import QtQuick
import QtQuick.Controls
import QtWebEngine
import Qt5Compat.GraphicalEffects
import org.kde.layershell as LayerShell

ApplicationWindow {
    id: root
    visible: true
    // Transparent root so the rounded-corner clip below shows the compositor
    // behind the clipped-away corner triangles. niri's layer-rule already
    // matches with geometry-corner-radius 12; this pairs with it.
    color: "transparent"
    width: 3840
    height: bridge.zoneHeight

    readonly property int cornerRadius: 12

    // Drag-to-resize is temporarily removed (2026-04-20): the bottom-edge
    // MouseArea never received onPressed even though onReleased + hover
    // fired — WebEngineView or another item swallowed the button press
    // before QML could grab it. Revisit with DragHandler instead of
    // MouseArea. See memory: project_webview_zone_resize_blocked.md.
    // zoneHeight is driven statically from config.toml for now; edits via
    // the Settings panel still apply live through bridge.setZoneHeight.

    LayerShell.Window.scope: "webview-zone"
    LayerShell.Window.anchors: LayerShell.Window.AnchorTop
                             | LayerShell.Window.AnchorLeft
                             | LayerShell.Window.AnchorRight
    LayerShell.Window.margins.top: bridge.marginTop
    LayerShell.Window.margins.left: bridge.marginLeft
    LayerShell.Window.margins.right: bridge.marginRight
    LayerShell.Window.exclusionZone: bridge.zoneHeight + bridge.marginTop
    LayerShell.Window.layer: LayerShell.Window.LayerTop
    LayerShell.Window.keyboardInteractivity: LayerShell.Window.KeyboardInteractivityOnDemand

    // Shared persistent profile — cookies, localStorage, IndexedDB live under
    // ~/.local/state/webview-zone/profile/ so logins survive restarts.
    WebEngineProfile {
        id: sharedProfile
        // storageName is what actually toggles on-disk persistence for
        // cookies + login state in QtWebEngine. Without it, the profile
        // behaves off-the-record for cookies even when offTheRecord=false
        // and persistentCookiesPolicy=ForcePersistentCookies are set.
        storageName: "webview-zone"
        offTheRecord: false
        persistentStoragePath: bridge.profilePath
        cachePath: bridge.profilePath
        httpCacheType: WebEngineProfile.DiskHttpCache
        persistentCookiesPolicy: WebEngineProfile.ForcePersistentCookies
        // Strip the QtWebEngine/X.Y token from the UA so Google OAuth
        // stops flagging us as an "embedded browser" and invalidating the
        // session on every launch. Logfire uses Google SSO and was
        // re-prompting on every restart even with cookies persisted.
        httpUserAgent: bridge.userAgent
        // Dashboards don't download; refuse to save anything the server sends.
        onDownloadRequested: function(download) { download.cancel() }
    }

    // Mask source for the OpacityMask below. Not visible itself; rendered
    // into an offscreen texture via layer.enabled and used to shape what
    // pixels of `clipLayer` get through.
    Rectangle {
        id: roundedMask
        anchors.fill: parent
        radius: root.cornerRadius
        color: "black"
        visible: false
        layer.enabled: true
        layer.smooth: true
    }

    // Wrapper that holds everything that needs clipping to the rounded
    // shape. The plan's Spike 2 flagged this pattern as breaking pointer
    // events via QTBUG-44666, but Qt 6.10 appears to deliver pointer
    // events correctly through a layered parent for WebEngineView. If
    // clicks/scroll stop working, revert this Item wrapper and the
    // `color: transparent` above.
    Item {
        id: clipLayer
        anchors.fill: parent
        layer.enabled: true
        layer.smooth: true
        layer.effect: OpacityMask { maskSource: roundedMask }

    SplitView {
        id: split
        anchors.fill: parent
        orientation: Qt.Horizontal

        Repeater {
            id: paneRepeater
            model: bridge.urlsModel
            delegate: WebEngineView {
                profile: sharedProfile
                url: model.url
                zoomFactor: model.zoom
                SplitView.fillWidth: true
                SplitView.minimumWidth: 200
                backgroundColor: "black"
                // Block Chromium's default context menu and route the click
                // to our Menu (Enhancement #5). Prior art: Discord, Slack,
                // 1Password, Linear, Notion. Accepting the request is the
                // QML equivalent of Qt.PreventContextMenu.
                onContextMenuRequested: function (request) {
                    request.accepted = true
                    contextMenu.popup()
                }
            }
        }

        // Defer the restore until after all delegates are parented AND
        // SplitView has done its initial layout. SplitView.restoreState
        // writes to the attached SplitView.preferredWidth on each handle;
        // if called before children exist, or before layout, it no-ops.
        // Defer the restore until after all Repeater delegates are
        // parented and SplitView has done its initial layout. Two gotchas
        // bit us here:
        //   1. SplitView.Component.onCompleted fires before Repeater
        //      populates, so restoring there runs against a 0-pane
        //      SplitView and no-ops.
        //   2. PySide6 exposes QByteArray to QML as an ArrayBuffer whose
        //      size is .byteLength, NOT .length — an earlier guard of
        //      `.length > 0` was always falsy and skipped every restore.
        Timer {
            id: restoreTimer
            interval: 50
            repeat: false
            onTriggered: {
                var st = bridge.savedSplitState
                if (st && st.byteLength > 0) {
                    split.restoreState(st)
                }
            }
        }

        Component.onCompleted: restoreTimer.start()

        // Persist on drag-release (resizing flips true→false).
        onResizingChanged: {
            if (!resizing) {
                bridge.persistSplitState(split.saveState())
            }
        }
    }
    } // end clipLayer

    Menu {
        id: contextMenu
        MenuItem { text: qsTr("Settings…"); onTriggered: settingsPanel.open() }
        MenuItem { text: qsTr("Reload focused pane"); onTriggered: reloadFocused(false) }
        MenuItem { text: qsTr("Reload all"); onTriggered: reloadAll() }
        MenuSeparator {}
        MenuItem { text: qsTr("Restart webview-zone"); onTriggered: bridge.requestRestart() }
    }

    SettingsPanel {
        id: settingsPanel
        onRequestFreezePanes: {
            for (var i = 0; i < split.count; i++) {
                var v = split.itemAt(i)
                if (v) v.lifecycleState = WebEngineView.Frozen
            }
        }
        onRequestUnfreezePanes: {
            for (var j = 0; j < split.count; j++) {
                var w = split.itemAt(j)
                if (w) w.lifecycleState = WebEngineView.Active
            }
        }
    }

    // Reload currently-focused pane; fall back to reloading all if none
    // has focus (happens right after startup before any click).
    function reloadFocused(bypassCache) {
        for (var i = 0; i < split.count; i++) {
            var v = split.itemAt(i)
            if (v && v.activeFocus) {
                bypassCache ? v.reloadAndBypassCache() : v.reload()
                return
            }
        }
        reloadAll(bypassCache)
    }

    function reloadAll(bypassCache) {
        for (var k = 0; k < split.count; k++) {
            var w = split.itemAt(k)
            if (w) bypassCache ? w.reloadAndBypassCache() : w.reload()
        }
    }

    Shortcut {
        sequences: ["Ctrl+R"]
        onActivated: reloadFocused(false)
    }

    Shortcut {
        sequences: ["Ctrl+Shift+R"]
        onActivated: reloadFocused(true)
    }
}
