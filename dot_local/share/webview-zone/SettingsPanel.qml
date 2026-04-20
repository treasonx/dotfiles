// Non-modal right-anchored settings panel (Enhancement #3).
// Single ScrollView with section headers — not a TabBar. SplitView below
// stays interactive so edits give live visual feedback.
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Popup {
    id: panel

    // Emitted so main.qml can toggle WebEngineView.lifecycleState
    // without SettingsPanel reaching into split.itemAt(i) across files.
    signal requestFreezePanes()
    signal requestUnfreezePanes()

    modal: false
    width: 420
    height: parent ? Math.min(parent.height - 48, 640) : 640
    x: parent ? Math.round((parent.width - width) / 2) : 0
    y: parent ? Math.round((parent.height - height) / 2) : 0
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutsideParent
    padding: 0

    onOpened: panel.requestFreezePanes()
    onClosed: panel.requestUnfreezePanes()

    // Catppuccin Mocha palette — matches the rest of the dotfiles' feel.
    readonly property color colBase: "#1e1e2e"
    readonly property color colMantle: "#181825"
    readonly property color colCrust: "#11111b"
    readonly property color colSurface0: "#313244"
    readonly property color colText: "#cdd6f4"
    readonly property color colSubtext: "#bac2de"
    readonly property color colMuted: "#6c7086"
    readonly property color colRed: "#f38ba8"
    readonly property color colYellow: "#f9e2af"

    background: Rectangle {
        color: panel.colBase
        border.color: panel.colSurface0
        border.width: 1
    }

    // Inline components keep this self-contained in a single file.
    component SectionHeader: Rectangle {
        property string title
        Layout.fillWidth: true
        Layout.preferredHeight: 32
        color: panel.colCrust
        Label {
            anchors.verticalCenter: parent.verticalCenter
            anchors.left: parent.left
            anchors.leftMargin: 14
            text: parent.title.toUpperCase()
            color: panel.colMuted
            font.pixelSize: 10
            font.bold: true
            font.letterSpacing: 1.2
        }
    }

    component RestartTag: Label {
        text: "restart required"
        color: panel.colYellow
        font.pixelSize: 10
        font.italic: true
    }

    component SettingsLabel: Label {
        color: panel.colSubtext
        font.pixelSize: 12
    }

    component FieldInput: TextField {
        color: panel.colText
        selectByMouse: true
        placeholderTextColor: panel.colMuted
        background: Rectangle {
            color: panel.colBase
            border.color: parent.activeFocus ? panel.colSurface0 : Qt.darker(panel.colSurface0, 1.4)
            border.width: 1
            radius: 4
        }
    }

    contentItem: ColumnLayout {
        spacing: 0

        // Header with close button.
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 44
            color: panel.colMantle
            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 14
                anchors.rightMargin: 6
                spacing: 8
                Label {
                    text: "Settings"
                    color: panel.colText
                    font.pixelSize: 15
                    font.bold: true
                    Layout.fillWidth: true
                }
                Button {
                    text: "×"
                    flat: true
                    onClicked: panel.close()
                    contentItem: Label { text: parent.text; color: panel.colText; font.pixelSize: 18; horizontalAlignment: Text.AlignHCenter; verticalAlignment: Text.AlignVCenter }
                }
            }
        }

        ScrollView {
            id: scroll
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            ScrollBar.horizontal.policy: ScrollBar.AlwaysOff

            ColumnLayout {
                id: body
                width: scroll.availableWidth
                spacing: 0

                // ======================== LAYOUT ========================
                SectionHeader { title: "Layout" }

                // Zone height — live-apply (slider + spinbox, bound to bridge).
                ColumnLayout {
                    Layout.fillWidth: true
                    Layout.leftMargin: 14
                    Layout.rightMargin: 14
                    Layout.topMargin: 12
                    Layout.bottomMargin: 4
                    spacing: 4
                    SettingsLabel { text: "Zone height" }
                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 8
                        Slider {
                            id: zhSlider
                            Layout.fillWidth: true
                            from: 80
                            to: Math.max(from, Math.floor(0.8 * (bridge.geometry[1] || 2160)))
                            stepSize: 1
                            value: bridge.zoneHeight
                            live: true
                            onMoved: bridge.setZoneHeight(Math.round(value))
                        }
                        SpinBox {
                            from: zhSlider.from
                            to: zhSlider.to
                            value: bridge.zoneHeight
                            editable: true
                            onValueModified: bridge.setZoneHeight(value)
                        }
                    }
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    Layout.leftMargin: 14
                    Layout.rightMargin: 14
                    Layout.topMargin: 8
                    Layout.bottomMargin: 12
                    spacing: 4
                    SettingsLabel { text: "Margins (top · left · right)" }
                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 6
                        SpinBox { from: 0; to: 64; value: bridge.marginTop; editable: true; onValueModified: bridge.setMargins(value, bridge.marginLeft, bridge.marginRight) }
                        SpinBox { from: 0; to: 64; value: bridge.marginLeft; editable: true; onValueModified: bridge.setMargins(bridge.marginTop, value, bridge.marginRight) }
                        SpinBox { from: 0; to: 64; value: bridge.marginRight; editable: true; onValueModified: bridge.setMargins(bridge.marginTop, bridge.marginLeft, value) }
                    }
                }

                // ======================== PANES ========================
                SectionHeader { title: "Panes" }

                Repeater {
                    id: paneRepeater
                    model: bridge.urlsModel
                    delegate: Rectangle {
                        required property int index
                        required property string url
                        required property real zoom
                        Layout.fillWidth: true
                        Layout.preferredHeight: urlCol.implicitHeight + 16
                        color: panel.colMantle
                        border.color: panel.colCrust
                        border.width: 1

                        ColumnLayout {
                            id: urlCol
                            anchors.fill: parent
                            anchors.margins: 8
                            spacing: 6

                            SettingsLabel {
                                text: "Pane " + (index + 1)
                                font.bold: true
                            }

                            RowLayout {
                                Layout.fillWidth: true
                                spacing: 6
                                SettingsLabel { text: "URL" }
                                Item { Layout.fillWidth: true }
                                RestartTag { }
                            }
                            FieldInput {
                                id: urlField
                                Layout.fillWidth: true
                                text: url
                                placeholderText: "https://…"
                                onEditingFinished: if (text.trim() !== url) bridge.setUrl(index, text.trim())
                            }

                            RowLayout {
                                Layout.fillWidth: true
                                spacing: 6
                                SettingsLabel { text: "Zoom" }
                                Slider {
                                    id: zoomSlider
                                    Layout.fillWidth: true
                                    from: 0.25
                                    to: 5.0
                                    stepSize: 0.05
                                    value: zoom
                                    live: true
                                    onMoved: bridge.setUrlZoom(index, value)
                                }
                                SettingsLabel { text: zoomSlider.value.toFixed(2) + "×"; Layout.minimumWidth: 40 }
                            }

                            RowLayout {
                                Layout.fillWidth: true
                                spacing: 6
                                Button {
                                    text: "↑"
                                    enabled: index > 0
                                    onClicked: bridge.reorderUrl(index, index - 1)
                                }
                                Button {
                                    text: "↓"
                                    enabled: index < paneRepeater.count - 1
                                    onClicked: bridge.reorderUrl(index, index + 1)
                                }
                                Item { Layout.fillWidth: true }
                                Button {
                                    text: "Remove"
                                    enabled: paneRepeater.count > 1
                                    onClicked: bridge.removeUrl(index)
                                }
                            }
                        }
                    }
                }

                // Add-URL row.
                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: addRow.implicitHeight + 16
                    color: panel.colBase

                    RowLayout {
                        id: addRow
                        anchors.fill: parent
                        anchors.margins: 8
                        spacing: 6
                        FieldInput {
                            id: addUrlField
                            Layout.fillWidth: true
                            placeholderText: "Add URL…"
                        }
                        Button {
                            text: "Add"
                            enabled: addUrlField.text.trim().length > 0
                            onClicked: {
                                bridge.addUrl(addUrlField.text.trim())
                                addUrlField.text = ""
                            }
                        }
                    }
                }

                // ======================== OUTPUT ========================
                SectionHeader { title: "Output" }

                ColumnLayout {
                    Layout.fillWidth: true
                    Layout.leftMargin: 14
                    Layout.rightMargin: 14
                    Layout.topMargin: 12
                    Layout.bottomMargin: 4
                    spacing: 4
                    RowLayout {
                        Layout.fillWidth: true
                        SettingsLabel { text: "Output name"; Layout.fillWidth: true }
                        RestartTag { }
                    }
                    FieldInput {
                        id: outputField
                        Layout.fillWidth: true
                        text: bridge.output
                        placeholderText: "HDMI-A-1"
                        onEditingFinished: if (text.trim() !== bridge.output) bridge.setOutput(text.trim())
                    }
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    Layout.leftMargin: 14
                    Layout.rightMargin: 14
                    Layout.topMargin: 8
                    Layout.bottomMargin: 16
                    spacing: 4
                    RowLayout {
                        Layout.fillWidth: true
                        SettingsLabel { text: "Geometry fallback (w × h)"; Layout.fillWidth: true }
                        RestartTag { }
                    }
                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 6
                        SpinBox { id: geomW; from: 0; to: 99999; value: bridge.geometry[0]; editable: true; onValueModified: bridge.setGeometry(value, geomH.value) }
                        SettingsLabel { text: "×"; Layout.alignment: Qt.AlignVCenter }
                        SpinBox { id: geomH; from: 0; to: 99999; value: bridge.geometry[1]; editable: true; onValueModified: bridge.setGeometry(geomW.value, value) }
                    }
                }
            }
        }

        // Bottom restart-required banner (Enhancement #4).
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 56
            visible: bridge.restartRequired
            color: panel.colRed

            RowLayout {
                anchors.fill: parent
                anchors.margins: 10
                spacing: 10
                Label {
                    Layout.fillWidth: true
                    color: panel.colCrust
                    text: bridge.supervisorDetected
                        ? "Some changes need a restart to apply."
                        : "Some changes need a manual restart.\npkill -f webview_zone && webview_zone &disown"
                    wrapMode: Text.WordWrap
                    font.pixelSize: 11
                    font.bold: true
                }
                Button {
                    text: "Restart now"
                    visible: bridge.supervisorDetected
                    onClicked: bridge.requestRestart()
                }
            }
        }
    }
}
