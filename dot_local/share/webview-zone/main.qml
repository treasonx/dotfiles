import QtQuick
import QtQuick.Controls
import QtWebEngine
import org.kde.layershell as LayerShell

ApplicationWindow {
    id: root
    visible: true
    color: "black"
    width: 3840
    height: bridge.zoneHeight

    LayerShell.Window.scope: "webview-zone"
    LayerShell.Window.anchors: LayerShell.Window.AnchorTop
                             | LayerShell.Window.AnchorLeft
                             | LayerShell.Window.AnchorRight
    LayerShell.Window.exclusionZone: bridge.zoneHeight
    LayerShell.Window.layer: LayerShell.Window.LayerTop
    LayerShell.Window.keyboardInteractivity: LayerShell.Window.KeyboardInteractivityOnDemand

    // Shared persistent profile — cookies, localStorage, IndexedDB live under
    // ~/.local/state/webview-zone/profile/ so logins survive restarts.
    WebEngineProfile {
        id: sharedProfile
        offTheRecord: false
        persistentStoragePath: bridge.profilePath
        httpCacheType: WebEngineProfile.DiskHttpCache
        persistentCookiesPolicy: WebEngineProfile.ForcePersistentCookies
        // Dashboards don't download; refuse to save anything the server sends.
        onDownloadRequested: function(download) { download.cancel() }
    }

    SplitView {
        id: split
        anchors.fill: parent
        orientation: Qt.Horizontal

        Repeater {
            model: bridge.urlsModel
            delegate: WebEngineView {
                profile: sharedProfile
                url: model.url
                zoomFactor: model.zoom
                SplitView.fillWidth: true
                SplitView.minimumWidth: 200
                backgroundColor: "black"
            }
        }

        Component.onCompleted: {
            if (bridge.savedSplitState && bridge.savedSplitState.length > 0) {
                split.restoreState(bridge.savedSplitState)
            }
        }

        // Persist on drag-release (resizing flips true→false).
        onResizingChanged: {
            if (!resizing) {
                bridge.persistSplitState(split.saveState())
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
        for (var j = 0; j < split.count; j++) {
            var w = split.itemAt(j)
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
