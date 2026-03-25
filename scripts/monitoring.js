(function () {
  "use strict";

  var config = window.VeligodskySiteConfig || {};
  var reportingEnabled = Boolean(config.enableClientErrorReporting);
  var endpoint = String(config.clientErrorEndpoint || "/api/client-errors").trim();

  if (!reportingEnabled || !endpoint) {
    return;
  }

  function sendError(payload) {
    var body = JSON.stringify(payload || {});

    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(endpoint, blob);
        return;
      }
    } catch (error) {
      // ignore and fallback to fetch
    }

    try {
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: body,
        keepalive: true
      }).catch(function () {
        return;
      });
    } catch (error) {
      return;
    }
  }

  window.addEventListener("error", function (event) {
    sendError({
      type: "window.error",
      message: String(event && event.message || ""),
      file: String(event && event.filename || ""),
      line: Number(event && event.lineno || 0),
      column: Number(event && event.colno || 0),
      stack: String(event && event.error && event.error.stack || ""),
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
  });

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event && event.reason;
    sendError({
      type: "window.unhandledrejection",
      message: String(reason && reason.message || reason || ""),
      stack: String(reason && reason.stack || ""),
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    });
  });
})();
