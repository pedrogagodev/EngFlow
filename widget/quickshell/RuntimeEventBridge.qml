import QtQuick 2.15

QtObject {
    id: root

    signal widgetFeedbackReceived(var feedback)
    signal ingressStatusChanged(string status)

    property string ingressMode: "none"
    property string legacyRuntimeFilePath: ""
    property int legacyProcessedLineCount: 0
    property string _lineBuffer: ""

    // Preferred host/runtime boundary:
    // - ingestEventEnvelope(parsedObject)
    // - ingestNdjsonChunk(rawChunk)
    // QML-only preview can still use beginLegacyFileIngress() + pollLegacyRuntimeFile().
    function ingestEventEnvelope(envelope) {
        if (!envelope || envelope.type !== "widget_feedback" || !envelope.payload) {
            return false;
        }

        root.widgetFeedbackReceived(envelope.payload);
        return true;
    }

    function ingestNdjsonChunk(chunk) {
        if (typeof chunk !== "string" || chunk.length === 0) {
            return;
        }

        _lineBuffer += chunk;
        var lines = _lineBuffer.split("\n");
        _lineBuffer = lines.pop() || "";
        for (var i = 0; i < lines.length; i += 1) {
            ingestNdjsonLine(lines[i]);
        }
    }

    function ingestNdjsonLine(line) {
        if (!line || typeof line !== "string") {
            return false;
        }

        var parsed;
        try {
            parsed = JSON.parse(line);
        } catch (e) {
            return false;
        }

        return ingestEventEnvelope(parsed);
    }

    function beginLegacyFileIngress(filePath) {
        legacyRuntimeFilePath = filePath || "";
        legacyProcessedLineCount = 0;
        _lineBuffer = "";
        ingressMode = legacyRuntimeFilePath.length > 0 ? "legacy-file" : "none";
        ingressStatusChanged(ingressMode);
    }

    function pollLegacyRuntimeFile() {
        if (!legacyRuntimeFilePath) {
            return;
        }

        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if (xhr.readyState !== XMLHttpRequest.DONE || xhr.status !== 0) {
                return;
            }

            var content = xhr.responseText || "";
            var lines = content.split("\n");
            var completeLineCount = lines.length;
            if (content.length > 0 && content[content.length - 1] !== "\n") {
                completeLineCount -= 1;
            }

            for (var i = legacyProcessedLineCount; i < completeLineCount; i += 1) {
                ingestNdjsonLine(lines[i]);
            }
            legacyProcessedLineCount = completeLineCount;
        };
        xhr.open("GET", "file://" + legacyRuntimeFilePath + "?t=" + Date.now());
        xhr.send();
    }
}
