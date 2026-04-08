import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

Rectangle {
    id: root
    width: 420
    height: 370
    radius: theme.radiusPanel
    color: theme.bgPanel

    QtObject {
        id: theme
        readonly property color bgPanel: "#0a0a0c"
        readonly property color bgSurface: "#141417"
        readonly property color bgSurfaceMuted: "#1d1d1f"
        readonly property color textPrimary: "#ffffff"
        readonly property color textSecondary: "#b3b3b8"
        readonly property color textMuted: "#8b8b91"
        readonly property color accentBlue: "#0071e3"
        readonly property color stateCorrect: "#8cd58a"
        readonly property color stateSmallIssue: "#e6c66a"
        readonly property color stateStrongIssue: "#ff6a6a"
        readonly property int radiusPanel: 22
        readonly property int radiusCard: 16
        readonly property int radiusTag: 10
        readonly property int radiusPill: 980
    }

    property string feedbackState: "correct" // correct | small_issue | strong_issue
    property string displayText: "No issues here."
    property string displayBefore: ""
    property string displayAfter: ""
    property string tipText: "More natural: 'How is it going?'"
    property string categoryText: "expression"
    property bool canPin: true
    property bool pinned: false

    signal dismissRequested()
    signal pinToggled(bool pinned)

    function stateColor() {
        if (feedbackState === "small_issue") {
            return theme.stateSmallIssue;
        }
        if (feedbackState === "strong_issue") {
            return theme.stateStrongIssue;
        }
        return theme.stateCorrect;
    }

    function stateLabel() {
        if (feedbackState === "small_issue") {
            return "Small issue";
        }
        if (feedbackState === "strong_issue") {
            return "Strong issue";
        }
        return "Correct";
    }

    function formatDisplayText() {
        if (feedbackState === "correct") {
            return displayText;
        }
        if (displayBefore.length > 0 && displayAfter.length > 0) {
            return "<span style='color:#ff6a6a;text-decoration:line-through;'>" + displayBefore + "</span>" +
                " <span style='color:#8ddc8a;'>-> " + displayAfter + "</span>";
        }

        // Contract: display_text mapping is "before -> after" with a single spaced delimiter.
        // If ambiguous (0 or multiple delimiters), render plain text instead of guessing.
        var marker = " -> ";
        var firstIdx = displayText.indexOf(marker);
        if (firstIdx < 0) {
            return displayText;
        }
        var secondIdx = displayText.indexOf(marker, firstIdx + marker.length);
        if (secondIdx >= 0) {
            return displayText;
        }

        var before = displayText.slice(0, firstIdx).trim();
        var after = displayText.slice(firstIdx + marker.length).trim();
        if (before.length === 0 || after.length === 0) {
            return displayText;
        }
        return "<span style='color:#ff6a6a;text-decoration:line-through;'>" + before + "</span>" +
            " <span style='color:#8ddc8a;'>-> " + after + "</span>";
    }

    Rectangle {
        anchors.fill: parent
        anchors.margins: 1
        radius: theme.radiusPanel - 1
        color: "#020204"
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 16
        spacing: 12

        RowLayout {
            Layout.fillWidth: true

            RowLayout {
                spacing: 8

                Rectangle {
                    width: 28
                    height: 28
                    radius: 8
                    color: "#1b1b1e"
                    border.color: "#2e2e34"
                    border.width: 1

                    Text {
                        anchors.centerIn: parent
                        text: "!"
                    color: theme.textMuted
                        font.pixelSize: 12
                        font.weight: Font.DemiBold
                    }
                }

                Rectangle {
                    width: 28
                    height: 28
                    radius: 8
                    color: "#1b1b1e"
                    border.color: "#2e2e34"
                    border.width: 1

                    Text {
                        anchors.centerIn: parent
                        text: "*"
                        color: theme.textMuted
                        font.pixelSize: 12
                        font.weight: Font.DemiBold
                    }
                }
            }

            Item {
                Layout.fillWidth: true
            }

            Rectangle {
                radius: theme.radiusPill
                color: Qt.rgba(root.stateColor().r, root.stateColor().g, root.stateColor().b, 0.16)
                border.color: Qt.rgba(root.stateColor().r, root.stateColor().g, root.stateColor().b, 0.35)
                border.width: 1
                Layout.alignment: Qt.AlignVCenter
                implicitHeight: 30
                implicitWidth: 108

                Text {
                    anchors.centerIn: parent
                    text: root.stateLabel()
                    color: root.stateColor()
                    font.pixelSize: 13
                    font.weight: Font.DemiBold
                    font.letterSpacing: -0.2
                }
            }

            Button {
                visible: root.canPin
                text: root.pinned ? "UNPIN" : "PIN"
                onClicked: {
                    root.pinned = !root.pinned;
                    root.pinToggled(root.pinned);
                }
                background: Rectangle {
                    radius: 8
                    color: parent.down ? "#28282a" : "#1b1b1e"
                    border.color: root.pinned ? theme.accentBlue : "#2e2e34"
                    border.width: 1
                }
                contentItem: Text {
                    text: parent.text
                    color: root.pinned ? theme.accentBlue : theme.textSecondary
                    font.pixelSize: 11
                    font.weight: Font.DemiBold
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                }
            }

            Button {
                text: "x"
                onClicked: root.dismissRequested()
                background: Rectangle {
                    radius: 8
                    color: parent.down ? "#28282a" : "#1b1b1e"
                    border.color: "#2e2e34"
                    border.width: 1
                }
                contentItem: Text {
                    text: parent.text
                    color: theme.textSecondary
                    font.pixelSize: 12
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            height: 40
            radius: theme.radiusTag
            color: theme.bgSurface

            RowLayout {
                anchors.fill: parent
                anchors.margins: 4
                spacing: 6

                Rectangle {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    radius: theme.radiusTag - 2
                    color: "#0e0f11"
                    border.color: Qt.rgba(root.stateColor().r, root.stateColor().g, root.stateColor().b, 0.5)
                    border.width: 1

                    Text {
                        anchors.centerIn: parent
                        text: "Tips"
                        color: theme.textPrimary
                        font.pixelSize: 16
                        font.weight: Font.DemiBold
                        font.letterSpacing: -0.25
                        font.family: "SF Pro Display, SF Pro Text, Helvetica Neue, Helvetica, Arial"
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    radius: theme.radiusTag - 2
                    color: "transparent"

                    Text {
                        anchors.centerIn: parent
                        text: "Stats"
                        color: theme.textMuted
                        font.pixelSize: 16
                        font.weight: Font.Normal
                        font.letterSpacing: -0.25
                        font.family: "SF Pro Display, SF Pro Text, Helvetica Neue, Helvetica, Arial"
                    }
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            radius: theme.radiusCard
            color: Qt.rgba(root.stateColor().r, root.stateColor().g, root.stateColor().b, 0.14)
            border.color: Qt.rgba(root.stateColor().r, root.stateColor().g, root.stateColor().b, 0.28)
            border.width: 1
            implicitHeight: stateText.implicitHeight + 20

            Text {
                id: stateText
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter
                anchors.leftMargin: 14
                anchors.rightMargin: 14
                text: root.formatDisplayText()
                textFormat: Text.RichText
                color: root.stateColor()
                font.pixelSize: 34
                font.weight: Font.DemiBold
                lineHeight: 1.07
                wrapMode: Text.WordWrap
                font.letterSpacing: -0.28
                font.family: "SF Pro Display, SF Pro Text, Helvetica Neue, Helvetica, Arial"
            }
        }

        Rectangle {
            Layout.fillWidth: true
            radius: theme.radiusCard
            color: theme.bgSurfaceMuted
            implicitHeight: tipTextItem.implicitHeight + 26

            Text {
                id: tipTextItem
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.top: parent.top
                anchors.margins: 13
                text: root.tipText
                color: theme.textSecondary
                font.pixelSize: 22
                font.weight: Font.Normal
                wrapMode: Text.WordWrap
                lineHeight: 1.2
                font.letterSpacing: -0.24
                font.family: "SF Pro Text, SF Pro Display, Helvetica Neue, Helvetica, Arial"
            }
        }

        Rectangle {
            Layout.alignment: Qt.AlignLeft
            radius: theme.radiusTag
            color: "#2b2c31"
            implicitHeight: 28
            implicitWidth: categoryChip.implicitWidth + 18

            Text {
                id: categoryChip
                anchors.centerIn: parent
                text: root.categoryText
                color: theme.textMuted
                font.pixelSize: 16
                font.weight: Font.DemiBold
                font.letterSpacing: -0.2
                font.family: "SF Pro Text, SF Pro Display, Helvetica Neue, Helvetica, Arial"
            }
        }
    }
}
