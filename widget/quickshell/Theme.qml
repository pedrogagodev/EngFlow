pragma Singleton
import QtQuick 2.15

QtObject {
    readonly property color bgApp: "#000000"
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
    readonly property color correctedGreen: "#8ddc8a"

    readonly property int radiusPanel: 22
    readonly property int radiusCard: 16
    readonly property int radiusTag: 10
    readonly property int radiusPill: 980

    readonly property int spacingXs: 6
    readonly property int spacingSm: 10
    readonly property int spacingMd: 14
    readonly property int spacingLg: 18
}
