import QtQuick
import QtWebSockets
import Quickshell
import Quickshell.Wayland
import "." as Ui

Scope {
    id: root

    property string runtimeIngressMode: "ws"
    property string legacyRuntimeFilePath: ""
    property string runtimeWsUrl: "ws://127.0.0.1:4242"
    property bool isVisible: false
    property bool isPinned: false
    property string lastCloseReason: ""
    property bool manualAutoOpenBlocked: false
    property bool forceVisible: false
    property int autoHideSeconds: 8

    function parseRuntimeArgValue(flagName) {
        var args = Qt.application.arguments || [];
        var equalsPrefix = flagName + "=";
        for (var i = 0; i < args.length; i += 1) {
            var arg = args[i];
            if (arg.indexOf(equalsPrefix) === 0) {
                return arg.slice(equalsPrefix.length);
            }
            if (arg === flagName && i + 1 < args.length) {
                return args[i + 1];
            }
        }
        return "";
    }

    function parseBoolArgValue(flagName) {
        var raw = parseRuntimeArgValue(flagName);
        if (!raw || raw.length === 0) {
            return false;
        }
        var normalized = raw.toLowerCase();
        return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
    }

    function setOverlayVisibility(nextVisible, reason) {
        if (isVisible === nextVisible) {
            return;
        }
        isVisible = nextVisible;
        if (!nextVisible && reason === "manual-close") {
            lastCloseReason = "manual";
        } else if (!nextVisible && reason === "auto-close") {
            lastCloseReason = "auto";
        }
        console.log("[widget][overlay][visibility]", nextVisible ? "shown" : "hidden", "reason=" + reason, "pinned=" + isPinned, "manualBlocked=" + manualAutoOpenBlocked, "forceVisible=" + forceVisible);
    }

    function scheduleAutoHide() {
        if (isPinned || forceVisible) {
            autoHideTimer.stop();
            return;
        }
        autoHideTimer.restart();
        console.log("[widget][overlay][visibility] auto-hide scheduled in " + autoHideSeconds + "s");
    }

    function applyFeedbackVisibilityPolicy(feedback) {
        if (!feedback) {
            return;
        }
        var autoOpen = feedback.auto_open === true;
        if (isPinned) {
            setOverlayVisibility(true, "pinned-update");
            return;
        }
        if (autoOpen && !manualAutoOpenBlocked) {
            setOverlayVisibility(true, "auto-open");
            scheduleAutoHide();
            return;
        }
        if (autoOpen && manualAutoOpenBlocked) {
            console.log("[widget][overlay][visibility] auto-open blocked after manual close");
        }
    }

    Ui.RuntimeEventBridge {
        id: runtimeBridge
    }

    Connections {
        target: runtimeBridge
        function onWidgetFeedbackReceived(feedback) {
            if (!feedback) {
                return;
            }
            console.log("[widget][overlay][event] widget_feedback", "state=" + (feedback.state || ""), "auto_open=" + (feedback.auto_open === true));

            widget.feedbackState = feedback.state || widget.feedbackState;
            widget.displayText = feedback.display_text || widget.displayText;
            widget.displayBefore = "";
            widget.displayAfter = "";
            if (typeof feedback.fragment_before === "string" && typeof feedback.fragment_after === "string") {
                widget.displayBefore = feedback.fragment_before;
                widget.displayAfter = feedback.fragment_after;
            }
            widget.tipText = feedback.tip || widget.tipText;
            widget.categoryText = feedback.category || widget.categoryText;
            widget.canPin = feedback.can_pin !== undefined ? feedback.can_pin : widget.canPin;
            applyFeedbackVisibilityPolicy(feedback);
        }
    }

    WebSocket {
        id: runtimeWs
        active: runtimeIngressMode === "ws"
        url: runtimeWsUrl
        onStatusChanged: {
            console.log("[widget][overlay][ws] status=" + status);
        }
        onErrorStringChanged: {
            if (errorString && errorString.length > 0) {
                console.log("[widget][overlay][ws] error=" + errorString);
            }
        }
        onTextMessageReceived: function(message) {
            runtimeBridge.ingestNdjsonLine(message);
        }
    }

    Timer {
        id: autoHideTimer
        interval: autoHideSeconds * 1000
        repeat: false
        running: false
        onTriggered: {
            if (!isPinned && isVisible) {
                setOverlayVisibility(false, "auto-close");
            }
        }
    }

    PanelWindow {
        id: overlay
        visible: forceVisible || isPinned || isVisible
        color: "transparent"
        implicitWidth: 460
        implicitHeight: 410
        exclusionMode: ExclusionMode.Ignore

        WlrLayershell.namespace: "engflow-widget"
        WlrLayershell.layer: WlrLayer.Overlay
        WlrLayershell.keyboardFocus: WlrKeyboardFocus.None

        anchors {
            top: true
            right: true
        }

        Ui.EngFlowWidget {
            id: widget
            anchors.centerIn: parent
            feedbackState: "small_issue"
            displayText: "I need learn -> I need to learn"
            tipText: "'need' requires 'to' before the next verb."
            categoryText: "grammar"

            onPinToggled: function(pinned) {
                isPinned = pinned === true;
                console.log("[widget][overlay][pin]", isPinned ? "pinned" : "unpinned");
                if (isPinned) {
                    manualAutoOpenBlocked = false;
                    autoHideTimer.stop();
                    setOverlayVisibility(true, "pin-on");
                } else if (isVisible) {
                    scheduleAutoHide();
                }
            }

            onDismissRequested: {
                isPinned = false;
                manualAutoOpenBlocked = true;
                autoHideTimer.stop();
                setOverlayVisibility(false, "manual-close");
            }
        }
    }

    Component.onCompleted: {
        runtimeIngressMode = parseRuntimeArgValue("--runtime-ingress");
        legacyRuntimeFilePath = parseRuntimeArgValue("--runtime-file");
        var wsArg = parseRuntimeArgValue("--runtime-ws-url");
        if (wsArg.length > 0) {
            runtimeWsUrl = wsArg;
        }

        forceVisible = parseBoolArgValue("--force-visible");
        if (forceVisible) {
            manualAutoOpenBlocked = false;
            setOverlayVisibility(true, "force-visible");
        }

        if (!runtimeIngressMode && legacyRuntimeFilePath.length > 0) {
            runtimeIngressMode = "legacy-file";
        }
        if (!runtimeIngressMode) {
            runtimeIngressMode = "ws";
        }

        if (runtimeIngressMode === "legacy-file") {
            runtimeBridge.beginLegacyFileIngress(legacyRuntimeFilePath);
        } else {
            runtimeBridge.beginLegacyFileIngress("");
        }

        console.log("[widget][overlay][runtime] ingress=" + runtimeIngressMode, "wsUrl=" + runtimeWsUrl, "forceVisible=" + forceVisible);
    }
}
