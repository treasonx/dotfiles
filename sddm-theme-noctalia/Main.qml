import QtQuick
import QtQuick.Controls as Controls
import QtQuick.Layouts
import QtQuick.Window
import Qt5Compat.GraphicalEffects

import SddmComponents 2.0

Rectangle {
    id: root
    width: Screen.width
    height: Screen.height

    // -------------------------------------------------------------------------
    // Responsive Scaling
    // -------------------------------------------------------------------------
    readonly property real scaleFactor: Math.max(0.5, Math.min(width / 1920, height / 1080))
    readonly property real baseUnit: 8 * scaleFactor
    
    // -------------------------------------------------------------------------
    // Theme Constants (Rose Pine) & Style Tokens
    //
    // Hex fallbacks below match theme.conf.default. The Noctalia shell
    // overwrites theme.conf at runtime with live palette values, so the
    // fallbacks here only fire on the very first greeter boot before the
    // shell has written anything. Keeping them in sync with
    // theme.conf.default by hand; if you change one, change the other.
    // -------------------------------------------------------------------------
    readonly property color mPrimary: config.mPrimary || "#c7a1d8"
    readonly property color mOnPrimary: config.mOnPrimary || "#1a151f"
    readonly property color mSurface: config.mSurface || "#1c1822"
    readonly property color mSurfaceVariant: config.mSurfaceVariant || "#262130"
    readonly property color mOnSurface: config.mOnSurface || "#e9e4f0"
    readonly property color mOnSurfaceVariant: config.mOnSurfaceVariant || "#a79ab0"
    readonly property color mError: config.mError || "#e9899d"
    readonly property color mOutline: config.mOutline || "#342c42"
    
    // Responsive sizes
    readonly property real radiusL: 20 * scaleFactor
    readonly property real fontSizeM: 11 * scaleFactor
    readonly property real fontSizeL: 13 * scaleFactor
    readonly property real fontSizeXL: 16 * scaleFactor
    readonly property real fontSizeXXL: 18 * scaleFactor
    readonly property real fontSizeClock: 42 * scaleFactor

    // Configurable Background
    readonly property string backgroundPath: config.background || "Assets/background.png"

    LayoutMirroring.enabled: Qt.locale().textDirection == Qt.RightToLeft
    LayoutMirroring.childrenInherit: true

    // Drives the clock / date re-render. QML bindings for `new Date()` don't
    // re-evaluate on their own (nothing in the dependency graph changes), so
    // without this Timer the clock freezes at the instant SDDM started.
    property var now: new Date()
    Timer {
        interval: 1000
        running: true
        repeat: true
        onTriggered: root.now = new Date()
    }

    // Solid dim overlay opacity — 0 = no dim, 1 = fully black. Default 0 means
    // raw wallpaper with no post-processing (cards have their own mSurface
    // background for readability). Gradients band on solid dark wallpapers;
    // blurs amplify low-frequency artifacts on textured dark ones; a flat
    // overlay sidesteps both if contrast is desired.
    readonly property real dimOpacity: config.dimOpacity !== undefined && config.dimOpacity !== ""
                                        ? parseFloat(config.dimOpacity) : 0.5

    // -------------------------------------------------------------------------
    // Background
    // -------------------------------------------------------------------------
    Image {
        id: wallpaper
        anchors.fill: parent
        source: root.backgroundPath
        fillMode: Image.PreserveAspectCrop
        sourceSize.width: Screen.width
        sourceSize.height: Screen.height
        asynchronous: true
        cache: true
        clip: true
        smooth: true
        mipmap: true
    }

    // Solid (not gradient) semi-transparent black overlay for UI contrast.
    // A single flat color has no interpolation → no banding, and no blur
    // convolution → no amplified low-frequency source artifacts.
    Rectangle {
        anchors.fill: parent
        color: Qt.rgba(0, 0, 0, root.dimOpacity)
    }


    // -------------------------------------------------------------------------
    // Top Card: User Info & Time
    // -------------------------------------------------------------------------
    Rectangle {
        id: headerCard
        anchors.top: parent.top
        anchors.topMargin: parent.height * 0.12
        anchors.horizontalCenter: parent.horizontalCenter
        
        width: Math.max(400 * scaleFactor, Math.min(parent.width * 0.70, 550 * scaleFactor))
        height: 120 * scaleFactor
        radius: root.radiusL
        color: root.mSurface
        border.color: Qt.rgba(root.mOutline.r, root.mOutline.g, root.mOutline.b, 0.2)
        border.width: 1 * scaleFactor

        RowLayout {
            id: headerRow
            anchors.fill: parent
            anchors.margins: 16 * scaleFactor
            spacing: 32 * scaleFactor

            // Avatar - Perfect Circle
            Item {
                id: avatarRect
                Layout.preferredWidth: 70 * scaleFactor
                Layout.preferredHeight: 70 * scaleFactor
                Layout.alignment: Qt.AlignVCenter
                
                width: 70 * scaleFactor
                height: 70 * scaleFactor
                
                property int tryIndex: 0
                
                property string primaryUser: userModel.lastUser
                property string currentIcon: ""
                property string currentHome: ""
                property string currentRealName: ""
                property string firstUserName: ""

                // Data Extractor
                Repeater {
                    model: userModel
                    delegate: Item {
                        visible: false
                        
                        // Capture first user name as fallback
                        Binding {
                            target: avatarRect
                            property: "firstUserName"
                            value: model.name
                            when: index === 0
                        }

                        // Capture details if this matches primaryUser
                        Binding {
                            target: avatarRect // The Avatar Rectangle
                            property: "currentIcon"
                            value: model.icon
                            when: model.name === avatarRect.displayUser
                        }
                        Binding {
                            target: avatarRect // The Avatar Rectangle
                            property: "currentHome"
                            value: model.homeDir
                            when: model.name === avatarRect.displayUser
                        }
                         Binding {
                            target: avatarRect // The Avatar Rectangle
                            property: "currentRealName"
                            value: model.realName
                            when: model.name === avatarRect.displayUser
                        }
                    }
                }
                
                // Computed property for whom we are showing
                property string displayUser: primaryUser !== "" ? primaryUser : firstUserName
                property string displayName: currentRealName !== "" ? currentRealName : (displayUser !== "" ? displayUser : "User")
                
                // Reset try index when user changes
                onDisplayUserChanged: {
                    tryIndex = 0
                }
                
                // Get list of icon paths to try
                property var iconPaths: {
                    var paths = []
                    var u = displayUser
                    
                    if (u) {
                        // 1. Try path from userModel (if any)
                        if (currentIcon && currentIcon !== "") {
                            var p = currentIcon
                            if (p.indexOf("://") === -1 && p.charAt(0) === '/') 
                                p = "file://" + p
                            paths.push(p)
                        }
                        
                        // 2. Try home directory faces
                        if (currentHome) {
                            paths.push("file://" + currentHome + "/.face.icon")
                            paths.push("file://" + currentHome + "/.face")
                        }
                        
                        // 3. System paths
                        paths.push("file:///usr/share/sddm/faces/" + u + ".face.icon")
                        paths.push("file:///var/lib/AccountsService/icons/" + u)
                    }
                    
                    // 4. Default fallback
                    paths.push("file:///usr/share/sddm/faces/.face.icon")
                    
                    return paths
                }
                
                // Circular mask for perfect circle
                Rectangle {
                    id: avatarMask
                    anchors.fill: parent
                    radius: width / 2
                    visible: false
                }
                
                // User avatar image (circular)
                Image {
                    id: userAvatar
                    anchors.fill: parent
                    source: {
                        if (parent.iconPaths.length === 0) return ""
                        var idx = Math.min(parent.tryIndex, parent.iconPaths.length - 1)
                        return parent.iconPaths[idx]
                    }
                    sourceSize: Qt.size(70 * scaleFactor, 70 * scaleFactor)
                    fillMode: Image.PreserveAspectCrop
                    smooth: true
                    visible: status === Image.Ready
                    asynchronous: true
                    
                    layer.enabled: true
                    layer.effect: OpacityMask {
                        maskSource: avatarMask
                    }
                    
                    // Try next path if current one fails
                    onStatusChanged: {
                        if (status === Image.Error && parent.tryIndex < parent.iconPaths.length - 1) {
                            parent.tryIndex++
                        }
                    }
                }
                
                // Fallback logo if user avatar not available
                Image {
                    id: fallbackLogo
                    anchors.fill: parent
                    anchors.margins: 8 * scaleFactor
                    source: "Assets/logo.svg"
                    sourceSize: Qt.size(70 * scaleFactor, 70 * scaleFactor)
                    fillMode: Image.PreserveAspectFit
                    smooth: true
                    visible: userAvatar.status !== Image.Ready && userAvatar.status !== Image.Loading
                    
                    layer.enabled: true
                    layer.effect: OpacityMask {
                        maskSource: avatarMask
                    }
                }
                
                // Circular border
                Rectangle {
                    anchors.fill: parent
                    radius: width / 2
                    color: "transparent"
                    border.color: root.mPrimary
                    border.width: 2 * scaleFactor
                }
            }
            
            // Text Info
            ColumnLayout {
                Layout.alignment: Qt.AlignVCenter
                spacing: 2 * scaleFactor
                
                Text {
                    text: "Welcome back, " + avatarRect.displayName + "!"
                    font.pixelSize: root.fontSizeXXL
                    font.bold: true
                    color: root.mOnSurface
                }
                
                Text {
                    text: Qt.formatDate(root.now, "dddd, MMMM d")
                    font.pixelSize: root.fontSizeXL
                    color: root.mOnSurfaceVariant
                }
            }

            Item { Layout.fillWidth: true } // Spacer

            // Clock
            Text {
                text: Qt.formatTime(root.now, "hh:mm")
                font.pixelSize: root.fontSizeClock
                font.bold: true
                color: root.mOnSurface
                Layout.alignment: Qt.AlignVCenter
            }
        }
    }
    
    // -------------------------------------------------------------------------
    // Bottom Card: Password & Controls
    // -------------------------------------------------------------------------
    Rectangle {
        id: bottomCard
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 100 * scaleFactor
        anchors.horizontalCenter: parent.horizontalCenter
        
        width: Math.min(750 * scaleFactor, parent.width * 0.9)
        height: 140 * scaleFactor
        radius: root.radiusL
        color: root.mSurface
        border.color: Qt.rgba(root.mOutline.r, root.mOutline.g, root.mOutline.b, 0.2)
        border.width: 1 * scaleFactor

        // CapsLock warning — the most common silent cause of "password
        // rejected" after a fresh boot. Overlay in the top-right so it
        // doesn't reflow the password row.
        Text {
            visible: keyboard.capsLock
            anchors.top: parent.top
            anchors.right: parent.right
            anchors.topMargin: 8 * scaleFactor
            anchors.rightMargin: 16 * scaleFactor
            text: "⇪ " + textConstants.capslockWarning
            color: root.mError
            font.pixelSize: root.fontSizeM
            font.bold: true
            z: 1
        }

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 20 * scaleFactor
            spacing: 15 * scaleFactor
            
            // Password Field Row
            RowLayout {
                Layout.fillWidth: true
                Layout.preferredHeight: 50 * scaleFactor
                spacing: 15 * scaleFactor
                
                // Input Box
                Rectangle {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    color: root.mSurfaceVariant
                    radius: 12 * scaleFactor
                    
                    TextInput {
                        id: passwordBox
                        anchors.fill: parent
                        anchors.margins: 15 * scaleFactor
                        verticalAlignment: Text.AlignVCenter
                        
                        text: ""
                        echoMode: TextInput.Password
                        color: root.mOnSurface
                        font.pixelSize: 14 * scaleFactor
                        
                        focus: true

                        onAccepted: sddm.login(avatarRect.displayUser, passwordBox.text, sessionList.currentIndex)

                        // Clear any stale auth-failure banner as soon as the
                        // user starts typing again.
                        onTextChanged: errorMessage.text = ""
                    }

                    Text {
                        anchors.fill: parent
                        anchors.margins: 15 * scaleFactor
                        verticalAlignment: Text.AlignVCenter
                        text: textConstants.promptPassword
                        color: Qt.rgba(root.mOnSurfaceVariant.r, root.mOnSurfaceVariant.g, root.mOnSurfaceVariant.b, 0.5)
                        font.pixelSize: 14 * scaleFactor
                        visible: !passwordBox.text && !passwordBox.activeFocus
                    }
                }
                
                // Login Button
                Controls.Button {
                    Layout.preferredWidth: 100 * scaleFactor
                    Layout.fillHeight: true
                    
                    background: Rectangle {
                        color: parent.down ? Qt.darker(root.mPrimary, 1.2) : root.mPrimary
                        radius: 12 * scaleFactor
                    }
                    
                    contentItem: Text {
                        text: "Login"
                        font.pixelSize: 14 * scaleFactor
                        font.bold: true
                        color: root.mOnPrimary
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                    }
                    
                    onClicked: sddm.login(avatarRect.displayUser, passwordBox.text, sessionList.currentIndex)
                }
            }
            
            // Controls Row
            RowLayout {
                Layout.fillWidth: true
                spacing: 10 * scaleFactor
                
                // Session List
                Controls.ComboBox {
                   id: sessionList
                   model: sessionModel
                   textRole: "name"
                   currentIndex: sessionModel.lastIndex
                   
                   Layout.preferredWidth: 200 * scaleFactor
                   Layout.preferredHeight: 36 * scaleFactor
                   
                   delegate: Controls.ItemDelegate {
                       width: parent.width
                       text: model.name || ""
                       highlighted: sessionList.highlightedIndex === index
                       contentItem: Text {
                           text: parent.text
                           color: root.mOnSurface
                           font.pixelSize: root.fontSizeM
                           verticalAlignment: Text.AlignVCenter
                       }
                       background: Rectangle {
                           color: parent.highlighted ? root.mSurfaceVariant : "transparent"
                       }
                   }
                   
                   background: Rectangle {
                       color: root.mSurfaceVariant
                       radius: 8 * scaleFactor
                   }
                   
                   contentItem: Text {
                       leftPadding: 10 * scaleFactor
                       text: sessionList.displayText || ""
                       color: root.mOnSurface
                       font.pixelSize: root.fontSizeM
                       verticalAlignment: Text.AlignVCenter
                   }

                   popup: Controls.Popup {
                       y: sessionList.height - 1
                       width: sessionList.width
                       implicitHeight: contentItem.implicitHeight
                       padding: 1 * scaleFactor

                       contentItem: ListView {
                           clip: true
                           implicitHeight: contentHeight
                           model: sessionList.popup.visible ? sessionList.delegateModel : null
                           currentIndex: sessionList.highlightedIndex
                           Controls.ScrollIndicator.vertical: Controls.ScrollIndicator { }
                       }

                       background: Rectangle {
                           border.color: root.mOutline
                           color: root.mSurface
                           radius: 4 * scaleFactor
                       }
                   }
               }
                
                Item { Layout.fillWidth: true } // Spacer
                
                // Power Buttons. `enabled` is gated on the matching capability
                // flag exposed by the sddm proxy — on systems where logind
                // denies the action (restricted VMs, enterprise polkit rules)
                // the button renders dimmed rather than silently no-op'ing.
                Repeater {
                    model: [
                        { text: "Suspend",  type: "suspend",  cap: "canSuspend"  },
                        { text: "Reboot",   type: "reboot",   cap: "canReboot"   },
                        { text: "Shutdown", type: "shutdown", cap: "canPowerOff" }
                    ]

                    delegate: Controls.Button {
                        text: modelData.text
                        Layout.preferredHeight: 36 * scaleFactor
                        Layout.preferredWidth: 100 * scaleFactor

                        enabled: modelData.cap === "canSuspend"  ? sddm.canSuspend
                               : modelData.cap === "canReboot"   ? sddm.canReboot
                                                                 : sddm.canPowerOff
                        opacity: enabled ? 1.0 : 0.4

                        background: Rectangle {
                            color: parent.down ? Qt.darker(root.mSurfaceVariant, 1.2) : root.mSurfaceVariant
                            radius: 8 * scaleFactor
                        }

                        contentItem: Text {
                            text: parent.text
                            font.pixelSize: root.fontSizeM
                            color: root.mOnSurface
                            horizontalAlignment: Text.AlignHCenter
                            verticalAlignment: Text.AlignVCenter
                        }

                        onClicked: {
                            if (modelData.type === "suspend") {
                                sddm.suspend()
                            } else if (modelData.type === "reboot") {
                                sddm.reboot()
                            } else if (modelData.type === "shutdown") {
                                sddm.powerOff()
                            }
                        }
                    }
                }
            }
        }
    }
    
    // -------------------------------------------------------------------------
    // Error Message
    // -------------------------------------------------------------------------
     Rectangle {
        width: errorMessage.implicitWidth + 40 * scaleFactor
        height: 50 * scaleFactor
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: bottomCard.top
        anchors.bottomMargin: 20 * scaleFactor
        radius: root.radiusL
        color: root.mError
        visible: errorMessage.text !== ""
        
        Text {
            id: errorMessage
            anchors.centerIn: parent
            text: "" // Set by signal
            color: "#1e1418" // mOnError
            font.pixelSize: root.fontSizeM
            font.bold: true
        }
    }

    Connections {
        target: sddm
        function onLoginFailed() {
            passwordBox.text = ""
            errorMessage.text = textConstants.loginFailed
        }
        function onLoginSucceeded() {
            // Clear the plaintext password out of the QString heap before
            // the greeter tears down — hygiene, not a security boundary.
            passwordBox.text = ""
            errorMessage.text = ""
        }
        function onInformationMessage(message) {
            // PAM relays non-failure notices through here — "password
            // expires in N days", "account locked", "change required",
            // etc. Surfacing them matters; silently dropping leaves the
            // user confused about a refused or partially-succeeded login.
            errorMessage.text = message
        }
    }
}
