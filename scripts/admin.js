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

  var state = {
    editingId: null,
    imageData: "",
    heroImageData: "",
    draftMemory: null,
    homepageReviewEditingId: null
  };

  var elements = {};
  var toastTimer = null;

  document.addEventListener("DOMContentLoaded", function () {
    init().catch(function () {
      openLogin();
      showToast("Не удалось загрузить данные сервера. Проверьте подключение.", true);
    });
  });

  async function init() {
    cacheElements();
    bindEvents();
    if (typeof store.init === "function") {
      await store.init();
    }
    checkAuth();
  }

  function cacheElements() {
    elements.loginView = document.getElementById("adminLoginView");
    elements.panelView = document.getElementById("adminPanelView");
    elements.loginForm = document.getElementById("adminLoginForm");
    elements.passwordInput = document.getElementById("adminPasswordInput");
    elements.logoutBtn = document.getElementById("adminLogoutBtn");

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
    elements.perfumeDescriptionInput = document.getElementById("perfumeDescriptionInput");
    elements.perfumeImageInput = document.getElementById("perfumeImageInput");
    elements.perfumeImagePreview = document.getElementById("perfumeImagePreview");
    elements.topWeekInput = document.getElementById("topWeekInput");
    elements.topMonthInput = document.getElementById("topMonthInput");
    elements.addVolumeBtn = document.getElementById("addVolumeBtn");
    elements.volumesContainer = document.getElementById("volumesContainer");
    elements.cancelEditBtn = document.getElementById("cancelEditBtn");

    elements.adminProductsList = document.getElementById("adminProductsList");
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
  }

  function bindEvents() {
    elements.loginForm.addEventListener("submit", onLogin);
    elements.logoutBtn.addEventListener("click", logout);

    elements.settingsForm.addEventListener("submit", saveSettings);
    if (elements.heroImageInput) {
      elements.heroImageInput.addEventListener("change", handleHeroImageUpload);
    }
    if (elements.heroImageClearBtn) {
      elements.heroImageClearBtn.addEventListener("click", clearHeroImage);
    }

    elements.addVolumeBtn.addEventListener("click", function () {
      appendVolumeRow();
      saveEditorDraftFromForm();
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
      saveEditorDraftFromForm();
    });

    elements.perfumeImageInput.addEventListener("change", handleImageUpload);
    elements.perfumeForm.addEventListener("submit", savePerfume);
    elements.cancelEditBtn.addEventListener("click", resetEditor);
    elements.perfumeForm.addEventListener("input", saveEditorDraftFromForm);
    elements.perfumeForm.addEventListener("change", saveEditorDraftFromForm);

    elements.adminProductsList.addEventListener("click", onProductListClick);
    elements.adminProductsList.addEventListener("change", onProductListChange);
    elements.volumesContainer.addEventListener("input", saveEditorDraftFromForm);
    elements.volumesContainer.addEventListener("change", saveEditorDraftFromForm);

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
    refreshPanelFromServer(false);
  }

  function openLogin() {
    elements.panelView.classList.add("hidden");
    elements.loginView.classList.remove("hidden");
    elements.passwordInput.value = "";
    elements.passwordInput.focus();
  }

  function refreshPanel() {
    fillSettingsForm();
    renderProducts();
    renderHomepageReviews();
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
        await store.syncFromServer();
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
    refreshPanel();
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

    try {
      await store.updateSettings(patch);

      if (newAdminPassword) {
        if (typeof store.changeAdminPassword !== "function") {
          throw new Error("PASSWORD_ENDPOINT_UNAVAILABLE");
        }
        await store.changeAdminPassword(newAdminPassword);
      }

      elements.adminPasswordNewInput.value = "";
      showToast(newAdminPassword ? "Настройки и пароль сохранены" : "Настройки сохранены");
    } catch (error) {
      if (String(error && error.message || "").indexOf("401") >= 0 || String(error && error.message || "").indexOf("UNAUTHORIZED") >= 0) {
        logout();
        showToast("Сессия истекла. Войдите снова.", true);
        return;
      }
      showToast("Не удалось сохранить настройки на сервер.", true);
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

  function createVolumeRow(volume) {
    var data = volume || { ml: "", price: "" };
    var row = document.createElement("div");
    row.className = "volume-row";
    row.innerHTML = ""
      + "<label class=\"field\">"
      + "  <span>Объём, ml</span>"
      + "  <input class=\"volume-ml\" type=\"number\" min=\"1\" required value=\"" + escapeHtml(data.ml) + "\">"
      + "</label>"
      + "<label class=\"field\">"
      + "  <span>Цена, ₽</span>"
      + "  <input class=\"volume-price\" type=\"number\" min=\"1\" required value=\"" + escapeHtml(data.price) + "\">"
      + "</label>"
      + "<button type=\"button\" class=\"btn btn-ghost remove-volume-btn\">Удалить</button>";

    return row;
  }

  function appendVolumeRow(volume) {
    elements.volumesContainer.appendChild(createVolumeRow(volume));
  }

  function collectVolumes() {
    var rows = Array.prototype.slice.call(elements.volumesContainer.querySelectorAll(".volume-row"));
    var volumes = rows.map(function (row) {
      var mlInput = row.querySelector(".volume-ml");
      var priceInput = row.querySelector(".volume-price");
      var ml = Math.round(Number(mlInput.value));
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
      uniqueMap.set(item.ml, item);
    });

    return Array.from(uniqueMap.values());
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

  function applyEditorDraft(draft) {
    if (!draft) {
      return;
    }

    var gender = String(draft.gender || "unisex");
    if (["male", "female", "unisex"].indexOf(gender) === -1) {
      gender = "unisex";
    }

    state.editingId = String(draft.editingId || "") || null;
    state.imageData = String(draft.imageData || "");

    elements.editorTitle.textContent = state.editingId ? "Редактировать парфюм" : "Добавить парфюм";
    elements.perfumeIdInput.value = state.editingId || "";
    elements.perfumeNameInput.value = String(draft.name || "");
    elements.perfumeBrandInput.value = String(draft.brand || "");
    elements.perfumeGenderInput.value = gender;
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

  async function savePerfume(event) {
    event.preventDefault();

    var id = String(elements.perfumeIdInput.value || "").trim();
    var name = String(elements.perfumeNameInput.value || "").trim();
    var brand = String(elements.perfumeBrandInput.value || "").trim();
    var gender = String(elements.perfumeGenderInput.value || "unisex");
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

    var products = store.getProducts();
    var existing = products.find(function (item) {
      return item.id === id;
    });

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
      description: description,
      image: image,
      volumes: volumes,
      reviews: existing && Array.isArray(existing.reviews) ? existing.reviews : [],
      topWeek: elements.topWeekInput.checked,
      topMonth: elements.topMonthInput.checked
    };

    try {
      if (existing) {
        var next = products.map(function (item) {
          return item.id === existing.id ? payload : item;
        });
        await store.saveProducts(next);
        showToast("Товар обновлён");
      } else {
        products.unshift(payload);
        await store.saveProducts(products);
        showToast("Товар добавлен");
      }

      renderProducts();
      resetEditor();
    } catch (error) {
      if (String(error && error.message || "").indexOf("413") >= 0) {
        showToast("Фото слишком тяжелое для сервера. Уменьшите размер.", true);
        return;
      }
      showToast("Не удалось сохранить товар на сервер.", true);
    }
  }

  function resetEditor(options) {
    var keepDraft = options && options.keepDraft;

    state.editingId = null;
    state.imageData = "";

    elements.editorTitle.textContent = "Добавить парфюм";
    elements.perfumeIdInput.value = "";
    elements.perfumeForm.reset();

    elements.volumesContainer.innerHTML = "";
    appendVolumeRow({ ml: "", price: "" });

    setPreviewImage("");

    if (!keepDraft) {
      clearEditorDraft();
    }
  }

  function startEdit(productId) {
    var product = store.getProducts().find(function (item) {
      return item.id === productId;
    });

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
    var products = store.getProducts();
    var target = products.find(function (item) {
      return item.id === productId;
    });

    if (!target) {
      return;
    }

    var ok = window.confirm("Удалить аромат \"" + target.name + "\"?");
    if (!ok) {
      return;
    }

    var next = products.filter(function (item) {
      return item.id !== productId;
    });

    try {
      await store.saveProducts(next);

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

    var products = store.getProducts();
    var next = products.map(function (item) {
      if (item.id !== id) {
        return item;
      }
      if (mode === "week") {
        item.topWeek = checked;
      }
      if (mode === "month") {
        item.topMonth = checked;
      }
      return item;
    });

    try {
      await store.saveProducts(next);
      showToast("Топ-статус обновлён");
    } catch (error) {
      showToast("Не удалось обновить топ-статус на сервере.", true);
      toggle.checked = !checked;
    }
  }

  function findProductReviewEntry(productId, reviewId) {
    var products = store.getProducts();
    var product = products.find(function (item) {
      return String(item && item.id) === String(productId);
    });
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
      review: review,
      products: products
    };
  }

  function findPendingProductReviewEntry(productId, reviewId) {
    var products = store.getProducts();
    var product = products.find(function (item) {
      return String(item && item.id) === String(productId);
    });
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
      review: review,
      products: products
    };
  }

  async function approvePendingProductReview(productId, reviewId) {
    var entry = findPendingProductReviewEntry(productId, reviewId);
    if (!entry) {
      showToast("Отзыв на модерации не найден.", true);
      return;
    }

    var nextProducts = entry.products.map(function (product) {
      if (String(product.id) !== String(productId)) {
        return product;
      }

      var published = Array.isArray(product.reviews) ? product.reviews.slice() : [];
      var pending = Array.isArray(product.pendingReviews) ? product.pendingReviews : [];
      published.unshift(Object.assign({}, entry.review, {
        id: String(entry.review.id || store.uid("pr")).replace(/^ppr_/, "pr_")
      }));

      return Object.assign({}, product, {
        reviews: published,
        pendingReviews: pending.filter(function (item) {
          return String(item && item.id) !== String(reviewId);
        })
      });
    });

    try {
      await store.saveProducts(nextProducts);
      renderProducts();
      showToast("Отзыв опубликован.");
    } catch (error) {
      showToast("Не удалось опубликовать отзыв.", true);
    }
  }

  async function rejectPendingProductReview(productId, reviewId) {
    var entry = findPendingProductReviewEntry(productId, reviewId);
    if (!entry) {
      showToast("Отзыв на модерации не найден.", true);
      return;
    }

    var ok = window.confirm("Отклонить отзыв \"" + entry.review.author + "\" для аромата \"" + entry.product.name + "\"?");
    if (!ok) {
      return;
    }

    var nextProducts = entry.products.map(function (product) {
      if (String(product.id) !== String(productId)) {
        return product;
      }

      var pending = Array.isArray(product.pendingReviews) ? product.pendingReviews : [];
      return Object.assign({}, product, {
        pendingReviews: pending.filter(function (item) {
          return String(item && item.id) !== String(reviewId);
        })
      });
    });

    try {
      await store.saveProducts(nextProducts);
      renderProducts();
      showToast("Отзыв отклонён.");
    } catch (error) {
      showToast("Не удалось отклонить отзыв.", true);
    }
  }

  async function editProductReview(productId, reviewId) {
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

    var nextProducts = entry.products.map(function (product) {
      if (String(product.id) !== String(productId)) {
        return product;
      }

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

      return Object.assign({}, product, {
        reviews: updatedReviews
      });
    });

    try {
      await store.saveProducts(nextProducts);
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
    var entry = findProductReviewEntry(productId, reviewId);
    if (!entry) {
      showToast("Отзыв не найден.", true);
      return;
    }

    var ok = window.confirm("Удалить отзыв автора \"" + entry.review.author + "\" для аромата \"" + entry.product.name + "\"?");
    if (!ok) {
      return;
    }

    var nextProducts = entry.products.map(function (product) {
      if (String(product.id) !== String(productId)) {
        return product;
      }

      var currentReviews = Array.isArray(product.reviews) ? product.reviews : [];
      return Object.assign({}, product, {
        reviews: currentReviews.filter(function (review) {
          return String(review && review.id) !== String(reviewId);
        })
      });
    });

    try {
      await store.saveProducts(nextProducts);
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
    var products = store.getProducts();

    if (!products.length) {
      elements.adminProductsList.innerHTML = "<div class=\"empty-state\">\u041a\u0430\u0442\u0430\u043b\u043e\u0433 \u043f\u0443\u0441\u0442. \u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u043f\u0435\u0440\u0432\u044b\u0439 \u0430\u0440\u043e\u043c\u0430\u0442.\u003c/div>";
      return;
    }

    elements.adminProductsList.innerHTML = products.map(function (product) {
      var volumesLine = product.volumes.map(function (volume) {
        return volume.ml + "ml - " + store.formatPrice(volume.price);
      }).join(" | " );

      var productReviews = Array.isArray(product.reviews) ? product.reviews : [];
      var pendingProductReviews = Array.isArray(product.pendingReviews) ? product.pendingReviews : [];
      var productReviewsHtml = "";
      var pendingProductReviewsHtml = "";

      if (!productReviews.length) {
        productReviewsHtml = "<div class=\"admin-product-review-empty\">\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043d\u044b\u0445 \u043e\u0442\u0437\u044b\u0432\u043e\u0432.\u003c/div>";
      } else {
        productReviewsHtml = "<div class=\"admin-product-reviews-list\">"
          + productReviews.map(function (review) {
            var cityPart = review.city ? (", " + escapeHtml(review.city)) : "";
            var photoHtml = review.photo
              ? "<img class=\"admin-review-photo\" src=\"" + escapeHtml(review.photo) + "\" alt=\"Фото к отзыву\">"
              : "";
            return ""
              + "<article class=\"admin-review-card\">"
              + "  <div class=\"admin-review-head\">"
              + "    <div>"
              + "      <strong>" + escapeHtml(review.author) + cityPart + "</strong>"
              + "      <div class=\"admin-review-meta\">" + escapeHtml(formatReviewDate(review.createdAt)) + "</div>"
              + "    </div>"
              + "    <span class=\"admin-review-rating\">" + buildStars(review.rating) + "</span>"
              + "  </div>"
              + photoHtml
              + "  <p class=\"admin-review-text\">" + escapeHtml(review.text) + "</p>"
              + "  <div class=\"admin-review-actions\">"
              + "    <button class=\"btn btn-ghost\" type=\"button\" data-product-review-action=\"edit\" data-product-id=\"" + escapeHtml(product.id) + "\" data-review-id=\"" + escapeHtml(review.id) + "\">\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c</button>"
              + "    <button class=\"btn btn-ghost\" type=\"button\" data-product-review-action=\"delete\" data-product-id=\"" + escapeHtml(product.id) + "\" data-review-id=\"" + escapeHtml(review.id) + "\">\u0423\u0434\u0430\u043b\u0438\u0442\u044c</button>"
              + "  </div>"
              + "</article>";
          }).join("")
          + "</div>";
      }

      if (!pendingProductReviews.length) {
        pendingProductReviewsHtml = "<div class=\"admin-product-review-empty\">\u041d\u0430 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043e\u0442\u0437\u044b\u0432\u043e\u0432.\u003c/div>";
      } else {
        pendingProductReviewsHtml = "<div class=\"admin-product-reviews-list\">"
          + pendingProductReviews.map(function (review) {
            var cityPart = review.city ? (", " + escapeHtml(review.city)) : "";
            var photoHtml = review.photo
              ? "<img class=\"admin-review-photo\" src=\"" + escapeHtml(review.photo) + "\" alt=\"Фото к отзыву\">"
              : "";
            return ""
              + "<article class=\"admin-review-card admin-review-card-pending\">"
              + "  <div class=\"admin-review-head\">"
              + "    <div>"
              + "      <strong>" + escapeHtml(review.author) + cityPart + "</strong>"
              + "      <div class=\"admin-review-meta\">" + escapeHtml(formatReviewDate(review.createdAt)) + "</div>"
              + "    </div>"
              + "    <span class=\"admin-review-rating\">" + buildStars(review.rating) + "</span>"
              + "  </div>"
              + photoHtml
              + "  <p class=\"admin-review-text\">" + escapeHtml(review.text) + "</p>"
              + "  <div class=\"admin-review-actions\">"
              + "    <button class=\"btn btn-primary\" type=\"button\" data-product-pending-review-action=\"approve\" data-product-id=\"" + escapeHtml(product.id) + "\" data-review-id=\"" + escapeHtml(review.id) + "\">\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u0442\u044c</button>"
              + "    <button class=\"btn btn-ghost\" type=\"button\" data-product-pending-review-action=\"reject\" data-product-id=\"" + escapeHtml(product.id) + "\" data-review-id=\"" + escapeHtml(review.id) + "\">\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c</button>"
              + "  </div>"
              + "</article>";
          }).join("")
          + "</div>";
      }

      return ""
        + "<article class=\"admin-product-card\">"
        + "  <img src=\"" + escapeHtml(product.image) + "\" alt=\"" + escapeHtml(product.name) + "\">"
        + "  <div class=\"admin-product-body\">"
        + "    <div class=\"admin-product-head\">"
        + "      <div class=\"admin-product-title\">"
        + "        <strong>" + escapeHtml(product.name) + "</strong>"
        + "        <span>" + escapeHtml(product.brand) + " | " + store.getGenderLabel(product.gender) + "</span>"
        + "      </div>"
        + "      <div class=\"admin-product-actions\">"
        + "        <button class=\"btn btn-ghost\" type=\"button\" data-action=\"edit\" data-id=\"" + escapeHtml(product.id) + "\">\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c</button>"
        + "        <button class=\"btn btn-ghost\" type=\"button\" data-action=\"delete\" data-id=\"" + escapeHtml(product.id) + "\">\u0423\u0434\u0430\u043b\u0438\u0442\u044c</button>"
        + "      </div>"
        + "    </div>"
        + "    <p class=\"meta-line\">" + escapeHtml(volumesLine) + "</p>"
        + "    <div class=\"admin-product-actions\">"
        + "      <label class=\"toggle-inline\"><input type=\"checkbox\" data-toggle=\"week\" data-id=\"" + escapeHtml(product.id) + "\" " + (product.topWeek ? "checked" : "") + ">\u0422\u043e\u043f \u043d\u0435\u0434\u0435\u043b\u0438</label>"
        + "      <label class=\"toggle-inline\"><input type=\"checkbox\" data-toggle=\"month\" data-id=\"" + escapeHtml(product.id) + "\" " + (product.topMonth ? "checked" : "") + ">\u0422\u043e\u043f \u043c\u0435\u0441\u044f\u0446\u0430</label>"
        + "    </div>"
        + "    <div class=\"admin-product-reviews\">"
        + "      <div class=\"admin-product-reviews-head\">"
        + "        <strong>\u041e\u0442\u0437\u044b\u0432\u044b \u043a \u0430\u0440\u043e\u043c\u0430\u0442\u0443</strong>"
        + "        <span>\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043e: " + productReviews.length + "</span>"
        + "      </div>"
        + productReviewsHtml
        + "      <div class=\"admin-product-reviews-head\">"
        + "        <strong>\u041d\u0430 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438</strong>"
        + "        <span>\u0412\u0441\u0435\u0433\u043e: " + pendingProductReviews.length + "</span>"
        + "      </div>"
        + pendingProductReviewsHtml
        + "    </div>"
        + "  </div>"
        + "</article>";
    }).join("");
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

  function showToast(message, isError) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    elements.toast.classList.toggle("error", Boolean(isError));

    toastTimer = setTimeout(function () {
      elements.toast.classList.remove("show", "error");
    }, 2200);
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


