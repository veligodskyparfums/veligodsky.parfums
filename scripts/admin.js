(function () {
  "use strict";

  var store = window.VeligodskyStore;
  if (!store) {
    return;
  }

  var AUTH_KEY = "veligodsky_admin_auth";
  var EDITOR_DRAFT_KEY = "veligodsky_admin_editor_draft_v1";
  var EDITOR_DRAFT_FALLBACK_KEY = "veligodsky_admin_editor_draft_v1_session";
  var MAX_UPLOAD_FILE_SIZE = 12 * 1024 * 1024;
  var MAX_IMAGE_DATA_LENGTH = 900 * 1024;
  var MAX_IMAGE_DIMENSION = 1200;
  var MIN_IMAGE_DIMENSION = 500;
  var IMAGE_QUALITY_START = 0.82;
  var IMAGE_QUALITY_MIN = 0.5;
  var CAPACITY_CHECK_INTERVAL_MS = 30 * 1000;
  var CAPACITY_REQUEST_TIMEOUT_MS = 8 * 1000;
  var CAPACITY_HISTORY_LIMIT = 10;
  var CAPACITY_TOAST_COOLDOWN_MS = 3 * 60 * 1000;
  var CAPACITY_WARNING_HEALTH_MS = 800;
  var CAPACITY_WARNING_STORE_MS = 1300;
  var CAPACITY_CRITICAL_HEALTH_MS = 1800;
  var CAPACITY_CRITICAL_STORE_MS = 2600;
  var CATALOG_PAGE_SIZE = 10;
  var CATALOG_AUTO_PREFETCH_ENABLED = false;
  var CATALOG_PREFETCH_DELAY_MS = 650;
  var SEARCH_INPUT_DEBOUNCE_MS = 160;
  var EDITOR_DRAFT_SAVE_DEBOUNCE_MS = 180;
  var PRODUCT_PLACEHOLDER_IMAGE = "/assets/product-placeholder.svg";

  var state = {
    editingId: null,
    imageData: "",
    heroImageData: "",
    aiDraftEditingId: null,
    aiDraftOpenedId: "",
    aiDraftImageData: "",
    aiDrafts: [],
    draftMemory: null,
    homepageReviewEditingId: null,
    catalogSearchQuery: "",
    catalogSearchDebounceTimer: null,
    catalogItems: [],
    catalogTotalCount: 0,
    catalogFilteredCount: 0,
    catalogHasMore: false,
    catalogNextOffset: 0,
    catalogLoading: false,
    catalogBackgroundLoading: false,
    catalogPrefetchTimer: null,
    catalogRequestId: 0,
    expandedProductReviews: {},
    capacityMonitor: {
      timerId: null,
      inFlight: false,
      history: [],
      lastLevel: "ok",
      lastToastAt: 0
    },
    imageIntegrityMonitor: {
      inFlight: false,
      lastLevel: "ok",
      lastToastAt: 0
    }
  };

  var elements = {};
  var toastTimer = null;
  var editorDraftSaveTimer = null;

  document.addEventListener("DOMContentLoaded", function () {
    init().catch(function () {
      openLogin();
      showToast("Не удалось загрузить данные сервера. Проверьте подключение.", true);
    });
  });

  async function init() {
    cacheElements();
    bindImageFallbacks();
    bindEvents();
    checkAuth();

    if (typeof store.init === "function") {
      try {
        await store.init({ skipRemote: true });
        if (isAuthenticated()) {
          refreshPanel();
        }
      } catch (error) {
        if (isAuthenticated()) {
          showToast("Не удалось синхронизировать данные с сервером. Работаем с локальным кэшем.", true);
        }
      }
    }
  }

  function cacheElements() {
    elements.loginView = document.getElementById("adminLoginView");
    elements.panelView = document.getElementById("adminPanelView");
    elements.loginForm = document.getElementById("adminLoginForm");
    elements.passwordInput = document.getElementById("adminPasswordInput");
    elements.logoutBtn = document.getElementById("adminLogoutBtn");
    elements.snapshotBtn = document.getElementById("adminSnapshotBtn");

    elements.settingsForm = document.getElementById("settingsForm");
    elements.telegramChannelInput = document.getElementById("telegramChannelInput");
    elements.telegramDmInput = document.getElementById("telegramDmInput");
    elements.freeShippingInput = document.getElementById("freeShippingInput");
    elements.adminPasswordNewInput = document.getElementById("adminPasswordNewInput");
    elements.backupNoticeEnabledInput = document.getElementById("backupNoticeEnabledInput");
    elements.heroImageInput = document.getElementById("heroImageInput");
    elements.heroImagePreview = document.getElementById("heroImagePreview");
    elements.heroImageClearBtn = document.getElementById("heroImageClearBtn");

    elements.perfumeForm = document.getElementById("perfumeForm");
    elements.editorTitle = document.getElementById("editorTitle");
    elements.perfumeIdInput = document.getElementById("perfumeIdInput");
    elements.perfumeNameInput = document.getElementById("perfumeNameInput");
    elements.perfumeBrandInput = document.getElementById("perfumeBrandInput");
    elements.perfumeGenderInput = document.getElementById("perfumeGenderInput");
    elements.perfumeBottleTypeInput = document.getElementById("perfumeBottleTypeInput");
    elements.perfumeDescriptionInput = document.getElementById("perfumeDescriptionInput");
    elements.perfumeImageInput = document.getElementById("perfumeImageInput");
    elements.perfumeImagePreview = document.getElementById("perfumeImagePreview");
    elements.topWeekInput = document.getElementById("topWeekInput");
    elements.topMonthInput = document.getElementById("topMonthInput");
    elements.addVolumeBtn = document.getElementById("addVolumeBtn");
    elements.volumesContainer = document.getElementById("volumesContainer");
    elements.cancelEditBtn = document.getElementById("cancelEditBtn");

    elements.aiDraftForm = document.getElementById("aiDraftForm");
    elements.aiDraftEditorTitle = document.getElementById("aiDraftEditorTitle");
    elements.aiDraftIdInput = document.getElementById("aiDraftIdInput");
    elements.aiDraftSourceInput = document.getElementById("aiDraftSourceInput");
    elements.aiDraftStatusInput = document.getElementById("aiDraftStatusInput");
    elements.aiDraftSourceUrlInput = document.getElementById("aiDraftSourceUrlInput");
    elements.aiDraftBrandInput = document.getElementById("aiDraftBrandInput");
    elements.aiDraftNameInput = document.getElementById("aiDraftNameInput");
    elements.aiDraftConfidenceInput = document.getElementById("aiDraftConfidenceInput");
    elements.aiDraftRawTextInput = document.getElementById("aiDraftRawTextInput");
    elements.aiDraftDescriptionInput = document.getElementById("aiDraftDescriptionInput");
    elements.aiDraftAnalysisInput = document.getElementById("aiDraftAnalysisInput");
    elements.aiDraftNotesInput = document.getElementById("aiDraftNotesInput");
    elements.aiDraftImageInput = document.getElementById("aiDraftImageInput");
    elements.aiDraftImagePreview = document.getElementById("aiDraftImagePreview");
    elements.aiDraftAddVolumeBtn = document.getElementById("aiDraftAddVolumeBtn");
    elements.aiDraftVolumesContainer = document.getElementById("aiDraftVolumesContainer");
    elements.aiDraftFillTestBtn = document.getElementById("aiDraftFillTestBtn");
    elements.aiDraftResetBtn = document.getElementById("aiDraftResetBtn");
    elements.adminAiDraftsMeta = document.getElementById("adminAiDraftsMeta");
    elements.adminAiDraftsList = document.getElementById("adminAiDraftsList");
    elements.aiDraftSelectionMeta = document.getElementById("aiDraftSelectionMeta");
    elements.aiDraftLivePreview = document.getElementById("aiDraftLivePreview");
    elements.aiDraftAnalysisPreview = document.getElementById("aiDraftAnalysisPreview");

    elements.adminProductsList = document.getElementById("adminProductsList");
    elements.adminCatalogSearchInput = document.getElementById("adminCatalogSearchInput");
    elements.adminCatalogSearchClearBtn = document.getElementById("adminCatalogSearchClearBtn");
    elements.adminCatalogMeta = document.getElementById("adminCatalogMeta");
    elements.adminCatalogLoadMoreBtn = document.getElementById("adminCatalogLoadMoreBtn");
    elements.homepageReviewForm = document.getElementById("homepageReviewForm");
    elements.homepageReviewsEditorTitle = document.getElementById("homepageReviewsEditorTitle");
    elements.homepageReviewIdInput = document.getElementById("homepageReviewIdInput");
    elements.homepageReviewAuthorInput = document.getElementById("homepageReviewAuthorInput");
    elements.homepageReviewCityInput = document.getElementById("homepageReviewCityInput");
    elements.homepageReviewRatingInput = document.getElementById("homepageReviewRatingInput");
    elements.homepageReviewTextInput = document.getElementById("homepageReviewTextInput");
    elements.homepageReviewResetBtn = document.getElementById("homepageReviewResetBtn");
    elements.adminPendingHomepageReviewsList = document.getElementById("adminPendingHomepageReviewsList");
    elements.adminHomepageReviewsList = document.getElementById("adminHomepageReviewsList");
    elements.toast = document.getElementById("adminToast");
    elements.capacityMonitor = null;
    elements.capacityStatus = null;
    elements.capacityMeta = null;
    elements.capacityRefreshBtn = null;
    elements.imageIntegrityMonitor = null;
    elements.imageIntegrityStatus = null;
    elements.imageIntegrityMeta = null;
    elements.imageIntegrityRefreshBtn = null;
    elements.imageIntegrityRepairBtn = null;
  }

  function bindImageFallbacks() {
    if (document.documentElement.dataset.adminProductImageFallbackBound === "1") {
      return;
    }

    document.documentElement.dataset.adminProductImageFallbackBound = "1";
    document.addEventListener("error", function (event) {
      var target = event && event.target;
      if (!target || target.tagName !== "IMG") {
        return;
      }

      var fallback = String(target.getAttribute("data-fallback-image") || "").trim();
      if (!fallback) {
        return;
      }

      if (target.dataset.fallbackApplied === "1") {
        return;
      }

      target.dataset.fallbackApplied = "1";
      target.src = fallback;
    }, true);
  }

  function bindEvents() {
    elements.loginForm.addEventListener("submit", onLogin);
    elements.logoutBtn.addEventListener("click", logout);
    if (elements.snapshotBtn) {
      elements.snapshotBtn.addEventListener("click", onCreateSnapshotClick);
    }

    elements.settingsForm.addEventListener("submit", saveSettings);
    if (elements.heroImageInput) {
      elements.heroImageInput.addEventListener("change", handleHeroImageUpload);
    }
    if (elements.heroImageClearBtn) {
      elements.heroImageClearBtn.addEventListener("click", clearHeroImage);
    }

    elements.addVolumeBtn.addEventListener("click", function () {
      appendVolumeRow();
      scheduleEditorDraftSave();
    });

    elements.volumesContainer.addEventListener("click", function (event) {
      var removeButton = event.target.closest(".remove-volume-btn");
      if (!removeButton) {
        return;
      }
      var row = removeButton.closest(".volume-row");
      if (!row) {
        return;
      }
      row.remove();
      if (!elements.volumesContainer.children.length) {
        appendVolumeRow();
      }
      scheduleEditorDraftSave();
    });

    elements.perfumeImageInput.addEventListener("change", handleImageUpload);
    elements.perfumeForm.addEventListener("submit", savePerfume);
    elements.cancelEditBtn.addEventListener("click", resetEditor);
    elements.perfumeForm.addEventListener("input", scheduleEditorDraftSave);
    elements.perfumeForm.addEventListener("change", scheduleEditorDraftSave);

    if (elements.aiDraftAddVolumeBtn) {
      elements.aiDraftAddVolumeBtn.addEventListener("click", function () {
        appendAiDraftVolumeRow();
      });
    }
    if (elements.aiDraftVolumesContainer) {
      elements.aiDraftVolumesContainer.addEventListener("click", function (event) {
        var removeAiButton = event.target.closest(".remove-volume-btn");
        if (!removeAiButton) {
          return;
        }
        var aiRow = removeAiButton.closest(".volume-row");
        if (!aiRow) {
          return;
        }
        aiRow.remove();
        if (!elements.aiDraftVolumesContainer.children.length) {
          appendAiDraftVolumeRow();
        }
      });
    }
    if (elements.aiDraftImageInput) {
      elements.aiDraftImageInput.addEventListener("change", handleAiDraftImageUpload);
    }
    if (elements.aiDraftForm) {
      elements.aiDraftForm.addEventListener("submit", saveAiDraft);
      elements.aiDraftForm.addEventListener("input", renderAiDraftInsights);
      elements.aiDraftForm.addEventListener("change", renderAiDraftInsights);
    }
    if (elements.aiDraftFillTestBtn) {
      elements.aiDraftFillTestBtn.addEventListener("click", fillAiDraftWithTestData);
    }
    if (elements.aiDraftResetBtn) {
      elements.aiDraftResetBtn.addEventListener("click", resetAiDraftEditor);
    }
    if (elements.adminAiDraftsList) {
      elements.adminAiDraftsList.addEventListener("click", onAiDraftListClick);
    }

    elements.adminProductsList.addEventListener("click", onProductListClick);
    elements.adminProductsList.addEventListener("change", onProductListChange);
    if (elements.adminCatalogSearchInput) {
      elements.adminCatalogSearchInput.addEventListener("input", onCatalogSearchInput);
    }
    if (elements.adminCatalogSearchClearBtn) {
      elements.adminCatalogSearchClearBtn.addEventListener("click", clearCatalogSearch);
    }
    if (elements.adminCatalogLoadMoreBtn) {
      elements.adminCatalogLoadMoreBtn.addEventListener("click", onCatalogLoadMore);
    }
    elements.volumesContainer.addEventListener("input", scheduleEditorDraftSave);
    elements.volumesContainer.addEventListener("change", scheduleEditorDraftSave);

    if (elements.homepageReviewForm) {
      elements.homepageReviewForm.addEventListener("submit", saveHomepageReview);
    }
    if (elements.homepageReviewResetBtn) {
      elements.homepageReviewResetBtn.addEventListener("click", resetHomepageReviewEditor);
    }
    if (elements.adminHomepageReviewsList) {
      elements.adminHomepageReviewsList.addEventListener("click", onHomepageReviewsListClick);
    }
    if (elements.adminPendingHomepageReviewsList) {
      elements.adminPendingHomepageReviewsList.addEventListener("click", onHomepageReviewsListClick);
    }

    window.addEventListener("focus", function () {
      if (isAuthenticated()) {
        saveEditorDraftFromForm();
      }
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        saveEditorDraftFromForm();
      }
    });

    window.addEventListener("beforeunload", saveEditorDraftFromForm);
  }

  function checkAuth() {
    if (isAuthenticated()) {
      openPanel();
    } else {
      openLogin();
    }
  }

  function isAuthenticated() {
    if (sessionStorage.getItem(AUTH_KEY) !== "1") {
      return false;
    }
    if (typeof store.hasAdminSession === "function") {
      return store.hasAdminSession();
    }
    return true;
  }

  function openPanel() {
    elements.loginView.classList.add("hidden");
    elements.panelView.classList.remove("hidden");
    ensureCapacityMonitorElements();
    ensureImageIntegrityMonitorElements();
    startCapacityMonitor();
    refreshPanel();
    refreshPanelFromServer(false);
  }

  function openLogin() {
    stopCapacityMonitor();
    elements.panelView.classList.add("hidden");
    elements.loginView.classList.remove("hidden");
    elements.passwordInput.value = "";
    elements.passwordInput.focus();
  }

  function refreshPanel() {
    fillSettingsForm();
    ensureImageIntegrityMonitorElements();
    resetAiDraftEditor();
    renderAiDrafts();
    resetCatalogState();
    renderProducts();
    loadCatalogPage({ reset: true, showErrorToast: false });
    loadAiDrafts(false);
    renderHomepageReviews();
    runImageIntegrityCheck(false);
    if (!state.homepageReviewEditingId) {
      resetHomepageReviewEditor();
    }
    if (!restoreEditorFromDraft()) {
      resetEditor({ keepDraft: true });
    }
  }

  async function refreshPanelFromServer(showErrorToast) {
    saveEditorDraftFromForm();
    if (typeof store.syncFromServer === "function") {
      try {
        await store.syncFromServer({ includeProducts: false });
      } catch (error) {
        if (String(error && error.message || "").indexOf("401") >= 0) {
          logout();
          showToast("Сессия администратора истекла. Войдите снова.", true);
          return;
        }
        if (showErrorToast) {
          showToast("Не удалось обновить данные с сервера.", true);
        }
      }
    }
    fillSettingsForm();
    await loadAiDrafts(showErrorToast);
    renderHomepageReviews();
    if (!state.homepageReviewEditingId) {
      resetHomepageReviewEditor();
    }
    if (!restoreEditorFromDraft()) {
      resetEditor({ keepDraft: true });
    }
    runImageIntegrityCheck(false);
    await loadCatalogPage({ reset: true, showErrorToast: showErrorToast });
  }

  async function onLogin(event) {
    event.preventDefault();
    var inputPassword = String(elements.passwordInput.value || "").trim();
    if (!inputPassword) {
      showToast("Введите пароль.", true);
      return;
    }

    if (typeof store.loginAdmin !== "function") {
      showToast("Обновите scripts/common.js на сервере.", true);
      return;
    }

    try {
      await store.loginAdmin(inputPassword);
    } catch (error) {
      var loginErrorMessage = String(error && error.message || "");
      if (loginErrorMessage.indexOf("NETWORK_TIMEOUT") >= 0 || loginErrorMessage.indexOf("Failed to fetch") >= 0) {
        showToast("Сервер входа временно недоступен. Проверьте интернет и попробуйте снова.", true);
        return;
      }
      if (String(error && error.message || "").indexOf("ADMIN_LOGIN_TEMP_BLOCKED:") === 0) {
        var waitSeconds = Math.max(0, Math.round(Number(String(error.message).split(":")[1]) || 0));
        if (waitSeconds > 0) {
          showToast("Слишком много попыток входа. Подождите " + waitSeconds + " сек.", true);
        } else {
          showToast("Слишком много попыток входа. Попробуйте позже.", true);
        }
        return;
      }
      if (String(error && error.message || "").indexOf("INVALID_CREDENTIALS") >= 0) {
        showToast("Неверный пароль.", true);
        return;
      }
      if (String(error && error.message || "").indexOf("HTTP") >= 0) {
        showToast("Сервер входа недоступен. Проверьте деплой.", true);
        return;
      }
      showToast("Неверный пароль.", true);
      return;
    }

    sessionStorage.setItem(AUTH_KEY, "1");
    openPanel();
    showToast("Вход выполнен");
  }

  function logout() {
    sessionStorage.removeItem(AUTH_KEY);
    if (typeof store.logoutAdmin === "function") {
      store.logoutAdmin();
    }
    openLogin();
  }

  function fillSettingsForm() {
    var settings = store.getSettings();
    elements.telegramChannelInput.value = settings.telegramChannel;
    elements.telegramDmInput.value = settings.telegramDM;
    elements.freeShippingInput.value = String(settings.freeShippingThreshold);
    if (elements.backupNoticeEnabledInput) {
      elements.backupNoticeEnabledInput.checked = Boolean(settings.backupNoticeEnabled);
    }
    state.heroImageData = String(settings.heroImage || "").trim();
    setHeroPreviewImage(state.heroImageData);
    if (elements.heroImageInput) {
      elements.heroImageInput.value = "";
    }
    elements.adminPasswordNewInput.value = "";
  }

  async function saveSettings(event) {
    event.preventDefault();

    var channel = String(elements.telegramChannelInput.value || "").trim();
    var dm = String(elements.telegramDmInput.value || "").trim();
    var freeShippingThreshold = Math.max(0, Math.round(Number(elements.freeShippingInput.value) || 0));
    var newAdminPassword = String(elements.adminPasswordNewInput.value || "").trim();
    var backupNoticeEnabled = elements.backupNoticeEnabledInput
      ? Boolean(elements.backupNoticeEnabledInput.checked)
      : true;

    var patch = {
      telegramChannel: channel,
      telegramDM: dm,
      freeShippingThreshold: freeShippingThreshold,
      backupNoticeEnabled: backupNoticeEnabled,
      heroImage: String(state.heroImageData || "").trim()
    };

    var passwordChanged = false;
    try {
      if (newAdminPassword) {
        if (typeof store.changeAdminPassword !== "function") {
          throw new Error("PASSWORD_ENDPOINT_UNAVAILABLE");
        }
        await store.changeAdminPassword(newAdminPassword);
        if (typeof store.loginAdmin === "function") {
          await store.loginAdmin(newAdminPassword);
        }
        passwordChanged = true;
      }

      await store.updateSettings(patch);
      elements.adminPasswordNewInput.value = "";
      showToast(newAdminPassword ? "Настройки и пароль сохранены" : "Настройки сохранены");
    } catch (error) {
      var message = String(error && error.message || "");
      if (message.indexOf("PASSWORD_TOO_SHORT") >= 0) {
        showToast("Пароль слишком короткий. Минимум 6 символов.", true);
        return;
      }
      if (message.indexOf("PASSWORD_TOO_LONG") >= 0) {
        showToast("Пароль слишком длинный. Максимум 128 символов.", true);
        return;
      }
      if (message.indexOf("PASSWORD_REQUIRED") >= 0) {
        showToast("Введите новый пароль.", true);
        return;
      }
      if (String(error && error.message || "").indexOf("401") >= 0 || String(error && error.message || "").indexOf("UNAUTHORIZED") >= 0) {
        logout();
        showToast("Сессия истекла. Войдите снова.", true);
        return;
      }
      if (passwordChanged) {
        showToast("Пароль сохранен, но настройки не удалось сохранить.", true);
        return;
      }
      showToast(getSyncErrorToastMessage(error), true);
    }
  }

  async function onCreateSnapshotClick() {
    if (!elements.snapshotBtn) {
      return;
    }
    if (typeof store.createAdminSnapshot !== "function") {
      showToast("Обновите scripts/common.js на сервере.", true);
      return;
    }

    var previousLabel = elements.snapshotBtn.textContent;
    elements.snapshotBtn.disabled = true;
    elements.snapshotBtn.textContent = "Сохраняем...";
    try {
      var result = await store.createAdminSnapshot();
      var count = Math.max(0, Math.round(Number(result && result.productsCount) || 0));
      showToast("Снимок каталога сохранён (" + count + " товаров)");
    } catch (error) {
      var message = String(error && error.message || "");
      if (message.indexOf("401") >= 0 || message.indexOf("UNAUTHORIZED") >= 0) {
        logout();
        showToast("Сессия истекла. Войдите снова.", true);
      } else {
        showToast("Не удалось создать снимок каталога.", true);
      }
    } finally {
      elements.snapshotBtn.disabled = false;
      elements.snapshotBtn.textContent = previousLabel;
    }
  }

  async function handleHeroImageUpload() {
    if (!elements.heroImageInput) {
      return;
    }

    var file = elements.heroImageInput.files && elements.heroImageInput.files[0];
    if (!file) {
      return;
    }

    var fileType = String(file.type || "").toLowerCase();
    if (!String(fileType).startsWith("image/")) {
      showToast("Выберите файл изображения.", true);
      elements.heroImageInput.value = "";
      return;
    }

    if (fileType.indexOf("heic") >= 0 || fileType.indexOf("heif") >= 0) {
      showToast("Формат HEIC/HEIF не поддерживается. Сохраните фото как JPG/PNG.", true);
      elements.heroImageInput.value = "";
      return;
    }

    if (file.size > MAX_UPLOAD_FILE_SIZE) {
      showToast("Фото больше 12 МБ. Выберите файл поменьше.", true);
      elements.heroImageInput.value = "";
      return;
    }

    var previousHeroImageData = String(state.heroImageData || "");
    try {
      var optimized = await optimizeImageForStore(file);
      if (!optimized || optimized.length > MAX_IMAGE_DATA_LENGTH) {
        throw new Error("IMAGE_TOO_LARGE");
      }

      state.heroImageData = optimized;
      setHeroPreviewImage(state.heroImageData);
      showToast("Главное фото выбрано. Нажмите «Сохранить настройки».");
    } catch (error) {
      state.heroImageData = previousHeroImageData;
      setHeroPreviewImage(previousHeroImageData);
      elements.heroImageInput.value = "";
      if (error && error.message === "IMAGE_TOO_LARGE") {
        showToast("Фото слишком тяжелое. Попробуйте другое изображение.", true);
        return;
      }
      showToast("Не удалось обработать фото. Используйте JPG или PNG.", true);
    }
  }

  function clearHeroImage() {
    state.heroImageData = "";
    if (elements.heroImageInput) {
      elements.heroImageInput.value = "";
    }
    setHeroPreviewImage("");
    showToast("Главное фото сброшено. Нажмите «Сохранить настройки».");
  }

  function normalizeMlInput(value) {
    var safe = String(value || "").trim().replace(",", ".");
    var numeric = Number(safe);
    if (!Number.isFinite(numeric)) {
      return NaN;
    }
    return Math.round(numeric * 100) / 100;
  }

  function normalizeBottleType(value) {
    var safe = String(value || "full").toLowerCase().trim();
    if (["decant", "tester", "full"].indexOf(safe) === -1) {
      return "full";
    }
    return safe;
  }

  function getMlKey(value) {
    var normalized = normalizeMlInput(value);
    if (!Number.isFinite(normalized)) {
      return "";
    }
    return String(normalized);
  }

  function formatMlValue(value) {
    if (store && typeof store.formatMl === "function") {
      return store.formatMl(value);
    }
    var normalized = normalizeMlInput(value);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return "0";
    }
    if (Math.abs(normalized - Math.round(normalized)) < 1e-9) {
      return String(Math.round(normalized));
    }
    return String(normalized).replace(".", ",");
  }

  function createVolumeRow(volume) {
    var data = volume || { ml: "", price: "" };
    var row = document.createElement("div");
    row.className = "volume-row";
    row.innerHTML = ""
      + "<label class=\"field\">"
      + "  <span>Объём, ml</span>"
      + "  <input class=\"volume-ml\" type=\"number\" min=\"0.1\" step=\"0.1\" required value=\"" + escapeHtml(data.ml) + "\">"
      + "</label>"
      + "<label class=\"field\">"
      + "  <span>Цена, ₽</span>"
      + "  <input class=\"volume-price\" type=\"number\" min=\"1\" required value=\"" + escapeHtml(data.price) + "\">"
      + "</label>"
      + "<button type=\"button\" class=\"btn btn-ghost remove-volume-btn\">Удалить</button>";

    return row;
  }

  function appendVolumeRowTo(container, volume) {
    if (!container) {
      return;
    }
    container.appendChild(createVolumeRow(volume));
  }

  function appendVolumeRow(volume) {
    appendVolumeRowTo(elements.volumesContainer, volume);
  }

  function appendAiDraftVolumeRow(volume) {
    appendVolumeRowTo(elements.aiDraftVolumesContainer, volume);
  }

  function collectVolumesFrom(container) {
    var rows = Array.prototype.slice.call((container || document).querySelectorAll(".volume-row"));
    var volumes = rows.map(function (row) {
      var mlInput = row.querySelector(".volume-ml");
      var priceInput = row.querySelector(".volume-price");
      var ml = normalizeMlInput(mlInput && mlInput.value);
      var price = Math.round(Number(priceInput.value));

      if (!Number.isFinite(ml) || ml <= 0 || !Number.isFinite(price) || price <= 0) {
        return null;
      }

      return {
        ml: ml,
        price: price
      };
    }).filter(Boolean);

    volumes.sort(function (a, b) {
      return a.ml - b.ml;
    });

    var uniqueMap = new Map();
    volumes.forEach(function (item) {
      uniqueMap.set(getMlKey(item.ml), item);
    });

    return Array.from(uniqueMap.values());
  }

  function collectVolumes() {
    return collectVolumesFrom(elements.volumesContainer);
  }

  function collectAiDraftVolumes() {
    return collectVolumesFrom(elements.aiDraftVolumesContainer);
  }

  function cloneDraft(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return null;
    }
  }

  function readEditorDraft() {
    var raw = "";
    try {
      raw = localStorage.getItem(EDITOR_DRAFT_KEY) || "";
    } catch (error) {
      raw = "";
    }

    if (!raw) {
      try {
        raw = sessionStorage.getItem(EDITOR_DRAFT_FALLBACK_KEY) || "";
      } catch (error) {
        raw = "";
      }
    }

    if (!raw) {
      return state.draftMemory ? cloneDraft(state.draftMemory) : null;
    }

    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      var safeVolumes = Array.isArray(parsed.volumes)
        ? parsed.volumes.map(function (volume) {
          if (!volume || typeof volume !== "object") {
            return null;
          }
          return {
            ml: String(volume.ml || ""),
            price: String(volume.price || "")
          };
        }).filter(Boolean)
        : [];

      var safeDraft = {
        editingId: String(parsed.editingId || ""),
        name: String(parsed.name || ""),
        brand: String(parsed.brand || ""),
        gender: String(parsed.gender || "unisex"),
        bottleType: normalizeBottleType(parsed.bottleType),
        description: String(parsed.description || ""),
        topWeek: Boolean(parsed.topWeek),
        topMonth: Boolean(parsed.topMonth),
        imageData: String(parsed.imageData || ""),
        volumes: safeVolumes
      };
      state.draftMemory = cloneDraft(safeDraft);
      return safeDraft;
    } catch (error) {
      return state.draftMemory ? cloneDraft(state.draftMemory) : null;
    }
  }

  function writeEditorDraft(draft) {
    state.draftMemory = cloneDraft(draft);
    var serialized = "";
    try {
      serialized = JSON.stringify(draft);
    } catch (error) {
      return;
    }

    var stored = false;
    try {
      localStorage.setItem(EDITOR_DRAFT_KEY, serialized);
      stored = true;
    } catch (error) {
      stored = false;
    }

    if (stored) {
      try {
        sessionStorage.removeItem(EDITOR_DRAFT_FALLBACK_KEY);
      } catch (error) {
        return;
      }
      return;
    }

    try {
      sessionStorage.setItem(EDITOR_DRAFT_FALLBACK_KEY, serialized);
    } catch (error) {
      return;
    }
  }

  function clearEditorDraft() {
    state.draftMemory = null;
    try {
      localStorage.removeItem(EDITOR_DRAFT_KEY);
    } catch (error) {
      // ignore
    }

    try {
      sessionStorage.removeItem(EDITOR_DRAFT_FALLBACK_KEY);
    } catch (error) {
      // ignore
    }
  }

  function getCurrentDraftVolumes() {
    return Array.prototype.slice.call(elements.volumesContainer.querySelectorAll(".volume-row")).map(function (row) {
      var mlInput = row.querySelector(".volume-ml");
      var priceInput = row.querySelector(".volume-price");
      return {
        ml: String((mlInput && mlInput.value) || ""),
        price: String((priceInput && priceInput.value) || "")
      };
    });
  }

  function getCurrentEditorDraft() {
    return {
      editingId: String(elements.perfumeIdInput.value || ""),
      name: String(elements.perfumeNameInput.value || ""),
      brand: String(elements.perfumeBrandInput.value || ""),
      gender: String(elements.perfumeGenderInput.value || "unisex"),
      bottleType: normalizeBottleType(elements.perfumeBottleTypeInput && elements.perfumeBottleTypeInput.value),
      description: String(elements.perfumeDescriptionInput.value || ""),
      topWeek: Boolean(elements.topWeekInput.checked),
      topMonth: Boolean(elements.topMonthInput.checked),
      imageData: String(state.imageData || ""),
      volumes: getCurrentDraftVolumes()
    };
  }

  function isEditorDraftMeaningful(draft) {
    if (!draft || typeof draft !== "object") {
      return false;
    }

    if (String(draft.editingId || "").trim()) {
      return true;
    }

    if (String(draft.name || "").trim() || String(draft.brand || "").trim() || String(draft.description || "").trim()) {
      return true;
    }

    if (Boolean(draft.topWeek) || Boolean(draft.topMonth)) {
      return true;
    }

    if (normalizeBottleType(draft.bottleType) !== "full") {
      return true;
    }

    if (String(draft.imageData || "").trim()) {
      return true;
    }

    return Array.isArray(draft.volumes) && draft.volumes.some(function (volume) {
      return String((volume && volume.ml) || "").trim() || String((volume && volume.price) || "").trim();
    });
  }

  function saveEditorDraftFromForm() {
    if (!elements.panelView || elements.panelView.classList.contains("hidden")) {
      return;
    }

    var draft = getCurrentEditorDraft();
    if (!isEditorDraftMeaningful(draft)) {
      clearEditorDraft();
      return;
    }

    writeEditorDraft(draft);
  }

  function scheduleEditorDraftSave() {
    if (editorDraftSaveTimer) {
      clearTimeout(editorDraftSaveTimer);
    }

    editorDraftSaveTimer = setTimeout(function () {
      editorDraftSaveTimer = null;
      saveEditorDraftFromForm();
    }, EDITOR_DRAFT_SAVE_DEBOUNCE_MS);
  }

  function applyEditorDraft(draft) {
    if (!draft) {
      return;
    }

    var gender = String(draft.gender || "unisex");
    if (["male", "female", "unisex"].indexOf(gender) === -1) {
      gender = "unisex";
    }
    var bottleType = normalizeBottleType(draft.bottleType);

    state.editingId = String(draft.editingId || "") || null;
    state.imageData = String(draft.imageData || "");

    elements.editorTitle.textContent = state.editingId ? "Редактировать парфюм" : "Добавить парфюм";
    elements.perfumeIdInput.value = state.editingId || "";
    elements.perfumeNameInput.value = String(draft.name || "");
    elements.perfumeBrandInput.value = String(draft.brand || "");
    elements.perfumeGenderInput.value = gender;
    if (elements.perfumeBottleTypeInput) {
      elements.perfumeBottleTypeInput.value = bottleType;
    }
    elements.perfumeDescriptionInput.value = String(draft.description || "");
    elements.topWeekInput.checked = Boolean(draft.topWeek);
    elements.topMonthInput.checked = Boolean(draft.topMonth);
    elements.perfumeImageInput.value = "";

    setPreviewImage(state.imageData);

    elements.volumesContainer.innerHTML = "";
    var volumes = Array.isArray(draft.volumes) && draft.volumes.length
      ? draft.volumes
      : [{ ml: "", price: "" }];

    volumes.forEach(function (volume) {
      appendVolumeRow({
        ml: String(volume.ml || ""),
        price: String(volume.price || "")
      });
    });
  }

  function restoreEditorFromDraft() {
    var draft = readEditorDraft();
    if (!draft || !isEditorDraftMeaningful(draft)) {
      clearEditorDraft();
      return false;
    }

    applyEditorDraft(draft);
    return true;
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(new Error("FILE_READ_ERROR"));
      };
      reader.readAsDataURL(file);
    });
  }

  function loadImageElement(src) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        resolve(image);
      };
      image.onerror = function () {
        reject(new Error("IMAGE_DECODE_ERROR"));
      };
      image.src = src;
    });
  }

  function renderToJpegDataUrl(image, maxDimension, quality) {
    var width = Number(image.naturalWidth || image.width || 0);
    var height = Number(image.naturalHeight || image.height || 0);
    if (!width || !height) {
      throw new Error("IMAGE_SIZE_ERROR");
    }

    var scale = Math.min(1, maxDimension / Math.max(width, height));
    var targetWidth = Math.max(1, Math.round(width * scale));
    var targetHeight = Math.max(1, Math.round(height * scale));

    var canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    var context = canvas.getContext("2d");
    if (!context) {
      throw new Error("CANVAS_NOT_SUPPORTED");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    return canvas.toDataURL("image/jpeg", quality);
  }

  async function optimizeImageForStore(file) {
    var originalDataUrl = await readFileAsDataUrl(file);
    if (originalDataUrl.length <= MAX_IMAGE_DATA_LENGTH) {
      return originalDataUrl;
    }

    var image = await loadImageElement(originalDataUrl);
    var currentDimension = MAX_IMAGE_DIMENSION;
    var currentQuality = IMAGE_QUALITY_START;
    var best = originalDataUrl;

    for (var attempt = 0; attempt < 6; attempt += 1) {
      var candidate = renderToJpegDataUrl(image, currentDimension, currentQuality);
      best = candidate;

      if (candidate.length <= MAX_IMAGE_DATA_LENGTH) {
        return candidate;
      }

      currentDimension = Math.max(MIN_IMAGE_DIMENSION, Math.round(currentDimension * 0.82));
      currentQuality = Math.max(IMAGE_QUALITY_MIN, currentQuality - 0.08);
    }

    return best;
  }

  async function handleImageUpload() {
    var file = elements.perfumeImageInput.files && elements.perfumeImageInput.files[0];
    if (!file) {
      return;
    }

    var fileType = String(file.type || "").toLowerCase();
    if (!String(fileType).startsWith("image/")) {
      showToast("Выберите файл изображения.", true);
      elements.perfumeImageInput.value = "";
      return;
    }

    if (fileType.indexOf("heic") >= 0 || fileType.indexOf("heif") >= 0) {
      showToast("Формат HEIC/HEIF не поддерживается. Сохраните фото как JPG/PNG.", true);
      elements.perfumeImageInput.value = "";
      return;
    }

    if (file.size > MAX_UPLOAD_FILE_SIZE) {
      showToast("Фото больше 12 МБ. Выберите файл поменьше.", true);
      elements.perfumeImageInput.value = "";
      return;
    }

    var previousImageData = String(state.imageData || "");
    try {
      var optimized = await optimizeImageForStore(file);
      if (!optimized || optimized.length > MAX_IMAGE_DATA_LENGTH) {
        throw new Error("IMAGE_TOO_LARGE");
      }

      state.imageData = optimized;
      setPreviewImage(state.imageData);
      saveEditorDraftFromForm();
      showToast("Фото загружено");
    } catch (error) {
      state.imageData = previousImageData;
      setPreviewImage(previousImageData);
      elements.perfumeImageInput.value = "";
      saveEditorDraftFromForm();
      if (error && error.message === "IMAGE_TOO_LARGE") {
        showToast("Фото слишком тяжелое. Попробуйте другое изображение.", true);
        return;
      }
      showToast("Не удалось обработать фото. Используйте JPG или PNG.", true);
    }
  }

  function setImagePreview(imageElement, src) {
    if (!imageElement) {
      return;
    }
    var value = String(src || "").trim();
    if (!value) {
      imageElement.removeAttribute("src");
      imageElement.classList.add("hidden");
      return;
    }
    imageElement.src = value;
    imageElement.classList.remove("hidden");
  }

  function setPreviewImage(src) {
    setImagePreview(elements.perfumeImagePreview, src);
  }

  function setHeroPreviewImage(src) {
    setImagePreview(elements.heroImagePreview, src);
  }

  function setAiDraftPreviewImage(src) {
    setImagePreview(elements.aiDraftImagePreview, src);
  }

  async function handleAiDraftImageUpload() {
    var file = elements.aiDraftImageInput.files && elements.aiDraftImageInput.files[0];
    if (!file) {
      return;
    }

    var fileType = String(file.type || "").toLowerCase();
    if (!String(fileType).startsWith("image/")) {
      showToast("Выберите файл изображения.", true);
      elements.aiDraftImageInput.value = "";
      return;
    }

    if (fileType.indexOf("heic") >= 0 || fileType.indexOf("heif") >= 0) {
      showToast("Формат HEIC/HEIF не поддерживается. Сохраните фото как JPG/PNG.", true);
      elements.aiDraftImageInput.value = "";
      return;
    }

    if (file.size > MAX_UPLOAD_FILE_SIZE) {
      showToast("Фото больше 12 МБ. Выберите файл поменьше.", true);
      elements.aiDraftImageInput.value = "";
      return;
    }

    var previousImageData = String(state.aiDraftImageData || "");
    try {
      var optimized = await optimizeImageForStore(file);
      if (!optimized || optimized.length > MAX_IMAGE_DATA_LENGTH) {
        throw new Error("IMAGE_TOO_LARGE");
      }

      state.aiDraftImageData = optimized;
      setAiDraftPreviewImage(state.aiDraftImageData);
      showToast("Фото черновика загружено");
    } catch (error) {
      state.aiDraftImageData = previousImageData;
      setAiDraftPreviewImage(previousImageData);
      elements.aiDraftImageInput.value = "";
      if (error && error.message === "IMAGE_TOO_LARGE") {
        showToast("Фото слишком тяжелое. Попробуйте другое изображение.", true);
        return;
      }
      showToast("Не удалось обработать фото. Используйте JPG или PNG.", true);
    }
  }

  async function savePerfume(event) {
    event.preventDefault();

    var id = String(elements.perfumeIdInput.value || "").trim();
    var name = String(elements.perfumeNameInput.value || "").trim();
    var brand = String(elements.perfumeBrandInput.value || "").trim();
    var gender = String(elements.perfumeGenderInput.value || "unisex");
    var bottleType = normalizeBottleType(elements.perfumeBottleTypeInput && elements.perfumeBottleTypeInput.value);
    var description = String(elements.perfumeDescriptionInput.value || "").trim();
    var volumes = collectVolumes();

    if (!name || !brand) {
      showToast("Заполните название и бренд.", true);
      return;
    }

    if (!volumes.length) {
      showToast("Добавьте хотя бы один объём и цену.", true);
      return;
    }

    var existing = getProductById(id);

    var image = state.imageData || (existing && existing.image) || store.getDefaultData().products[0].image;
    if (String(image).indexOf("data:image/") === 0 && String(image).length > MAX_IMAGE_DATA_LENGTH) {
      showToast("Слишком тяжелое фото. Выберите другое изображение.", true);
      return;
    }

    var payload = {
      id: id || store.uid("p"),
      name: name,
      brand: brand,
      gender: gender,
      bottleType: bottleType,
      description: description,
      image: image,
      volumes: volumes,
      reviews: existing && Array.isArray(existing.reviews) ? existing.reviews : [],
      topWeek: elements.topWeekInput.checked,
      topMonth: elements.topMonthInput.checked
    };

    var isEditing = Boolean(existing);

    try {
      if (typeof store.upsertAdminProduct === "function") {
        await store.upsertAdminProduct(payload);
      } else {
        var fallbackProducts = store.getProducts();
        var nextProducts = existing
          ? fallbackProducts.map(function (item) {
            return item.id === existing.id ? payload : item;
          })
          : [payload].concat(fallbackProducts);
        await store.saveProducts(nextProducts);
      }
      await loadCatalogPage({ reset: true, showErrorToast: false });
      renderProducts();
      resetEditor();
      showToast(isEditing ? "Товар обновлён" : "Товар добавлен");
    } catch (error) {
      var message = String(error && error.message || "");
      if (message.indexOf("401") >= 0 || message.indexOf("UNAUTHORIZED") >= 0) {
        logout();
        showToast("Сессия истекла. Войдите снова.", true);
        return;
      }
      if (message.indexOf("413") >= 0) {
        showToast("Фото слишком тяжелое для сервера. Уменьшите размер и сохраните снова.", true);
      } else {
        showToast(getSyncErrorToastMessage(error), true);
      }
    }
  }

  function resetEditor(options) {
    var keepDraft = options && options.keepDraft;

    state.editingId = null;
    state.imageData = "";

    elements.editorTitle.textContent = "Добавить парфюм";
    elements.perfumeIdInput.value = "";
    elements.perfumeForm.reset();
    if (elements.perfumeBottleTypeInput) {
      elements.perfumeBottleTypeInput.value = "full";
    }

    elements.volumesContainer.innerHTML = "";
    appendVolumeRow({ ml: "", price: "" });

    setPreviewImage("");

    if (!keepDraft) {
      clearEditorDraft();
    }
  }

  function getAiDraftById(draftId) {
    var safeDraftId = String(draftId || "").trim();
    return (Array.isArray(state.aiDrafts) ? state.aiDrafts : []).find(function (draft) {
      return String(draft && draft.id || "").trim() === safeDraftId;
    }) || null;
  }

  function collectAiDraftNotes() {
    return String(elements.aiDraftNotesInput && elements.aiDraftNotesInput.value || "")
      .split(/\r?\n+/)
      .map(function (note) {
        return String(note || "").trim();
      })
      .filter(Boolean);
  }

  function getAiDraftStatusLabel(status) {
    var safeStatus = String(status || "pending").trim().toLowerCase();
    var labels = {
      pending: "Ожидает",
      needs_review: "Нужна проверка",
      ready_to_publish: "Готов к публикации",
      published: "Опубликован",
      rejected: "Отклонён"
    };
    return labels[safeStatus] || safeStatus || "Ожидает";
  }

  function getAiDraftAnalysisValue(draft, keys) {
    if (!draft || !draft.analysis || typeof draft.analysis !== "object" || !Array.isArray(keys)) {
      return "";
    }

    for (var i = 0; i < keys.length; i += 1) {
      var key = String(keys[i] || "").trim();
      if (!key) {
        continue;
      }
      var value = draft.analysis[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }

    return "";
  }

  function getAiDraftPreviewGender(draft) {
    var raw = getAiDraftAnalysisValue(draft, ["gender", "sex", "targetGender"]).toLowerCase();
    if (!raw) {
      return "unisex";
    }
    if (raw.indexOf("male") >= 0 || raw.indexOf("man") >= 0 || raw.indexOf("men") >= 0 || raw.indexOf("муж") >= 0) {
      return "male";
    }
    if (raw.indexOf("female") >= 0 || raw.indexOf("woman") >= 0 || raw.indexOf("women") >= 0 || raw.indexOf("жен") >= 0) {
      return "female";
    }
    return "unisex";
  }

  function getAiDraftPreviewBottleType(draft) {
    var raw = getAiDraftAnalysisValue(draft, ["bottleType", "flaconType", "type"]).toLowerCase();
    if (!raw) {
      return "full";
    }
    if (raw.indexOf("decant") >= 0 || raw.indexOf("отлив") >= 0) {
      return "decant";
    }
    if (raw.indexOf("tester") >= 0 || raw.indexOf("тестер") >= 0) {
      return "tester";
    }
    return "full";
  }

  function serializeAiDraftAnalysis(analysis) {
    if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
      return "{}";
    }
    try {
      return JSON.stringify(analysis, null, 2);
    } catch (error) {
      return "{}";
    }
  }

  function parseAiDraftAnalysisInput() {
    var raw = String(elements.aiDraftAnalysisInput && elements.aiDraftAnalysisInput.value || "").trim();
    if (!raw) {
      return null;
    }

    var parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error("INVALID_AI_DRAFT_ANALYSIS_JSON");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("INVALID_AI_DRAFT_ANALYSIS_JSON");
    }

    return parsed;
  }

  function buildAiDraftFallbackAnalysis(draft) {
    var safeDraft = draft && typeof draft === "object" ? draft : {};
    var firstVolume = Array.isArray(safeDraft.volumes) && safeDraft.volumes.length ? safeDraft.volumes[0] : null;
    var confidenceValue = Number(safeDraft.confidenceScore || 0);
    if (!Number.isFinite(confidenceValue)) {
      confidenceValue = 0;
    }

    return {
      brand: String(safeDraft.brand || "").trim(),
      name: String(safeDraft.name || "").trim(),
      volume: firstVolume ? formatMlValue(firstVolume.ml) + " ml" : "",
      gender: getAiDraftPreviewGender(safeDraft),
      bottleType: getAiDraftPreviewBottleType(safeDraft),
      confidence: Math.max(0, Math.min(1, confidenceValue > 1 ? confidenceValue / 100 : confidenceValue))
    };
  }

  function hasAiDraftFormContent() {
    if (!elements.aiDraftForm) {
      return false;
    }
    if (state.aiDraftEditingId || state.aiDraftImageData) {
      return true;
    }

    var textFields = [
      elements.aiDraftBrandInput,
      elements.aiDraftNameInput,
      elements.aiDraftSourceUrlInput,
      elements.aiDraftRawTextInput,
      elements.aiDraftDescriptionInput,
      elements.aiDraftAnalysisInput,
      elements.aiDraftNotesInput,
      elements.aiDraftConfidenceInput
    ];

    var hasText = textFields.some(function (field) {
      return String(field && field.value || "").trim() !== "";
    });
    if (hasText) {
      return true;
    }

    return collectAiDraftVolumes().length > 0;
  }

  function buildAiDraftFromForm(options) {
    var safeOptions = options && typeof options === "object" ? options : {};
    var analysis = null;
    var analysisError = "";

    try {
      analysis = parseAiDraftAnalysisInput();
    } catch (error) {
      if (!safeOptions.ignoreInvalidAnalysis) {
        throw error;
      }
      analysisError = String(error && error.message || "INVALID_AI_DRAFT_ANALYSIS_JSON");
    }

    return {
      id: String(elements.aiDraftIdInput && elements.aiDraftIdInput.value || "").trim() || String(safeOptions.id || "").trim(),
      source: String(elements.aiDraftSourceInput && elements.aiDraftSourceInput.value || "manual-test").trim(),
      status: String(elements.aiDraftStatusInput && elements.aiDraftStatusInput.value || "pending").trim(),
      sourceUrl: String(elements.aiDraftSourceUrlInput && elements.aiDraftSourceUrlInput.value || "").trim(),
      rawText: String(elements.aiDraftRawTextInput && elements.aiDraftRawTextInput.value || "").trim(),
      brand: String(elements.aiDraftBrandInput && elements.aiDraftBrandInput.value || "").trim(),
      name: String(elements.aiDraftNameInput && elements.aiDraftNameInput.value || "").trim(),
      description: String(elements.aiDraftDescriptionInput && elements.aiDraftDescriptionInput.value || "").trim(),
      image: String(state.aiDraftImageData || "").trim(),
      volumes: collectAiDraftVolumes(),
      notes: collectAiDraftNotes(),
      analysis: analysis,
      confidenceScore: Number(elements.aiDraftConfidenceInput && elements.aiDraftConfidenceInput.value || 0),
      createdAt: String(safeOptions.createdAt || "").trim(),
      updatedAt: String(safeOptions.updatedAt || "").trim(),
      _analysisError: analysisError
    };
  }

  function buildAiDraftPreviewMarkup(draft) {
    var safeDraft = draft && typeof draft === "object" ? draft : {};
    var safeName = safeDraft.name || "Название аромата";
    var safeBrand = safeDraft.brand || "Бренд";
    var description = safeDraft.description || "Описание пока не заполнено.";
    var volumes = Array.isArray(safeDraft.volumes) ? safeDraft.volumes : [];
    var minPrice = volumes.length
      ? volumes.reduce(function (minValue, item) {
          return item.price < minValue ? item.price : minValue;
        }, Number.MAX_SAFE_INTEGER)
      : 0;
    var brandLine = [
      safeBrand,
      store.getGenderLabel(getAiDraftPreviewGender(safeDraft)),
      store.getBottleTypeLabel(getAiDraftPreviewBottleType(safeDraft))
    ].filter(Boolean).join(" • ");
    var volumeOptions = volumes.length
      ? volumes.map(function (item) {
          return "<option>" + escapeHtml(formatMlValue(item.ml) + " ml - " + store.formatPrice(item.price)) + "</option>";
        }).join("")
      : "<option>Объёмы ещё не добавлены</option>";
    var previewImage = safeDraft.image
      ? "<img loading=\"lazy\" decoding=\"async\" src=\"" + escapeHtml(safeDraft.image) + "\" alt=\"" + escapeHtml(safeName) + "\">"
      : "<div class=\"ai-draft-preview-image-empty\">Фото черновика</div>";

    return ""
      + "<div class=\"ai-draft-preview-shell\">"
      + "  <article class=\"product-card ai-draft-preview-card\">"
      + "    <div class=\"product-image-wrap\">"
      + "      " + previewImage
      + "      <span class=\"top-badge\">" + escapeHtml(getAiDraftStatusLabel(safeDraft.status)) + "</span>"
      + "    </div>"
      + "    <div class=\"product-content\">"
      + "      <h3 class=\"product-name\">" + escapeHtml(safeName) + "</h3>"
      + "      <p class=\"product-brand\">" + escapeHtml(brandLine) + "</p>"
      + "      <p class=\"product-description is-expanded\">" + escapeHtml(description) + "</p>"
      + "      <div class=\"volume-line\">"
      + "        <span>Цена от:</span>"
      + "        <strong>" + escapeHtml(minPrice > 0 ? store.formatPrice(minPrice) : "—") + "</strong>"
      + "      </div>"
      + "      <label class=\"field\">"
      + "        <span>Объём</span>"
      + "        <select disabled>" + volumeOptions + "</select>"
      + "      </label>"
      + "      <button class=\"btn btn-primary full-width\" type=\"button\" disabled>После публикации появится кнопка «В корзину»</button>"
      + "    </div>"
      + "  </article>"
      + "</div>";
  }

  function renderAiDraftInsights() {
    if (!elements.aiDraftLivePreview || !elements.aiDraftAnalysisPreview) {
      return;
    }

    var selectedDraft = getAiDraftById(state.aiDraftOpenedId);
    var previewDraft = null;

    if (hasAiDraftFormContent()) {
      previewDraft = buildAiDraftFromForm({
        ignoreInvalidAnalysis: true,
        id: selectedDraft && selectedDraft.id,
        createdAt: selectedDraft && selectedDraft.createdAt,
        updatedAt: selectedDraft && selectedDraft.updatedAt
      });
    } else if (selectedDraft) {
      previewDraft = selectedDraft;
    }

    if (!previewDraft) {
      if (elements.aiDraftSelectionMeta) {
        elements.aiDraftSelectionMeta.textContent = "Выберите черновик или заполните форму — здесь появится карточка товара.";
      }
      elements.aiDraftLivePreview.innerHTML = "<div class=\"empty-state\">Предпросмотр появится после выбора черновика или ввода данных.</div>";
      elements.aiDraftAnalysisPreview.textContent = "{}";
      elements.aiDraftAnalysisPreview.classList.remove("ai-draft-analysis-json--error");
      return;
    }

    var metaParts = [];
    if (previewDraft.id) {
      metaParts.push("ID: " + previewDraft.id);
    }
    metaParts.push("Статус: " + getAiDraftStatusLabel(previewDraft.status));
    if (previewDraft.confidenceScore || previewDraft.confidenceScore === 0) {
      metaParts.push("Confidence: " + String(previewDraft.confidenceScore));
    }
    if (previewDraft.createdAt) {
      metaParts.push("Создан: " + formatReviewDate(previewDraft.createdAt));
    }
    if (elements.aiDraftSelectionMeta) {
      elements.aiDraftSelectionMeta.textContent = metaParts.join(" • ");
    }

    elements.aiDraftLivePreview.innerHTML = buildAiDraftPreviewMarkup(previewDraft);

    if (previewDraft._analysisError) {
      elements.aiDraftAnalysisPreview.textContent = "Ошибка JSON: проверьте формат анализа AI.";
      elements.aiDraftAnalysisPreview.classList.add("ai-draft-analysis-json--error");
      return;
    }

    elements.aiDraftAnalysisPreview.textContent = serializeAiDraftAnalysis(previewDraft.analysis || buildAiDraftFallbackAnalysis(previewDraft));
    elements.aiDraftAnalysisPreview.classList.remove("ai-draft-analysis-json--error");
  }

  function fillAiDraftWithTestData() {
    if (elements.aiDraftSourceInput) {
      elements.aiDraftSourceInput.value = "manual-test";
    }
    if (elements.aiDraftStatusInput) {
      elements.aiDraftStatusInput.value = "ready_to_publish";
    }
    if (elements.aiDraftBrandInput) {
      elements.aiDraftBrandInput.value = "Parfums de Marly";
    }
    if (elements.aiDraftNameInput) {
      elements.aiDraftNameInput.value = "Althair";
    }
    if (elements.aiDraftDescriptionInput) {
      elements.aiDraftDescriptionInput.value = "Тестовый товар для проверки AI Drafts.";
    }
    if (elements.aiDraftRawTextInput) {
      elements.aiDraftRawTextInput.value = "Parfums de Marly Althair 125 ml. Тестовый импорт черновика.";
    }
    if (elements.aiDraftSourceUrlInput) {
      elements.aiDraftSourceUrlInput.value = "";
    }
    if (elements.aiDraftConfidenceInput) {
      elements.aiDraftConfidenceInput.value = "96";
    }
    if (elements.aiDraftNotesInput) {
      elements.aiDraftNotesInput.value = "Проверить сценарий публикации\nПроверить фото товара";
    }
    if (elements.aiDraftAnalysisInput) {
      elements.aiDraftAnalysisInput.value = JSON.stringify({
        brand: "Parfums de Marly",
        name: "Althair",
        volume: "125 ml",
        gender: "unisex",
        confidence: 0.96
      }, null, 2);
    }
    if (elements.aiDraftVolumesContainer) {
      elements.aiDraftVolumesContainer.innerHTML = "";
      appendAiDraftVolumeRow({ ml: "125", price: "16500" });
    }
    renderAiDraftInsights();
    showToast("Тестовый AI-черновик заполнен");
  }

  function resetAiDraftEditor() {
    state.aiDraftEditingId = null;
    state.aiDraftImageData = "";

    if (elements.aiDraftEditorTitle) {
      elements.aiDraftEditorTitle.textContent = "AI Черновики";
    }
    if (elements.aiDraftIdInput) {
      elements.aiDraftIdInput.value = "";
    }
    if (elements.aiDraftForm) {
      elements.aiDraftForm.reset();
    }
    if (elements.aiDraftSourceInput) {
      elements.aiDraftSourceInput.value = "manual-test";
    }
    if (elements.aiDraftStatusInput) {
      elements.aiDraftStatusInput.value = "pending";
    }
    if (elements.aiDraftAnalysisInput) {
      elements.aiDraftAnalysisInput.value = "";
    }
    if (elements.aiDraftVolumesContainer) {
      elements.aiDraftVolumesContainer.innerHTML = "";
      appendAiDraftVolumeRow({ ml: "", price: "" });
    }
    if (elements.aiDraftImageInput) {
      elements.aiDraftImageInput.value = "";
    }
    setAiDraftPreviewImage("");
    renderAiDraftInsights();
  }

  function fillAiDraftForm(draft) {
    if (!draft) {
      return;
    }

    state.aiDraftEditingId = draft.id;
    state.aiDraftOpenedId = draft.id;
    state.aiDraftImageData = draft.image || "";
    if (elements.aiDraftEditorTitle) {
      elements.aiDraftEditorTitle.textContent = "Редактировать AI-черновик";
    }
    if (elements.aiDraftIdInput) {
      elements.aiDraftIdInput.value = draft.id;
    }
    if (elements.aiDraftSourceInput) {
      elements.aiDraftSourceInput.value = draft.source || "manual-test";
    }
    if (elements.aiDraftStatusInput) {
      elements.aiDraftStatusInput.value = draft.status || "pending";
    }
    if (elements.aiDraftSourceUrlInput) {
      elements.aiDraftSourceUrlInput.value = draft.sourceUrl || "";
    }
    if (elements.aiDraftBrandInput) {
      elements.aiDraftBrandInput.value = draft.brand || "";
    }
    if (elements.aiDraftNameInput) {
      elements.aiDraftNameInput.value = draft.name || "";
    }
    if (elements.aiDraftConfidenceInput) {
      elements.aiDraftConfidenceInput.value = draft.confidenceScore || draft.confidenceScore === 0
        ? String(draft.confidenceScore)
        : "";
    }
    if (elements.aiDraftRawTextInput) {
      elements.aiDraftRawTextInput.value = draft.rawText || "";
    }
    if (elements.aiDraftDescriptionInput) {
      elements.aiDraftDescriptionInput.value = draft.description || "";
    }
    if (elements.aiDraftAnalysisInput) {
      elements.aiDraftAnalysisInput.value = serializeAiDraftAnalysis(draft.analysis || buildAiDraftFallbackAnalysis(draft));
    }
    if (elements.aiDraftNotesInput) {
      elements.aiDraftNotesInput.value = Array.isArray(draft.notes) ? draft.notes.join("\n") : "";
    }
    if (elements.aiDraftImageInput) {
      elements.aiDraftImageInput.value = "";
    }
    setAiDraftPreviewImage(state.aiDraftImageData);

    if (elements.aiDraftVolumesContainer) {
      elements.aiDraftVolumesContainer.innerHTML = "";
      if (Array.isArray(draft.volumes) && draft.volumes.length) {
        draft.volumes.forEach(function (volume) {
          appendAiDraftVolumeRow({ ml: volume.ml, price: volume.price });
        });
      } else {
        appendAiDraftVolumeRow({ ml: "", price: "" });
      }
    }

    renderAiDrafts();
    renderAiDraftInsights();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveAiDraft(event) {
    event.preventDefault();

    var parsedAnalysis = null;
    try {
      parsedAnalysis = parseAiDraftAnalysisInput();
    } catch (error) {
      showToast("Анализ AI должен быть валидным JSON-объектом.", true);
      return;
    }

    var payload = {
      id: String(elements.aiDraftIdInput && elements.aiDraftIdInput.value || "").trim(),
      source: String(elements.aiDraftSourceInput && elements.aiDraftSourceInput.value || "manual-test"),
      status: String(elements.aiDraftStatusInput && elements.aiDraftStatusInput.value || "pending"),
      sourceUrl: String(elements.aiDraftSourceUrlInput && elements.aiDraftSourceUrlInput.value || "").trim(),
      rawText: String(elements.aiDraftRawTextInput && elements.aiDraftRawTextInput.value || "").trim(),
      brand: String(elements.aiDraftBrandInput && elements.aiDraftBrandInput.value || "").trim(),
      name: String(elements.aiDraftNameInput && elements.aiDraftNameInput.value || "").trim(),
      description: String(elements.aiDraftDescriptionInput && elements.aiDraftDescriptionInput.value || "").trim(),
      image: String(state.aiDraftImageData || "").trim(),
      volumes: collectAiDraftVolumes(),
      notes: collectAiDraftNotes(),
      analysis: parsedAnalysis,
      confidenceScore: Number(elements.aiDraftConfidenceInput && elements.aiDraftConfidenceInput.value || 0)
    };

    try {
      var result = await store.upsertAdminAiDraft(payload);
      await loadAiDrafts(false);
      if (result && result.draft) {
        fillAiDraftForm(result.draft);
      }
      showToast(result && result.created ? "AI-черновик создан" : "AI-черновик сохранён");
    } catch (error) {
      if (String(error && error.message || "").indexOf("401") >= 0 || String(error && error.message || "").indexOf("UNAUTHORIZED") >= 0) {
        logout();
        showToast("Сессия истекла. Войдите снова.", true);
        return;
      }
      showToast("Не удалось сохранить AI-черновик.", true);
    }
  }

  async function loadAiDrafts(showErrorToast) {
    if (!elements.adminAiDraftsList || typeof store.fetchAdminAiDrafts !== "function") {
      return;
    }

    if (elements.adminAiDraftsMeta) {
      elements.adminAiDraftsMeta.textContent = "Загрузка AI-черновиков...";
    }

    try {
      var previousOpenedId = String(state.aiDraftOpenedId || "").trim();
      state.aiDrafts = await store.fetchAdminAiDrafts();
      if (previousOpenedId && getAiDraftById(previousOpenedId)) {
        state.aiDraftOpenedId = previousOpenedId;
      } else {
        state.aiDraftOpenedId = state.aiDrafts.length ? String(state.aiDrafts[0].id || "") : "";
      }
      renderAiDrafts();
      renderAiDraftInsights();
    } catch (error) {
      if (String(error && error.message || "").indexOf("401") >= 0 || String(error && error.message || "").indexOf("UNAUTHORIZED") >= 0) {
        logout();
        showToast("Сессия истекла. Войдите снова.", true);
        return;
      }
      state.aiDrafts = [];
      state.aiDraftOpenedId = "";
      renderAiDrafts();
      renderAiDraftInsights();
      if (showErrorToast) {
        showToast("Не удалось загрузить AI-черновики.", true);
      }
    }
  }

  function buildAiDraftCardMarkup(draft) {
    var draftId = String(draft && draft.id || "");
    var safeStatus = String(draft && draft.status || "pending");
    var volumesLine = (Array.isArray(draft && draft.volumes) ? draft.volumes : []).map(function (volume) {
      return formatMlValue(volume.ml) + "ml - " + store.formatPrice(volume.price);
    }).join(" | ");
    var previewMarkup = draft && draft.image
      ? "<img loading=\"lazy\" decoding=\"async\" src=\"" + escapeHtml(draft.image) + "\" alt=\"" + escapeHtml(draft.name || draft.brand || "AI draft") + "\">"
      : "<div class=\"admin-draft-thumb admin-draft-thumb--empty\">AI</div>";
    var canPublish = safeStatus === "ready_to_publish";
    var isPublished = safeStatus === "published";
    var createdAtLabel = draft && draft.createdAt ? formatReviewDate(draft.createdAt) : "";
    var confidenceText = draft && (draft.confidenceScore || draft.confidenceScore === 0)
      ? String(draft.confidenceScore)
      : "0";

    return ""
      + "<article class=\"admin-product-card admin-draft-card" + (draftId === state.aiDraftOpenedId ? " is-selected" : "") + "\" data-ai-draft-id=\"" + escapeHtml(draftId) + "\">"
      + "  " + previewMarkup
      + "  <div class=\"admin-product-body\">"
      + "    <div class=\"admin-product-head\">"
      + "      <div class=\"admin-product-title\">"
      + "        <strong>" + escapeHtml(draft.name || "Без названия") + "</strong>"
      + "        <span>" + escapeHtml(draft.brand || "Без бренда") + " | " + escapeHtml(draft.source || "manual-test") + "</span>"
      + "      </div>"
      + "      <div class=\"admin-product-actions\">"
      + "        <span class=\"admin-draft-status admin-draft-status--" + escapeHtml(safeStatus) + "\">" + escapeHtml(getAiDraftStatusLabel(safeStatus)) + "</span>"
      + "      </div>"
      + "    </div>"
      + "    <p class=\"meta-line\">Confidence score: " + escapeHtml(confidenceText) + "</p>"
      + "    " + (draft.sourceUrl ? "<p class=\"meta-line\">Источник: " + escapeHtml(draft.sourceUrl) + "</p>" : "")
      + "    " + (volumesLine ? "<p class=\"meta-line\">Объёмы: " + escapeHtml(volumesLine) + "</p>" : "<p class=\"meta-line\">Объёмы пока не заполнены</p>")
      + "    <p class=\"meta-line\">Создан: " + escapeHtml(createdAtLabel || String(draft.createdAt || "")) + "</p>"
      + "    <div class=\"admin-product-actions\">"
      + "      <button class=\"btn btn-ghost\" type=\"button\" data-ai-draft-action=\"open\" data-ai-draft-id=\"" + escapeHtml(draftId) + "\">Открыть</button>"
      + "      <button class=\"btn btn-ghost\" type=\"button\" data-ai-draft-action=\"edit\" data-ai-draft-id=\"" + escapeHtml(draftId) + "\">Редактировать</button>"
      + "      <button class=\"btn btn-primary\" type=\"button\" data-ai-draft-action=\"publish\" data-ai-draft-id=\"" + escapeHtml(draftId) + "\"" + (canPublish ? "" : " disabled") + ">" + (isPublished ? "Опубликован" : "Опубликовать") + "</button>"
      + "      <button class=\"btn btn-ghost\" type=\"button\" data-ai-draft-action=\"delete\" data-ai-draft-id=\"" + escapeHtml(draftId) + "\">Удалить</button>"
      + "    </div>"
      + "  </div>"
      + "</article>";
  }

  function renderAiDrafts() {
    if (!elements.adminAiDraftsList) {
      return;
    }

    var drafts = Array.isArray(state.aiDrafts) ? state.aiDrafts : [];
    var readyCount = drafts.filter(function (draft) {
      return String(draft && draft.status || "") === "ready_to_publish";
    }).length;
    var reviewCount = drafts.filter(function (draft) {
      return String(draft && draft.status || "") === "needs_review";
    }).length;

    if (elements.adminAiDraftsMeta) {
      elements.adminAiDraftsMeta.textContent = "Всего: " + drafts.length + " • Готовы к публикации: " + readyCount + " • Нужна проверка: " + reviewCount;
    }

    if (!drafts.length) {
      elements.adminAiDraftsList.innerHTML = "<div class=\"empty-state\">AI-черновиков пока нет. Создайте первый тестовый черновик вручную.</div>";
      return;
    }

    elements.adminAiDraftsList.innerHTML = drafts.map(function (draft) {
      return buildAiDraftCardMarkup(draft);
    }).join("");
  }

  function openAiDraft(draftId) {
    var draft = getAiDraftById(draftId);
    if (!draft) {
      showToast("AI-черновик не найден.", true);
      return;
    }
    state.aiDraftOpenedId = draftId;
    renderAiDrafts();
    renderAiDraftInsights();
  }

  function startEditAiDraft(draftId) {
    var draft = getAiDraftById(draftId);
    if (!draft) {
      showToast("AI-черновик не найден.", true);
      return;
    }
    fillAiDraftForm(draft);
  }

  async function deleteAiDraft(draftId) {
    var draft = getAiDraftById(draftId);
    if (!draft) {
      return;
    }

    if (!window.confirm("Удалить AI-черновик \"" + (draft.name || "Без названия") + "\"?")) {
      return;
    }

    try {
      await store.deleteAdminAiDraft(draftId);
      if (state.aiDraftEditingId === draftId) {
        resetAiDraftEditor();
      }
      await loadAiDrafts(false);
      showToast("AI-черновик удалён");
    } catch (error) {
      if (String(error && error.message || "").indexOf("401") >= 0 || String(error && error.message || "").indexOf("UNAUTHORIZED") >= 0) {
        logout();
        showToast("Сессия истекла. Войдите снова.", true);
        return;
      }
      showToast("Не удалось удалить AI-черновик.", true);
    }
  }

  async function publishAiDraft(draftId) {
    var draft = getAiDraftById(draftId);
    if (!draft) {
      return;
    }

    if (!window.confirm("Опубликовать AI-черновик как новый товар?")) {
      return;
    }

    try {
      await store.publishAdminAiDraft(draftId);
      await loadAiDrafts(false);
      await loadCatalogPage({ reset: true, showErrorToast: false });
      renderProducts();
      showToast("AI-черновик опубликован как товар");
    } catch (error) {
      var message = String(error && error.message || "");
      if (message.indexOf("401") >= 0 || message.indexOf("UNAUTHORIZED") >= 0) {
        logout();
        showToast("Сессия истекла. Войдите снова.", true);
        return;
      }
      if (message.indexOf("AI_DRAFT_NOT_READY_TO_PUBLISH") >= 0) {
        showToast("Для публикации переведите черновик в статус ready_to_publish.", true);
        await loadAiDrafts(false);
        return;
      }
      if (message.indexOf("AI_DRAFT_CANNOT_BE_PUBLISHED") >= 0) {
        showToast("Черновик нельзя опубликовать: заполните бренд, название, фото и хотя бы один объём.", true);
        return;
      }
      if (message.indexOf("AI_DRAFT_ALREADY_PUBLISHED") >= 0) {
        showToast("Этот черновик уже опубликован.", true);
        await loadAiDrafts(false);
        return;
      }
      showToast("Не удалось опубликовать AI-черновик.", true);
    }
  }

  function onAiDraftListClick(event) {
    var actionButton = event.target.closest("[data-ai-draft-action]");
    if (!actionButton) {
      return;
    }

    var action = String(actionButton.dataset.aiDraftAction || "");
    var draftId = String(actionButton.dataset.aiDraftId || "");
    if (!draftId) {
      return;
    }

    if (action === "open") {
      openAiDraft(draftId);
      return;
    }

    if (action === "edit") {
      startEditAiDraft(draftId);
      return;
    }

    if (action === "delete") {
      deleteAiDraft(draftId);
      return;
    }

    if (action === "publish") {
      publishAiDraft(draftId);
    }
  }

  async function startEdit(productId) {
    var product = null;

    try {
      product = await ensureProductDetails(productId);
    } catch (error) {
      if (String(error && error.message || "").indexOf("401") >= 0 || String(error && error.message || "").indexOf("UNAUTHORIZED") >= 0) {
        logout();
        showToast("Сессия истекла. Войдите снова.", true);
        return;
      }
      showToast("Не удалось загрузить товар для редактирования.", true);
      return;
    }

    if (!product) {
      return;
    }

    state.editingId = product.id;
    state.imageData = product.image;

    elements.editorTitle.textContent = "Редактировать парфюм";
    elements.perfumeIdInput.value = product.id;
    elements.perfumeNameInput.value = product.name;
    elements.perfumeBrandInput.value = product.brand;
    elements.perfumeGenderInput.value = product.gender;
    if (elements.perfumeBottleTypeInput) {
      elements.perfumeBottleTypeInput.value = normalizeBottleType(product.bottleType);
    }
    elements.perfumeDescriptionInput.value = product.description || "";
    elements.topWeekInput.checked = Boolean(product.topWeek);
    elements.topMonthInput.checked = Boolean(product.topMonth);
    elements.perfumeImageInput.value = "";

    setPreviewImage(product.image);

    elements.volumesContainer.innerHTML = "";
    product.volumes.forEach(function (volume) {
      appendVolumeRow({ ml: volume.ml, price: volume.price });
    });

    saveEditorDraftFromForm();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteProduct(productId) {
    var target = getProductById(productId);

    if (!target) {
      return;
    }

    var ok = window.confirm("Удалить аромат \"" + target.name + "\"?");
    if (!ok) {
      return;
    }

    try {
      if (typeof store.deleteAdminProduct === "function") {
        await store.deleteAdminProduct(productId);
      } else {
        var products = store.getProducts();
        var next = products.filter(function (item) {
          return item.id !== productId;
        });
        await store.saveProducts(next);
      }
      await loadCatalogPage({ reset: true, showErrorToast: false });

      var cart = store.getCart().filter(function (item) {
        return item.productId !== productId;
      });
      store.saveCart(cart);

      renderProducts();
      showToast("Товар удалён");

      if (state.editingId === productId) {
        resetEditor();
      }
    } catch (error) {
      showToast("Не удалось удалить товар на сервере.", true);
    }
  }

  function onProductListClick(event) {
    var pendingReviewActionButton = event.target.closest("[data-product-pending-review-action]");
    if (pendingReviewActionButton) {
      var pendingAction = String(pendingReviewActionButton.dataset.productPendingReviewAction || "");
      var pendingProductId = String(pendingReviewActionButton.dataset.productId || "");
      var pendingReviewId = String(pendingReviewActionButton.dataset.reviewId || "");

      if (!pendingProductId || !pendingReviewId) {
        return;
      }

      if (pendingAction === "approve") {
        approvePendingProductReview(pendingProductId, pendingReviewId);
        return;
      }

      if (pendingAction === "reject") {
        rejectPendingProductReview(pendingProductId, pendingReviewId);
        return;
      }
    }

    var reviewActionButton = event.target.closest("[data-product-review-action]");
    if (reviewActionButton) {
      var reviewAction = String(reviewActionButton.dataset.productReviewAction || "");
      var reviewProductId = String(reviewActionButton.dataset.productId || "");
      var reviewId = String(reviewActionButton.dataset.reviewId || "");

      if (!reviewProductId || !reviewId) {
        return;
      }

      if (reviewAction === "edit") {
        editProductReview(reviewProductId, reviewId);
        return;
      }

      if (reviewAction === "delete") {
        deleteProductReview(reviewProductId, reviewId);
        return;
      }
    }

    var actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
      return;
    }

    var action = actionButton.dataset.action;
    var id = actionButton.dataset.id;

    if (action === "toggle-reviews") {
      toggleProductReviews(id);
      return;
    }

    if (action === "edit") {
      startEdit(id);
    }

    if (action === "delete") {
      deleteProduct(id);
    }
  }

  async function onProductListChange(event) {
    var toggle = event.target.closest("[data-toggle]");
    if (!toggle) {
      return;
    }

    var id = toggle.dataset.id;
    var mode = toggle.dataset.toggle;
    var checked = Boolean(toggle.checked);
    var product = null;
    try {
      product = await ensureProductDetails(id);
    } catch (error) {
      toggle.checked = !checked;
      showToast("Не удалось загрузить полные данные товара.", true);
      return;
    }
    if (!product) {
      toggle.checked = !checked;
      showToast("Товар не найден. Обновите каталог.", true);
      return;
    }
    var nextProduct = Object.assign({}, product);
    if (mode === "week") {
      nextProduct.topWeek = checked;
    }
    if (mode === "month") {
      nextProduct.topMonth = checked;
    }

    try {
      if (typeof store.upsertAdminProduct === "function") {
        await store.upsertAdminProduct(nextProduct);
      } else {
        var products = store.getProducts();
        var next = products.map(function (item) {
          return item.id === id ? nextProduct : item;
        });
        await store.saveProducts(next);
      }
      await loadCatalogPage({ reset: true, showErrorToast: false });
      showToast("Топ-статус обновлён");
    } catch (error) {
      showToast("Не удалось обновить топ-статус на сервере.", true);
      toggle.checked = !checked;
    }
  }

  function findProductReviewEntry(productId, reviewId) {
    var product = getProductById(productId);
    if (!product) {
      return null;
    }

    var reviews = Array.isArray(product.reviews) ? product.reviews : [];
    var review = reviews.find(function (item) {
      return String(item && item.id) === String(reviewId);
    });

    if (!review) {
      return null;
    }

    return {
      product: product,
      review: review
    };
  }

  function normalizeSearchValue(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getSyncErrorToastMessage(error) {
    var message = String(error && error.message || "");
    if (!message) {
      return "Не удалось сохранить изменения на сервер.";
    }
    if (message.indexOf("STORE_PRECONDITION_REQUIRED") >= 0) {
      return "Нужно обновить данные с сервера. Перезагрузите админку и повторите.";
    }
    if (message.indexOf("STORE_VERSION_MISMATCH") >= 0) {
      return "Данные изменились в другой сессии. Обновите страницу админки и повторите.";
    }
    if (message.indexOf("CATALOG_SHRINK_BLOCKED") >= 0) {
      return "Сервер заблокировал подозрительное массовое удаление товаров. Обновите данные и повторите.";
    }
    if (message.indexOf("CATALOG_DELETE_INTENT_MISMATCH") >= 0) {
      return "Сервер заблокировал сохранение: набор удаляемых товаров не совпал. Обновите админку и повторите.";
    }
    if (message.indexOf("CATALOG_IMAGE_INTEGRITY_BLOCKED") >= 0) {
      return "Сервер заблокировал сохранение: слишком много фото товаров стали недоступны. Обновите админку и повторите.";
    }
    if (message.indexOf("PRODUCT_IMAGE_UNRECOVERABLE") >= 0) {
      return "Фото товара недоступно. Обновите карточку товара или загрузите фото заново.";
    }
    if (message.indexOf("NETWORK_TIMEOUT") >= 0) {
      return "Таймаут сети. Проверьте интернет и повторите.";
    }
    if (message.indexOf("Failed to fetch") >= 0 || message.indexOf("NetworkError") >= 0) {
      return "Проблема сети. Изменения не записаны на сервер.";
    }
    return "Не удалось сохранить изменения на сервер.";
  }

  function onCatalogSearchInput(event) {
    var nextQuery = normalizeSearchValue(event && event.target && event.target.value);
    state.catalogSearchQuery = nextQuery;

    if (state.catalogSearchDebounceTimer) {
      clearTimeout(state.catalogSearchDebounceTimer);
    }

    state.catalogSearchDebounceTimer = setTimeout(function () {
      state.catalogSearchDebounceTimer = null;
      loadCatalogPage({ reset: true, showErrorToast: false });
    }, SEARCH_INPUT_DEBOUNCE_MS);
  }

  function clearCatalogSearch() {
    state.catalogSearchQuery = "";
    if (elements.adminCatalogSearchInput) {
      elements.adminCatalogSearchInput.value = "";
      elements.adminCatalogSearchInput.focus();
    }
    loadCatalogPage({ reset: true, showErrorToast: false });
  }

  function onCatalogLoadMore() {
    if (state.catalogLoading || !state.catalogHasMore) {
      return;
    }
    loadCatalogPage({ reset: false, showErrorToast: true });
  }

  function resetCatalogState() {
    if (state.catalogSearchDebounceTimer) {
      clearTimeout(state.catalogSearchDebounceTimer);
      state.catalogSearchDebounceTimer = null;
    }
    clearCatalogPrefetchTimer();
    state.catalogItems = [];
    state.catalogTotalCount = 0;
    state.catalogFilteredCount = 0;
    state.catalogHasMore = false;
    state.catalogNextOffset = 0;
    state.catalogLoading = false;
    state.catalogBackgroundLoading = false;
    state.catalogRequestId += 1;
    state.expandedProductReviews = {};
  }

  function clearCatalogPrefetchTimer() {
    if (!state.catalogPrefetchTimer) {
      return;
    }
    clearTimeout(state.catalogPrefetchTimer);
    state.catalogPrefetchTimer = null;
  }

  function shouldAutoPrefetchCatalog() {
    if (!CATALOG_AUTO_PREFETCH_ENABLED) {
      return false;
    }
    if (state.catalogSearchQuery) {
      return false;
    }
    if (!state.catalogHasMore) {
      return false;
    }
    if (state.catalogLoading || state.catalogBackgroundLoading) {
      return false;
    }
    return true;
  }

  function scheduleCatalogPrefetch() {
    clearCatalogPrefetchTimer();
    if (!shouldAutoPrefetchCatalog()) {
      return;
    }

    state.catalogPrefetchTimer = setTimeout(function () {
      state.catalogPrefetchTimer = null;
      loadCatalogPage({
        reset: false,
        showErrorToast: false,
        background: true
      });
    }, CATALOG_PREFETCH_DELAY_MS);
  }

  function updateCatalogMeta() {
    if (!elements.adminCatalogMeta) {
      return;
    }

    var totalCount = Math.max(0, Math.round(Number(state.catalogTotalCount) || 0));
    var filteredCount = Math.max(0, Math.round(Number(state.catalogFilteredCount) || 0));
    var shown = Array.isArray(state.catalogItems) ? state.catalogItems.length : 0;

    if (state.catalogLoading && !shown) {
      elements.adminCatalogMeta.textContent = "Загрузка каталога...";
      return;
    }

    if (!totalCount && !state.catalogLoading) {
      elements.adminCatalogMeta.textContent = "Каталог пуст. Добавьте первый аромат.";
      return;
    }

    if (!state.catalogSearchQuery) {
      elements.adminCatalogMeta.textContent = state.catalogHasMore
        ? "Загружено " + shown + " из " + totalCount + " товаров. Для остальных нажмите «Показать еще»."
        : "Загружено " + shown + " из " + totalCount + " товаров.";
      return;
    }

    elements.adminCatalogMeta.textContent = state.catalogHasMore
      ? "Найдено " + filteredCount + " из " + totalCount + " товаров. Загружено " + shown + ". Для остальных нажмите «Показать еще»."
      : "Найдено " + filteredCount + " из " + totalCount + " товаров. Загружено " + shown + ".";
  }

  function updateCatalogLoadMoreButton() {
    if (!elements.adminCatalogLoadMoreBtn) {
      return;
    }

    var shown = Array.isArray(state.catalogItems) ? state.catalogItems.length : 0;
    var remaining = Math.max(0, Math.round(Number(state.catalogFilteredCount) || 0) - shown);
    var isBusy = state.catalogLoading || state.catalogBackgroundLoading;

    if (state.catalogHasMore && remaining > 0) {
      elements.adminCatalogLoadMoreBtn.classList.remove("hidden");
      elements.adminCatalogLoadMoreBtn.textContent = isBusy
        ? "Загрузка..."
        : "Показать ещё (" + remaining + ")";
      elements.adminCatalogLoadMoreBtn.disabled = isBusy;
      return;
    }

    elements.adminCatalogLoadMoreBtn.classList.add("hidden");
    elements.adminCatalogLoadMoreBtn.disabled = false;
  }

  function getProductById(productId) {
    var safeId = String(productId || "").trim();
    if (!safeId) {
      return null;
    }

    var fromCatalog = (state.catalogItems || []).find(function (item) {
      return String(item && item.id) === safeId;
    });
    if (fromCatalog) {
      return fromCatalog;
    }

    var fallbackProducts = typeof store.getProducts === "function" ? store.getProducts() : [];
    return (fallbackProducts || []).find(function (item) {
      return String(item && item.id) === safeId;
    }) || null;
  }

  function replaceCatalogProduct(nextProduct) {
    var safeProduct = nextProduct && typeof nextProduct === "object" ? nextProduct : null;
    var safeId = String(safeProduct && safeProduct.id || "").trim();
    if (!safeId) {
      return;
    }

    state.catalogItems = (Array.isArray(state.catalogItems) ? state.catalogItems : []).map(function (item) {
      if (String(item && item.id) !== safeId) {
        return item;
      }
      return Object.assign({}, item, safeProduct);
    });
  }

  async function ensureProductDetails(productId) {
    var current = getProductById(productId);
    if (current && current.detailsLoaded !== false) {
      return current;
    }

    if (typeof store.fetchAdminProductById !== "function") {
      return current;
    }

    var fullProduct = await store.fetchAdminProductById(productId);
    replaceCatalogProduct(fullProduct);
    return fullProduct;
  }

  async function loadCatalogPage(options) {
    var safeOptions = options && typeof options === "object" ? options : {};
    var shouldReset = Boolean(safeOptions.reset);
    var showErrorToast = safeOptions.showErrorToast !== false;
    var isBackground = Boolean(safeOptions.background);

    if (typeof store.fetchAdminCatalogPage !== "function") {
      var fallbackProducts = typeof store.getProducts === "function" ? store.getProducts() : [];
      state.catalogItems = Array.isArray(fallbackProducts) ? fallbackProducts.slice(0, CATALOG_PAGE_SIZE) : [];
      state.catalogTotalCount = Array.isArray(fallbackProducts) ? fallbackProducts.length : 0;
      state.catalogFilteredCount = state.catalogTotalCount;
      state.catalogHasMore = state.catalogTotalCount > state.catalogItems.length;
      state.catalogNextOffset = state.catalogItems.length;
      state.catalogLoading = false;
      state.catalogBackgroundLoading = false;
      renderProducts();
      return;
    }

    if (shouldReset) {
      clearCatalogPrefetchTimer();
      state.catalogItems = [];
      state.catalogHasMore = false;
      state.catalogNextOffset = 0;
      state.expandedProductReviews = {};
    }

    var requestOffset = shouldReset ? 0 : Math.max(0, Math.round(Number(state.catalogNextOffset) || 0));
    var requestId = state.catalogRequestId + 1;
    state.catalogRequestId = requestId;
    if (isBackground) {
      state.catalogBackgroundLoading = true;
    } else {
      state.catalogLoading = true;
    }
    renderProducts();

    try {
      var payload = await store.fetchAdminCatalogPage({
        query: state.catalogSearchQuery,
        offset: requestOffset,
        limit: CATALOG_PAGE_SIZE
      });

      if (requestId !== state.catalogRequestId) {
        return;
      }

      var incomingItems = Array.isArray(payload && payload.items) ? payload.items : [];
      if (shouldReset) {
        state.catalogItems = incomingItems.slice();
      } else {
        var merged = Array.isArray(state.catalogItems) ? state.catalogItems.slice() : [];
        var knownIds = {};
        merged.forEach(function (item) {
          knownIds[String(item && item.id || "")] = true;
        });
        incomingItems.forEach(function (item) {
          var id = String(item && item.id || "");
          if (!id || knownIds[id]) {
            return;
          }
          knownIds[id] = true;
          merged.push(item);
        });
        state.catalogItems = merged;
      }

      state.catalogTotalCount = Math.max(0, Math.round(Number(payload && payload.total) || 0));
      state.catalogFilteredCount = Math.max(0, Math.round(Number(payload && payload.filteredTotal) || 0));
      state.catalogHasMore = Boolean(payload && payload.hasMore);
      state.catalogNextOffset = Math.max(0, Math.round(Number(payload && payload.nextOffset) || state.catalogItems.length));
    } catch (error) {
      if (requestId !== state.catalogRequestId) {
        return;
      }
      if (String(error && error.message || "").indexOf("401") >= 0 || String(error && error.message || "").indexOf("UNAUTHORIZED") >= 0) {
        logout();
        showToast("Сессия истекла. Войдите снова.", true);
        return;
      }
      if (showErrorToast) {
        showToast("Не удалось загрузить каталог. Проверьте интернет и попробуйте ещё.", true);
      }
    } finally {
      if (requestId === state.catalogRequestId) {
        state.catalogLoading = false;
        state.catalogBackgroundLoading = false;
        renderProducts();
        scheduleCatalogPrefetch();
      }
    }
  }

  async function toggleProductReviews(productId) {
    var safeProductId = String(productId || "").trim();
    if (!safeProductId) {
      return;
    }

    var card = elements.adminProductsList.querySelector("[data-product-id=\"" + cssEscapeValue(safeProductId) + "\"]");
    if (!card) {
      return;
    }

    var panel = card.querySelector("[data-product-reviews-panel]");
    var button = card.querySelector("[data-action=\"toggle-reviews\"]");
    if (!panel || !button) {
      return;
    }

    var isOpen = !panel.hasAttribute("hidden");
    if (isOpen) {
      panel.setAttribute("hidden", "hidden");
      panel.innerHTML = "";
      button.textContent = "Показать отзывы";
      state.expandedProductReviews[safeProductId] = false;
      return;
    }

    var product = null;
    try {
      product = await ensureProductDetails(safeProductId);
    } catch (error) {
      showToast("Не удалось загрузить отзывы товара.", true);
      return;
    }
    if (!product) {
      return;
    }

    panel.innerHTML = buildProductReviewsPanel(product);
    panel.removeAttribute("hidden");
    button.textContent = "Скрыть отзывы";
    state.expandedProductReviews[safeProductId] = true;
  }

  function findPendingProductReviewEntry(productId, reviewId) {
    var product = getProductById(productId);
    if (!product) {
      return null;
    }

    var pendingReviews = Array.isArray(product.pendingReviews) ? product.pendingReviews : [];
    var review = pendingReviews.find(function (item) {
      return String(item && item.id) === String(reviewId);
    });

    if (!review) {
      return null;
    }

    return {
      product: product,
      review: review
    };
  }

  async function approvePendingProductReview(productId, reviewId) {
    try {
      await ensureProductDetails(productId);
    } catch (error) {
      showToast("Не удалось загрузить отзывы товара.", true);
      return;
    }

    var entry = findPendingProductReviewEntry(productId, reviewId);
    if (!entry) {
      showToast("Отзыв на модерации не найден.", true);
      return;
    }

    var product = Object.assign({}, entry.product);
    var published = Array.isArray(product.reviews) ? product.reviews.slice() : [];
    var pending = Array.isArray(product.pendingReviews) ? product.pendingReviews : [];
    published.unshift(Object.assign({}, entry.review, {
      id: String(entry.review.id || store.uid("pr")).replace(/^ppr_/, "pr_")
    }));

    var nextProduct = Object.assign({}, product, {
      reviews: published,
      pendingReviews: pending.filter(function (item) {
        return String(item && item.id) !== String(reviewId);
      })
    });

    try {
      await store.upsertAdminProduct(nextProduct);
      await loadCatalogPage({ reset: true, showErrorToast: false });
      renderProducts();
      showToast("Отзыв опубликован.");
    } catch (error) {
      if (String(error && error.message || "").indexOf("401") >= 0 || String(error && error.message || "").indexOf("UNAUTHORIZED") >= 0) {
        logout();
        showToast("Сессия истекла. Войдите снова.", true);
        return;
      }
      showToast("Не удалось опубликовать отзыв.", true);
    }
  }

  async function rejectPendingProductReview(productId, reviewId) {
    try {
      await ensureProductDetails(productId);
    } catch (error) {
      showToast("Не удалось загрузить отзывы товара.", true);
      return;
    }

    var entry = findPendingProductReviewEntry(productId, reviewId);
    if (!entry) {
      showToast("Отзыв на модерации не найден.", true);
      return;
    }

    var ok = window.confirm("Отклонить отзыв \"" + entry.review.author + "\" для аромата \"" + entry.product.name + "\"?");
    if (!ok) {
      return;
    }

    var product = Object.assign({}, entry.product);
    var pending = Array.isArray(product.pendingReviews) ? product.pendingReviews : [];
    var nextProduct = Object.assign({}, product, {
      pendingReviews: pending.filter(function (item) {
        return String(item && item.id) !== String(reviewId);
      })
    });

    try {
      await store.upsertAdminProduct(nextProduct);
      await loadCatalogPage({ reset: true, showErrorToast: false });
      renderProducts();
      showToast("Отзыв отклонён.");
    } catch (error) {
      if (String(error && error.message || "").indexOf("401") >= 0 || String(error && error.message || "").indexOf("UNAUTHORIZED") >= 0) {
        logout();
        showToast("Сессия истекла. Войдите снова.", true);
        return;
      }
      showToast("Не удалось отклонить отзыв.", true);
    }
  }

  async function editProductReview(productId, reviewId) {
    try {
      await ensureProductDetails(productId);
    } catch (error) {
      showToast("Не удалось загрузить отзывы товара.", true);
      return;
    }

    var entry = findProductReviewEntry(productId, reviewId);
    if (!entry) {
      showToast("Отзыв не найден.", true);
      return;
    }

    var nextAuthor = window.prompt("Имя автора:", String(entry.review.author || ""));
    if (nextAuthor === null) {
      return;
    }
    nextAuthor = String(nextAuthor || "").trim();
    if (!nextAuthor || nextAuthor.length < 2) {
      showToast("Имя автора должно быть не короче 2 символов.", true);
      return;
    }

    var nextCity = window.prompt("Город (можно оставить пустым):", String(entry.review.city || ""));
    if (nextCity === null) {
      return;
    }
    nextCity = String(nextCity || "").trim();

    var nextRatingRaw = window.prompt(
      "Оценка от 1 до 5:",
      String(Math.max(1, Math.min(5, Math.round(Number(entry.review.rating) || 5))))
    );
    if (nextRatingRaw === null) {
      return;
    }

    var parsedRating = Number(nextRatingRaw);
    if (!Number.isFinite(parsedRating)) {
      showToast("Оценка должна быть числом от 1 до 5.", true);
      return;
    }

    var nextRating = Math.max(1, Math.min(5, Math.round(parsedRating)));
    var nextText = window.prompt("Текст отзыва:", String(entry.review.text || ""));
    if (nextText === null) {
      return;
    }
    nextText = String(nextText || "").trim();
    if (!nextText || nextText.length < 6) {
      showToast("Текст отзыва должен быть не короче 6 символов.", true);
      return;
    }

    var product = Object.assign({}, entry.product);
    var currentReviews = Array.isArray(product.reviews) ? product.reviews : [];
    var updatedReviews = currentReviews.map(function (review) {
      if (String(review && review.id) !== String(reviewId)) {
        return review;
      }
      return Object.assign({}, review, {
        author: nextAuthor,
        city: nextCity,
        rating: nextRating,
        text: nextText
      });
    });
    var nextProduct = Object.assign({}, product, {
      reviews: updatedReviews
    });

    try {
      await store.upsertAdminProduct(nextProduct);
      await loadCatalogPage({ reset: true, showErrorToast: false });
      renderProducts();
      showToast("Отзыв обновлён.");
    } catch (error) {
      if (String(error && error.message || "").indexOf("401") >= 0 || String(error && error.message || "").indexOf("UNAUTHORIZED") >= 0) {
        logout();
        showToast("Сессия истекла. Войдите снова.", true);
        return;
      }
      showToast("Не удалось обновить отзыв на сервере.", true);
    }
  }

  async function deleteProductReview(productId, reviewId) {
    try {
      await ensureProductDetails(productId);
    } catch (error) {
      showToast("Не удалось загрузить отзывы товара.", true);
      return;
    }

    var entry = findProductReviewEntry(productId, reviewId);
    if (!entry) {
      showToast("Отзыв не найден.", true);
      return;
    }

    var ok = window.confirm("Удалить отзыв автора \"" + entry.review.author + "\" для аромата \"" + entry.product.name + "\"?");
    if (!ok) {
      return;
    }

    var product = Object.assign({}, entry.product);
    var currentReviews = Array.isArray(product.reviews) ? product.reviews : [];
    var nextProduct = Object.assign({}, product, {
      reviews: currentReviews.filter(function (review) {
        return String(review && review.id) !== String(reviewId);
      })
    });

    try {
      await store.upsertAdminProduct(nextProduct);
      await loadCatalogPage({ reset: true, showErrorToast: false });
      renderProducts();
      showToast("Отзыв удалён.");
    } catch (error) {
      if (String(error && error.message || "").indexOf("401") >= 0 || String(error && error.message || "").indexOf("UNAUTHORIZED") >= 0) {
        logout();
        showToast("Сессия истекла. Войдите снова.", true);
        return;
      }
      showToast("Не удалось удалить отзыв на сервере.", true);
    }
  }

  function renderProducts() {
    if (elements.adminCatalogSearchInput) {
      var normalizedFromInput = normalizeSearchValue(elements.adminCatalogSearchInput.value);
      if (normalizedFromInput !== state.catalogSearchQuery) {
        state.catalogSearchQuery = normalizedFromInput;
      }
      if (elements.adminCatalogSearchClearBtn) {
        elements.adminCatalogSearchClearBtn.disabled = !state.catalogSearchQuery;
      }
    }

    var visibleProducts = Array.isArray(state.catalogItems) ? state.catalogItems : [];

    updateCatalogMeta();
    updateCatalogLoadMoreButton();

    if (!visibleProducts.length && state.catalogLoading) {
      elements.adminProductsList.innerHTML = "<div class=\"empty-state\">Загрузка каталога...</div>";
      return;
    }

    if (!visibleProducts.length && state.catalogTotalCount <= 0) {
      elements.adminProductsList.innerHTML = "<div class=\"empty-state\">Каталог пуст. Добавьте первый аромат.</div>";
      return;
    }

    if (!visibleProducts.length && state.catalogSearchQuery) {
      elements.adminProductsList.innerHTML = "<div class=\"empty-state\">По запросу ничего не найдено.</div>";
      return;
    }

    elements.adminProductsList.innerHTML = visibleProducts.map(function (product) {
      return buildProductCardMarkup(product);
    }).join("");

    visibleProducts.forEach(function (product) {
      if (!state.expandedProductReviews[String(product.id)]) {
        return;
      }
      toggleProductReviews(product.id);
    });
  }

  function buildProductCardMarkup(product) {
    var volumesLine = (Array.isArray(product.volumes) ? product.volumes : []).map(function (volume) {
      return formatMlValue(volume.ml) + "ml - " + store.formatPrice(volume.price);
    }).join(" | ");

    var productReviewsCount = Math.max(
      Array.isArray(product.reviews) ? product.reviews.length : 0,
      Math.max(0, Math.round(Number(product.reviewsCount) || 0))
    );
    var pendingProductReviewsCount = Math.max(
      Array.isArray(product.pendingReviews) ? product.pendingReviews.length : 0,
      Math.max(0, Math.round(Number(product.pendingReviewsCount) || 0))
    );
    var productId = String(product.id || "");

    return ""
      + "<article class=\"admin-product-card\" data-product-id=\"" + escapeHtml(productId) + "\">"
      + "  <img loading=\"lazy\" decoding=\"async\" data-fallback-image=\"" + escapeHtml(PRODUCT_PLACEHOLDER_IMAGE) + "\" src=\"" + escapeHtml(product.image) + "\" alt=\"" + escapeHtml(product.name) + "\">"
      + "  <div class=\"admin-product-body\">"
      + "    <div class=\"admin-product-head\">"
      + "      <div class=\"admin-product-title\">"
      + "        <strong>" + escapeHtml(product.name) + "</strong>"
      + "        <span>" + escapeHtml(product.brand) + " | " + store.getGenderLabel(product.gender) + " | " + store.getBottleTypeLabel(product.bottleType) + "</span>"
      + "      </div>"
      + "      <div class=\"admin-product-actions\">"
      + "        <button class=\"btn btn-ghost\" type=\"button\" data-action=\"edit\" data-id=\"" + escapeHtml(productId) + "\">Редактировать</button>"
      + "        <button class=\"btn btn-ghost\" type=\"button\" data-action=\"delete\" data-id=\"" + escapeHtml(productId) + "\">Удалить</button>"
      + "      </div>"
      + "    </div>"
      + "    <p class=\"meta-line\">" + escapeHtml(volumesLine) + "</p>"
      + "    <div class=\"admin-product-actions\">"
      + "      <label class=\"toggle-inline\"><input type=\"checkbox\" data-toggle=\"week\" data-id=\"" + escapeHtml(productId) + "\" " + (product.topWeek ? "checked" : "") + ">Топ недели</label>"
      + "      <label class=\"toggle-inline\"><input type=\"checkbox\" data-toggle=\"month\" data-id=\"" + escapeHtml(productId) + "\" " + (product.topMonth ? "checked" : "") + ">Топ месяца</label>"
      + "    </div>"
      + "    <div class=\"admin-product-review-summary\">"
      + "      <span>Отзывы: " + productReviewsCount + " • На модерации: " + pendingProductReviewsCount + "</span>"
      + "      <button class=\"btn btn-ghost\" type=\"button\" data-action=\"toggle-reviews\" data-id=\"" + escapeHtml(productId) + "\">Показать отзывы</button>"
      + "    </div>"
      + "    <div class=\"admin-product-reviews\" data-product-reviews-panel hidden></div>"
      + "  </div>"
      + "</article>";
  }

  function buildProductReviewsPanel(product) {
    var productReviews = Array.isArray(product.reviews) ? product.reviews : [];
    var pendingProductReviews = Array.isArray(product.pendingReviews) ? product.pendingReviews : [];
    var productId = String(product.id || "");
    var productReviewsHtml = "";
    var pendingProductReviewsHtml = "";

    if (!productReviews.length) {
      productReviewsHtml = "<div class=\"admin-product-review-empty\">Пока нет опубликованных отзывов.</div>";
    } else {
      productReviewsHtml = "<div class=\"admin-product-reviews-list\">"
        + productReviews.map(function (review) {
          var cityPart = review.city ? (", " + escapeHtml(review.city)) : "";
          var photoHtml = review.photo
            ? "<img class=\"admin-review-photo\" loading=\"lazy\" decoding=\"async\" src=\"" + escapeHtml(review.photo) + "\" alt=\"Фото к отзыву\">"
            : "";
          return ""
            + "<article class=\"admin-review-card\">"
            + "  <div class=\"admin-review-head\">"
            + "    <div>"
            + "      <strong>" + escapeHtml(review.author) + cityPart + "</strong>"
            + "      <div class=\"admin-review-meta\">" + escapeHtml(formatReviewDate(review.createdAt)) + "</div>"
            +        renderReviewConsentMeta(review)
            + "    </div>"
            + "    <span class=\"admin-review-rating\">" + buildStars(review.rating) + "</span>"
            + "  </div>"
            + photoHtml
            + "  <p class=\"admin-review-text\">" + escapeHtml(review.text) + "</p>"
            + "  <div class=\"admin-review-actions\">"
            + "    <button class=\"btn btn-ghost\" type=\"button\" data-product-review-action=\"edit\" data-product-id=\"" + escapeHtml(productId) + "\" data-review-id=\"" + escapeHtml(review.id) + "\">Редактировать</button>"
            + "    <button class=\"btn btn-ghost\" type=\"button\" data-product-review-action=\"delete\" data-product-id=\"" + escapeHtml(productId) + "\" data-review-id=\"" + escapeHtml(review.id) + "\">Удалить</button>"
            + "  </div>"
            + "</article>";
        }).join("")
        + "</div>";
    }

    if (!pendingProductReviews.length) {
      pendingProductReviewsHtml = "<div class=\"admin-product-review-empty\">На модерации пока нет отзывов.</div>";
    } else {
      pendingProductReviewsHtml = "<div class=\"admin-product-reviews-list\">"
        + pendingProductReviews.map(function (review) {
          var cityPart = review.city ? (", " + escapeHtml(review.city)) : "";
          var photoHtml = review.photo
            ? "<img class=\"admin-review-photo\" loading=\"lazy\" decoding=\"async\" src=\"" + escapeHtml(review.photo) + "\" alt=\"Фото к отзыву\">"
            : "";
          return ""
            + "<article class=\"admin-review-card admin-review-card-pending\">"
            + "  <div class=\"admin-review-head\">"
            + "    <div>"
            + "      <strong>" + escapeHtml(review.author) + cityPart + "</strong>"
            + "      <div class=\"admin-review-meta\">" + escapeHtml(formatReviewDate(review.createdAt)) + "</div>"
            +        renderReviewConsentMeta(review)
            + "    </div>"
            + "    <span class=\"admin-review-rating\">" + buildStars(review.rating) + "</span>"
            + "  </div>"
            + photoHtml
            + "  <p class=\"admin-review-text\">" + escapeHtml(review.text) + "</p>"
            + "  <div class=\"admin-review-actions\">"
            + "    <button class=\"btn btn-primary\" type=\"button\" data-product-pending-review-action=\"approve\" data-product-id=\"" + escapeHtml(productId) + "\" data-review-id=\"" + escapeHtml(review.id) + "\">Опубликовать</button>"
            + "    <button class=\"btn btn-ghost\" type=\"button\" data-product-pending-review-action=\"reject\" data-product-id=\"" + escapeHtml(productId) + "\" data-review-id=\"" + escapeHtml(review.id) + "\">Отклонить</button>"
            + "  </div>"
            + "</article>";
        }).join("")
        + "</div>";
    }

    return ""
      + "<div class=\"admin-product-reviews-head\">"
      + "  <strong>Отзывы к аромату</strong>"
      + "  <span>Опубликовано: " + productReviews.length + "</span>"
      + "</div>"
      + productReviewsHtml
      + "<div class=\"admin-product-reviews-head\">"
      + "  <strong>На модерации</strong>"
      + "  <span>Всего: " + pendingProductReviews.length + "</span>"
      + "</div>"
      + pendingProductReviewsHtml;
  }

  function buildStars(value) {
    var safeRating = Math.max(1, Math.min(5, Math.round(Number(value) || 5)));
    return "\u2605".repeat(safeRating) + "\u2606".repeat(5 - safeRating);
  }

  function formatReviewDate(value) {
    var parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    return parsed.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function renderReviewConsentMeta(review) {
    var proof = review && review.consentProof && typeof review.consentProof === "object"
      ? review.consentProof
      : null;
    if (!proof) {
      return "<div class=\"admin-review-consent\">Согласие: не зафиксировано</div>";
    }

    var acceptedAt = formatReviewDate(proof.acceptedAt);
    var version = String(proof.version || "").trim();
    var ip = String(proof.ip || "").trim();
    var parts = [];

    if (acceptedAt) {
      parts.push("Согласие: " + escapeHtml(acceptedAt));
    } else {
      parts.push("Согласие: зафиксировано");
    }
    if (version) {
      parts.push("версия " + escapeHtml(version));
    }
    if (ip) {
      parts.push("IP " + escapeHtml(ip));
    }

    return "<div class=\"admin-review-consent\">" + parts.join(" • ") + "</div>";
  }

  function resetHomepageReviewEditor() {
    state.homepageReviewEditingId = null;
    if (!elements.homepageReviewForm) {
      return;
    }

    elements.homepageReviewForm.reset();
    elements.homepageReviewIdInput.value = "";
    if (elements.homepageReviewRatingInput) {
      elements.homepageReviewRatingInput.value = "5";
    }
    if (elements.homepageReviewsEditorTitle) {
      elements.homepageReviewsEditorTitle.textContent = "Добавить отзыв на главную";
    }
  }

  function startEditHomepageReview(reviewId) {
    if (typeof store.getHomepageReviews !== "function") {
      showToast("Обновите scripts/common.js, чтобы редактировать отзывы.", true);
      return;
    }

    var reviews = store.getHomepageReviews();
    var target = reviews.find(function (review) {
      return String(review && review.id) === String(reviewId);
    });
    if (!target) {
      return;
    }

    state.homepageReviewEditingId = String(target.id);
    elements.homepageReviewIdInput.value = String(target.id);
    elements.homepageReviewAuthorInput.value = String(target.author || "");
    elements.homepageReviewCityInput.value = String(target.city || "");
    elements.homepageReviewRatingInput.value = String(Math.max(1, Math.min(5, Math.round(Number(target.rating) || 5))));
    elements.homepageReviewTextInput.value = String(target.text || "");
    if (elements.homepageReviewsEditorTitle) {
      elements.homepageReviewsEditorTitle.textContent = "Редактировать отзыв на главной";
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveHomepageReview(event) {
    event.preventDefault();

    if (typeof store.getHomepageReviews !== "function" || typeof store.saveHomepageReviews !== "function") {
      showToast("Обновите scripts/common.js, чтобы сохранять отзывы.", true);
      return;
    }

    var reviewId = String(elements.homepageReviewIdInput.value || "").trim();
    var author = String(elements.homepageReviewAuthorInput.value || "").trim();
    var city = String(elements.homepageReviewCityInput.value || "").trim();
    var text = String(elements.homepageReviewTextInput.value || "").trim();
    var rating = Math.max(1, Math.min(5, Math.round(Number(elements.homepageReviewRatingInput.value) || 5)));

    if (!author || author.length < 2) {
      showToast("Укажите имя автора отзыва.", true);
      return;
    }

    if (!text || text.length < 6) {
      showToast("Текст отзыва должен быть не короче 6 символов.", true);
      return;
    }

    var reviews = store.getHomepageReviews();
    var nowIso = new Date().toISOString();
    var payload = {
      id: reviewId || store.uid("hr"),
      author: author,
      city: city,
      text: text,
      rating: rating,
      createdAt: nowIso
    };

    if (reviewId) {
      var existing = reviews.find(function (item) {
        return String(item.id) === reviewId;
      });
      if (existing && existing.createdAt) {
        payload.createdAt = existing.createdAt;
      }
      if (existing && existing.photo) {
        payload.photo = existing.photo;
      }
      if (existing && existing.consentProof) {
        payload.consentProof = existing.consentProof;
      }
      reviews = reviews.map(function (item) {
        return String(item.id) === reviewId ? payload : item;
      });
    } else {
      reviews.unshift(payload);
    }

    try {
      await store.saveHomepageReviews(reviews);
      renderHomepageReviews();
      resetHomepageReviewEditor();
      showToast(reviewId ? "Отзыв на главной обновлён." : "Отзыв на главной добавлен.");
    } catch (error) {
      showToast("Не удалось сохранить отзыв на сервере.", true);
    }
  }

  async function deleteHomepageReview(reviewId) {
    if (typeof store.getHomepageReviews !== "function" || typeof store.saveHomepageReviews !== "function") {
      showToast("Обновите scripts/common.js, чтобы удалять отзывы.", true);
      return;
    }

    var reviews = store.getHomepageReviews();
    var target = reviews.find(function (item) {
      return String(item.id) === String(reviewId);
    });
    if (!target) {
      return;
    }

    var ok = window.confirm("Удалить отзыв \"" + target.author + "\"?");
    if (!ok) {
      return;
    }

    var next = reviews.filter(function (item) {
      return String(item.id) !== String(reviewId);
    });

    try {
      await store.saveHomepageReviews(next);
      if (state.homepageReviewEditingId === String(reviewId)) {
        resetHomepageReviewEditor();
      }
      renderHomepageReviews();
      showToast("Отзыв удалён.");
    } catch (error) {
      showToast("Не удалось удалить отзыв на сервере.", true);
    }
  }

  async function approvePendingHomepageReview(reviewId) {
    if (typeof store.getPendingHomepageReviews !== "function" || typeof store.savePendingHomepageReviews !== "function") {
      showToast("Обновите scripts/common.js, чтобы модерировать отзывы.", true);
      return;
    }

    var pending = store.getPendingHomepageReviews();
    var published = store.getHomepageReviews();
    var target = pending.find(function (item) {
      return String(item && item.id) === String(reviewId);
    });
    if (!target) {
      return;
    }

    var nextPending = pending.filter(function (item) {
      return String(item && item.id) !== String(reviewId);
    });
    var nextPublished = [Object.assign({}, target, {
      id: String(target.id || store.uid("hr")).replace(/^phr_/, "hr_")
    })].concat(published);

    try {
      await store.saveHomepageReviews(nextPublished);
      await store.savePendingHomepageReviews(nextPending);
      renderHomepageReviews();
      showToast("Отзыв опубликован.");
    } catch (error) {
      showToast("Не удалось опубликовать отзыв.", true);
    }
  }

  async function rejectPendingHomepageReview(reviewId) {
    if (typeof store.getPendingHomepageReviews !== "function" || typeof store.savePendingHomepageReviews !== "function") {
      showToast("Обновите scripts/common.js, чтобы модерировать отзывы.", true);
      return;
    }

    var pending = store.getPendingHomepageReviews();
    var target = pending.find(function (item) {
      return String(item && item.id) === String(reviewId);
    });
    if (!target) {
      return;
    }

    var ok = window.confirm("Отклонить отзыв \"" + target.author + "\"?");
    if (!ok) {
      return;
    }

    var nextPending = pending.filter(function (item) {
      return String(item && item.id) !== String(reviewId);
    });

    try {
      await store.savePendingHomepageReviews(nextPending);
      renderHomepageReviews();
      showToast("Отзыв отклонён.");
    } catch (error) {
      showToast("Не удалось отклонить отзыв.", true);
    }
  }

  function onHomepageReviewsListClick(event) {
    var publishButton = event.target.closest("[data-review-pending-action]");
    if (publishButton) {
      var pendingAction = String(publishButton.dataset.reviewPendingAction || "");
      var pendingId = String(publishButton.dataset.id || "");
      if (!pendingId) {
        return;
      }

      if (pendingAction === "approve") {
        approvePendingHomepageReview(pendingId);
        return;
      }

      if (pendingAction === "reject") {
        rejectPendingHomepageReview(pendingId);
        return;
      }
    }

    var button = event.target.closest("[data-review-action]");
    if (!button) {
      return;
    }

    var action = String(button.dataset.reviewAction || "");
    var reviewId = String(button.dataset.id || "");
    if (!reviewId) {
      return;
    }

    if (action === "edit") {
      startEditHomepageReview(reviewId);
      return;
    }

    if (action === "delete") {
      deleteHomepageReview(reviewId);
    }
  }

  function renderReviewPhoto(review) {
    if (!review || !review.photo) {
      return "";
    }
    return "<img class=\"admin-review-photo\" src=\"" + escapeHtml(review.photo) + "\" alt=\"Фото к отзыву\">";
  }

  function renderHomepageReviewCards(reviews, withModerationActions) {
    return reviews.map(function (review) {
      var cityPart = review.city ? (", " + escapeHtml(review.city)) : "";
      var actionsHtml = withModerationActions
        ? "<button class=\"btn btn-primary\" type=\"button\" data-review-pending-action=\"approve\" data-id=\"" + escapeHtml(review.id) + "\">\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u0442\u044c</button>"
          + "<button class=\"btn btn-ghost\" type=\"button\" data-review-pending-action=\"reject\" data-id=\"" + escapeHtml(review.id) + "\">\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c</button>"
        : "<button class=\"btn btn-ghost\" type=\"button\" data-review-action=\"edit\" data-id=\"" + escapeHtml(review.id) + "\">Редактировать</button>"
          + "<button class=\"btn btn-ghost\" type=\"button\" data-review-action=\"delete\" data-id=\"" + escapeHtml(review.id) + "\">Удалить</button>";

      return ""
        + "<article class=\"admin-review-card" + (withModerationActions ? " admin-review-card-pending" : "") + "\">"
        + "  <div class=\"admin-review-head\">"
        + "    <div>"
        + "      <strong>" + escapeHtml(review.author) + cityPart + "</strong>"
        + "      <div class=\"admin-review-meta\">" + escapeHtml(formatReviewDate(review.createdAt)) + "</div>"
        +        renderReviewConsentMeta(review)
        + "    </div>"
        + "    <span class=\"admin-review-rating\">" + buildStars(review.rating) + "</span>"
        + "  </div>"
        + renderReviewPhoto(review)
        + "  <p class=\"admin-review-text\">" + escapeHtml(review.text) + "</p>"
        + "  <div class=\"admin-review-actions\">"
        + actionsHtml
        + "  </div>"
        + "</article>";
    }).join("");
  }

  function renderHomepageReviews() {
    if (!elements.adminHomepageReviewsList) {
      return;
    }

    if (typeof store.getHomepageReviews !== "function") {
      elements.adminHomepageReviewsList.innerHTML = "<div class=\"empty-state\">Обновите scripts/common.js, чтобы управлять отзывами.</div>";
      return;
    }

    var pending = typeof store.getPendingHomepageReviews === "function" ? store.getPendingHomepageReviews() : [];
    var published = store.getHomepageReviews();

    if (elements.adminPendingHomepageReviewsList) {
      if (!pending.length) {
        elements.adminPendingHomepageReviewsList.innerHTML = "<div class=\"empty-state\">\u041d\u0430 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043e\u0442\u0437\u044b\u0432\u043e\u0432.</div>";
      } else {
        elements.adminPendingHomepageReviewsList.innerHTML = renderHomepageReviewCards(pending, true);
      }
    }

    if (!published.length) {
      elements.adminHomepageReviewsList.innerHTML = "<div class=\"empty-state\">Пока отзывов на главной нет.</div>";
      return;
    }

    elements.adminHomepageReviewsList.innerHTML = renderHomepageReviewCards(published, false);
  }

  function ensureCapacityMonitorElements() {
    if (elements.capacityMonitor) {
      return;
    }
    if (!elements.panelView) {
      return;
    }

    var topbar = elements.panelView.querySelector(".admin-topbar");
    if (!topbar) {
      return;
    }

    var monitor = document.createElement("section");
    monitor.className = "admin-capacity-monitor admin-capacity-ok";
    monitor.innerHTML = ""
      + "<div class=\"admin-capacity-main\">"
      + "  <span class=\"admin-capacity-dot\" aria-hidden=\"true\"></span>"
      + "  <strong class=\"admin-capacity-status\" data-capacity-status>Емкость: стабильно</strong>"
      + "  <span class=\"admin-capacity-meta\" data-capacity-meta>Идет первая проверка...</span>"
      + "</div>"
      + "<button class=\"btn btn-ghost admin-capacity-refresh\" type=\"button\" data-capacity-refresh>Проверить сейчас</button>";

    topbar.insertAdjacentElement("afterend", monitor);

    elements.capacityMonitor = monitor;
    elements.capacityStatus = monitor.querySelector("[data-capacity-status]");
    elements.capacityMeta = monitor.querySelector("[data-capacity-meta]");
    elements.capacityRefreshBtn = monitor.querySelector("[data-capacity-refresh]");

    if (elements.capacityRefreshBtn) {
      elements.capacityRefreshBtn.addEventListener("click", function () {
        runCapacityCheck(true);
      });
    }
  }

  function ensureImageIntegrityMonitorElements() {
    if (elements.imageIntegrityMonitor) {
      return;
    }
    if (!elements.panelView) {
      return;
    }

    var anchor = elements.capacityMonitor;
    if (!anchor) {
      var topbar = elements.panelView.querySelector(".admin-topbar");
      if (!topbar) {
        return;
      }
      anchor = topbar;
    }

    var monitor = document.createElement("section");
    monitor.className = "admin-image-monitor admin-image-monitor-ok";
    monitor.innerHTML = ""
      + "<div class=\"admin-image-main\">"
      + "  <span class=\"admin-image-dot\" aria-hidden=\"true\"></span>"
      + "  <strong class=\"admin-image-status\" data-image-status>Фото: проверяем целостность</strong>"
      + "  <span class=\"admin-image-meta\" data-image-meta>Первичная проверка еще не завершена.</span>"
      + "</div>"
      + "<div class=\"admin-image-actions\">"
      + "  <button class=\"btn btn-ghost admin-image-refresh\" type=\"button\" data-image-refresh>Проверить фото</button>"
      + "  <button class=\"btn btn-ghost admin-image-repair\" type=\"button\" data-image-repair>Авто-восстановить</button>"
      + "</div>";

    anchor.insertAdjacentElement("afterend", monitor);

    elements.imageIntegrityMonitor = monitor;
    elements.imageIntegrityStatus = monitor.querySelector("[data-image-status]");
    elements.imageIntegrityMeta = monitor.querySelector("[data-image-meta]");
    elements.imageIntegrityRefreshBtn = monitor.querySelector("[data-image-refresh]");
    elements.imageIntegrityRepairBtn = monitor.querySelector("[data-image-repair]");

    if (elements.imageIntegrityRefreshBtn) {
      elements.imageIntegrityRefreshBtn.addEventListener("click", function () {
        runImageIntegrityCheck(true);
      });
    }

    if (elements.imageIntegrityRepairBtn) {
      elements.imageIntegrityRepairBtn.addEventListener("click", function () {
        repairBrokenProductImages();
      });
    }
  }

  function getImageIntegrityLevelPriority(level) {
    if (level === "critical") {
      return 2;
    }
    if (level === "warning") {
      return 1;
    }
    return 0;
  }

  function getImageIntegrityUiData(level) {
    if (level === "critical") {
      return {
        className: "admin-image-monitor-critical",
        status: "Фото: есть невосстановимые проблемы",
        toast: "Найдены битые фото товаров, которые пока не удалось восстановить.",
        isError: true
      };
    }
    if (level === "warning") {
      return {
        className: "admin-image-monitor-warning",
        status: "Фото: найдены проблемы, но есть история для восстановления",
        toast: "Найдены битые фото. Их можно восстановить одной кнопкой из истории.",
        isError: false
      };
    }
    return {
      className: "admin-image-monitor-ok",
      status: "Фото: целостность в порядке",
      toast: "Все фото товаров в порядке.",
      isError: false
    };
  }

  function setImageIntegrityButtonsBusy(isBusy) {
    if (elements.imageIntegrityRefreshBtn) {
      elements.imageIntegrityRefreshBtn.disabled = Boolean(isBusy);
      elements.imageIntegrityRefreshBtn.textContent = isBusy ? "Проверяем..." : "Проверить фото";
    }
    if (elements.imageIntegrityRepairBtn) {
      elements.imageIntegrityRepairBtn.disabled = Boolean(isBusy);
      elements.imageIntegrityRepairBtn.textContent = isBusy ? "Восстанавливаем..." : "Авто-восстановить";
    }
  }

  function applyImageIntegrityUi(level, payloadText) {
    if (!elements.imageIntegrityMonitor || !elements.imageIntegrityStatus || !elements.imageIntegrityMeta) {
      return;
    }

    var uiData = getImageIntegrityUiData(level);
    elements.imageIntegrityMonitor.classList.remove("admin-image-monitor-ok", "admin-image-monitor-warning", "admin-image-monitor-critical");
    elements.imageIntegrityMonitor.classList.add(uiData.className);
    elements.imageIntegrityStatus.textContent = uiData.status;
    elements.imageIntegrityMeta.textContent = payloadText;
  }

  async function runImageIntegrityCheck(isManual) {
    if (!elements.panelView || elements.panelView.classList.contains("hidden")) {
      return;
    }
    if (!isAuthenticated()) {
      return;
    }
    if (state.imageIntegrityMonitor.inFlight) {
      return;
    }
    if (typeof store.fetchAdminImageIntegrityReport !== "function") {
      return;
    }

    ensureImageIntegrityMonitorElements();
    state.imageIntegrityMonitor.inFlight = true;
    setImageIntegrityButtonsBusy(true);

    try {
      var report = await store.fetchAdminImageIntegrityReport();
      var broken = Math.max(0, Math.round(Number(report && report.broken) || 0));
      var recoverable = Math.max(0, Math.round(Number(report && report.recoverable) || 0));
      var total = Math.max(0, Math.round(Number(report && report.total) || 0));
      var checkedAt = new Date(report && report.checkedAt || Date.now());
      var checkedLabel = checkedAt.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
      var payloadText = "битых: " + broken + " из " + total + " · восстановимых: " + recoverable + " · " + checkedLabel;
      var level = "ok";
      if (broken > 0 && recoverable > 0) {
        level = "warning";
      } else if (broken > 0) {
        level = "critical";
      }

      applyImageIntegrityUi(level, payloadText);

      var uiData = getImageIntegrityUiData(level);
      var previousLevel = state.imageIntegrityMonitor.lastLevel;
      var now = Date.now();
      if (isManual) {
        showToast(uiData.status + ". " + payloadText, uiData.isError);
      } else if (
        level !== previousLevel
        && (
          getImageIntegrityLevelPriority(level) > getImageIntegrityLevelPriority(previousLevel)
          || (level === "ok" && previousLevel !== "ok")
        )
      ) {
        if (now - state.imageIntegrityMonitor.lastToastAt >= CAPACITY_TOAST_COOLDOWN_MS) {
          showToast(uiData.toast, uiData.isError);
          state.imageIntegrityMonitor.lastToastAt = now;
        }
      }
      state.imageIntegrityMonitor.lastLevel = level;
    } catch (error) {
      var message = String(error && error.message || "");
      if (message.indexOf("401") >= 0 || message.indexOf("UNAUTHORIZED") >= 0) {
        logout();
        showToast("Сессия истекла. Войдите снова.", true);
        return;
      }
      applyImageIntegrityUi("warning", "Не удалось проверить целостность фото. Проверьте соединение и повторите.");
      if (isManual) {
        showToast("Не удалось проверить фото товаров.", true);
      }
    } finally {
      state.imageIntegrityMonitor.inFlight = false;
      setImageIntegrityButtonsBusy(false);
    }
  }

  async function repairBrokenProductImages() {
    if (!isAuthenticated()) {
      return;
    }
    if (state.imageIntegrityMonitor.inFlight) {
      return;
    }
    if (typeof store.repairAdminProductImages !== "function") {
      showToast("Обновите scripts/common.js, чтобы восстанавливать фото.", true);
      return;
    }

    state.imageIntegrityMonitor.inFlight = true;
    setImageIntegrityButtonsBusy(true);

    try {
      var result = await store.repairAdminProductImages();
      state.imageIntegrityMonitor.inFlight = false;
      setImageIntegrityButtonsBusy(false);
      await refreshPanelFromServer(false);
      await runImageIntegrityCheck(false);
      var repaired = Math.max(0, Math.round(Number(result && result.repaired) || 0));
      if (repaired > 0) {
        showToast("Фото восстановлены: " + repaired + ".");
      } else {
        showToast("Битых фото для восстановления не найдено.");
      }
    } catch (error) {
      var message = String(error && error.message || "");
      if (message.indexOf("401") >= 0 || message.indexOf("UNAUTHORIZED") >= 0) {
        logout();
        showToast("Сессия истекла. Войдите снова.", true);
        return;
      }
      showToast("Не удалось выполнить автовосстановление фото.", true);
    } finally {
      state.imageIntegrityMonitor.inFlight = false;
      setImageIntegrityButtonsBusy(false);
    }
  }

  function getCapacityLevelPriority(level) {
    if (level === "critical") {
      return 2;
    }
    if (level === "warning") {
      return 1;
    }
    return 0;
  }

  function formatCapacityProbe(probe) {
    if (!probe) {
      return "n/a";
    }
    if (!probe.ok) {
      if (probe.status) {
        return "ошибка HTTP " + probe.status;
      }
      return "ошибка сети";
    }
    return Math.round(Number(probe.elapsedMs) || 0) + " мс";
  }

  function getCapacityUiData(level) {
    if (level === "critical") {
      return {
        className: "admin-capacity-critical",
        status: "Емкость: перегрузка или отказ",
        toast: "Емкость просела: есть ошибки или сильные задержки. Проверьте логи и трафик.",
        isError: true
      };
    }
    if (level === "warning") {
      return {
        className: "admin-capacity-warning",
        status: "Емкость: есть замедления",
        toast: "Емкость снижается: сервер отвечает медленнее обычного.",
        isError: false
      };
    }
    return {
      className: "admin-capacity-ok",
      status: "Емкость: стабильно",
      toast: "Емкость восстановилась.",
      isError: false
    };
  }

  async function fetchWithTimeout(url, timeoutMs) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timeoutId = null;

    if (controller) {
      timeoutId = setTimeout(function () {
        controller.abort();
      }, timeoutMs);
    }

    try {
      return await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Accept": "application/json"
        },
        signal: controller ? controller.signal : undefined
      });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  async function probeCapacityEndpoint(url) {
    var startedAt = Date.now();
    try {
      var response = await fetchWithTimeout(url, CAPACITY_REQUEST_TIMEOUT_MS);
      return {
        ok: response.ok,
        status: response.status,
        elapsedMs: Date.now() - startedAt
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        elapsedMs: Date.now() - startedAt,
        message: String(error && error.message || "NETWORK_ERROR")
      };
    }
  }

  function applyCapacityUi(level, payload) {
    if (!elements.capacityMonitor || !elements.capacityStatus || !elements.capacityMeta) {
      return;
    }

    var uiData = getCapacityUiData(level);
    elements.capacityMonitor.classList.remove("admin-capacity-ok", "admin-capacity-warning", "admin-capacity-critical");
    elements.capacityMonitor.classList.add(uiData.className);
    elements.capacityStatus.textContent = uiData.status;
    elements.capacityMeta.textContent = payload;
  }

  function stopCapacityMonitor() {
    if (state.capacityMonitor.timerId) {
      clearInterval(state.capacityMonitor.timerId);
      state.capacityMonitor.timerId = null;
    }
    state.capacityMonitor.inFlight = false;
  }

  function startCapacityMonitor() {
    stopCapacityMonitor();
    runCapacityCheck(false);
    state.capacityMonitor.timerId = setInterval(function () {
      runCapacityCheck(false);
    }, CAPACITY_CHECK_INTERVAL_MS);
  }

  async function runCapacityCheck(isManual) {
    if (!elements.panelView || elements.panelView.classList.contains("hidden")) {
      return;
    }
    if (!isAuthenticated()) {
      return;
    }
    if (state.capacityMonitor.inFlight) {
      return;
    }

    ensureCapacityMonitorElements();
    state.capacityMonitor.inFlight = true;

    try {
      var healthProbe = await probeCapacityEndpoint("/health?ts=" + Date.now());
      var storeProbe = await probeCapacityEndpoint("/api/store-data?ts=" + Date.now());

      var sample = {
        healthOk: Boolean(healthProbe.ok),
        storeOk: Boolean(storeProbe.ok)
      };
      state.capacityMonitor.history.push(sample);
      if (state.capacityMonitor.history.length > CAPACITY_HISTORY_LIMIT) {
        state.capacityMonitor.history.shift();
      }

      var failures = state.capacityMonitor.history.filter(function (item) {
        return !item.healthOk || !item.storeOk;
      }).length;
      var samplesCount = state.capacityMonitor.history.length;

      var level = "ok";
      if (!healthProbe.ok || !storeProbe.ok) {
        level = "critical";
      } else if (
        healthProbe.elapsedMs >= CAPACITY_CRITICAL_HEALTH_MS
        || storeProbe.elapsedMs >= CAPACITY_CRITICAL_STORE_MS
      ) {
        level = "critical";
      } else if (
        healthProbe.elapsedMs >= CAPACITY_WARNING_HEALTH_MS
        || storeProbe.elapsedMs >= CAPACITY_WARNING_STORE_MS
      ) {
        level = "warning";
      } else if (samplesCount >= 4 && failures >= 2) {
        level = "warning";
      }

      var checkedAt = new Date();
      var checkedLabel = checkedAt.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
      var payload = ""
        + "health: " + formatCapacityProbe(healthProbe)
        + " · store-data: " + formatCapacityProbe(storeProbe)
        + " · ошибки: " + failures + "/" + samplesCount
        + " · " + checkedLabel;

      applyCapacityUi(level, payload);

      var uiData = getCapacityUiData(level);
      var previousLevel = state.capacityMonitor.lastLevel;
      var now = Date.now();
      var shouldNotify = false;

      if (isManual) {
        showToast(uiData.status + ". " + payload, uiData.isError);
      } else if (level === "ok" && previousLevel !== "ok") {
        shouldNotify = true;
      } else if (level !== "ok") {
        if (getCapacityLevelPriority(level) > getCapacityLevelPriority(previousLevel)) {
          shouldNotify = true;
        } else if (now - state.capacityMonitor.lastToastAt >= CAPACITY_TOAST_COOLDOWN_MS) {
          shouldNotify = true;
        }
      }

      if (shouldNotify) {
        showToast(uiData.toast, uiData.isError);
      }

      if (level !== "ok" && (shouldNotify || isManual)) {
        state.capacityMonitor.lastToastAt = now;
      }
      state.capacityMonitor.lastLevel = level;
    } finally {
      state.capacityMonitor.inFlight = false;
    }
  }

  function showToast(message, isError) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    elements.toast.classList.toggle("error", Boolean(isError));

    toastTimer = setTimeout(function () {
      elements.toast.classList.remove("show", "error");
    }, 2200);
  }

  function cssEscapeValue(value) {
    var safe = String(value || "");
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(safe);
    }
    return safe.replace(/["\\]/g, "\\$&");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();


