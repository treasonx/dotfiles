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

    // Decoupled from the live bridge property so drag-resize doesn't spam
    // wl_layer_surface.set_exclusive_zone (Enhancement #13). Rebinds
    // after a drag releases.
    property bool _dragging: false
    property int _frozenExclusionZone: bridge.zoneHeight + bridge.marginTop

    LayerShell.Window.scope: "webview-zone"
    LayerShell.Window.anchors: LayerShell.Window.AnchorTop
                             | LayerShell.Window.AnchorLeft
                             | LayerShell.Window.AnchorRight
    LayerShell.Window.margins.top: bridge.marginTop
    LayerShell.Window.margins.left: bridge.marginLeft
    LayerShell.Window.margins.right: bridge.marginRight
    LayerShell.Window.exclusionZone: root._dragging
        ? root._frozenExclusionZone
        : (bridge.zoneHeight + bridge.marginTop)
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

    // Bottom-edge drag-resize handle (Enhancement #13). Invisible hot-zone
    // per open-question #1 in the plan.
    MouseArea {
        id: resizeHandle
        height: 6
        anchors { left: parent.left; right: parent.right; bottom: parent.bottom }
        cursorShape: Qt.SizeVerCursor
        acceptedButtons: Qt.LeftButton
        preventStealing: true

        property int _startScreenY: 0
        property int _startHeight: 0
        property int _pendingHeight: 0

        // Coalesce pointer moves to ~60 Hz. Pointer can fire at 144 Hz; a
        // bridge.setZoneHeight() per event would thrash QML bindings.
        Timer {
            id: coalesce
            interval: 16
            repeat: false
            onTriggered: bridge.setZoneHeight(resizeHandle._pendingHeight)
        }

        onPressed: function (mouse) {
            _startScreenY = mouse.screenY
            _startHeight = bridge.zoneHeight
            _pendingHeight = _startHeight
            root._frozenExclusionZone = bridge.zoneHeight + bridge.marginTop
            root._dragging = true
        }
        onPositionChanged: function (mouse) {
            if (pressed) {
                _pendingHeight = _startHeight + (mouse.screenY - _startScreenY)
                if (!coalesce.running) coalesce.start()
            }
        }
        onReleased: {
            coalesce.stop()
            bridge.setZoneHeight(_pendingHeight)
            root._dragging = false
            // Bridge has already marked dirty and scheduled a debounced save.
            // Explicitly flush so drag-release is durable without waiting 500 ms.
            bridge.saveConfig()
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
