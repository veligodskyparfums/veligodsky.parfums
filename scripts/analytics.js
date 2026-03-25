(function () {
  "use strict";

  var config = window.VeligodskySiteConfig || {};
  var yandexMetrikaId = String(config.yandexMetrikaId || "").trim();
  var googleAnalyticsId = String(config.googleAnalyticsId || "").trim();

  function loadScript(src, onload) {
    var script = document.createElement("script");
    script.async = true;
    script.src = src;
    if (typeof onload === "function") {
      script.onload = onload;
    }
    document.head.appendChild(script);
  }

  function initYandexMetrika(id) {
    var metricId = Number(id);
    if (!Number.isFinite(metricId) || metricId <= 0) {
      return;
    }

    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () {
        (m[i].a = m[i].a || []).push(arguments);
      };
      m[i].l = 1 * new Date();
      k = e.createElement(t);
      a = e.getElementsByTagName(t)[0];
      k.async = 1;
      k.src = r;
      a.parentNode.insertBefore(k, a);
    })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

    window.ym(metricId, "init", {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: false
    });
  }

  function initGoogleAnalytics(id) {
    var safeId = String(id || "").trim();
    if (!safeId) {
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", safeId);

    loadScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(safeId));
  }

  function trackEvent(name, params) {
    var eventName = String(name || "").trim();
    if (!eventName) {
      return;
    }

    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, params || {});
    }

    var metricId = Number(yandexMetrikaId);
    if (typeof window.ym === "function" && Number.isFinite(metricId) && metricId > 0) {
      window.ym(metricId, "reachGoal", eventName);
    }
  }

  initYandexMetrika(yandexMetrikaId);
  initGoogleAnalytics(googleAnalyticsId);

  window.VeligodskyAnalytics = {
    trackEvent: trackEvent
  };
})();
