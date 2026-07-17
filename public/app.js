const state = {
  activePanel: "dashboard",
  status: null,
  apps: [],
  errors: [],
  selectedAppId: null,
  latestResult: null,
  workflows: [],
  workflowTargets: [],
  workflowRuns: [],
  latestWorkflowRun: null,
  workflowPrefill: null,
  projectIntakes: [],
  latestProjectIntake: null,
  logs: [],
  chats: [],
  currentChat: null,
  chatMode: "chat",
  chatBusy: false,
  chatStatus: "",
  localLlm: {
    config: null,
    health: null,
    models: [],
    modelsStatus: null,
    busy: false,
    message: "Loading local model status...",
    lastDurationMs: null
  },
  ideaLab: {
    session: null,
    result: null,
    action: null,
    intake: null,
    handoff: null,
    busyAction: null,
    status: "Ready",
    showComparison: false
  },
  workspaceListing: null,
  workspacePath: "",
  startMenuOpen: false,
  windows: [],
  nextZIndex: 20,
  activeWindowId: null,
  windowOffset: 0
};

const els = {
  workspacePath: document.querySelector("#workspace-path"),
  safeMode: document.querySelector("#safe-mode"),
  runtimeSummary: document.querySelector("#runtime-summary"),
  runningSummary: document.querySelector("#running-summary"),
  dashboardStats: document.querySelector("#dashboard-stats"),
  dashboardRecent: document.querySelector("#dashboard-recent"),
  apps: document.querySelector("#apps"),
  appName: document.querySelector("#app-name"),
  appDetails: document.querySelector("#app-details"),
  errors: document.querySelector("#registry-errors"),
  commands: document.querySelector("#commands"),
  latestResult: document.querySelector("#latest-result"),
  workflows: document.querySelector("#workflows"),
  workflowResult: document.querySelector("#workflow-result"),
  workflowRuns: document.querySelector("#workflow-runs"),
  projectIntakeForm: document.querySelector("#project-intake-form"),
  projectIntakeResult: document.querySelector("#project-intake-result"),
  projectIntakes: document.querySelector("#project-intakes"),
  newChatForm: document.querySelector("#new-chat-form"),
  chatList: document.querySelector("#chat-list"),
  chatMessages: document.querySelector("#chat-messages"),
  chatActions: document.querySelector("#chat-actions"),
  chatMessageForm: document.querySelector("#chat-message-form"),
  chatInput: document.querySelector("#chat-input"),
  chatSendButton: document.querySelector("#chat-send-button"),
  chatRequestStatus: document.querySelector("#chat-request-status"),
  chatMode: document.querySelector("#chat-mode"),
  localLlmBadge: document.querySelector("#local-llm-badge"),
  localLlmSummary: document.querySelector("#local-llm-summary"),
  localLlmSettings: document.querySelector("#local-llm-settings"),
  openLocalLlmSettings: document.querySelector("#open-local-llm-settings"),
  localLlmConfigForm: document.querySelector("#local-llm-config-form"),
  localLlmProvider: document.querySelector("#local-llm-provider"),
  localLlmBaseUrl: document.querySelector("#local-llm-base-url"),
  localLlmModel: document.querySelector("#local-llm-model"),
  localLlmContextLimit: document.querySelector("#local-llm-context-limit"),
  localLlmTest: document.querySelector("#local-llm-test"),
  localLlmRefresh: document.querySelector("#local-llm-refresh"),
  localLlmUnload: document.querySelector("#local-llm-unload"),
  localLlmSettingsStatus: document.querySelector("#local-llm-settings-status"),
  ideaLabControls: document.querySelector("#idea-lab-controls"),
  ideaLabStatus: document.querySelector("#idea-lab-status"),
  workspaceBrowseForm: document.querySelector("#workspace-browse-form"),
  workspacePathInput: document.querySelector("#workspace-path-input"),
  workspaceFiles: document.querySelector("#workspace-files"),
  createFolderForm: document.querySelector("#create-folder-form"),
  createFileForm: document.querySelector("#create-file-form"),
  writeFileForm: document.querySelector("#write-file-form"),
  log: document.querySelector("#log"),
  startButton: document.querySelector("#start-button"),
  startMenu: document.querySelector("#start-menu"),
  quickLaunch: document.querySelector("#quick-launch"),
  windowLayer: document.querySelector("#window-layer"),
  taskbarWindows: document.querySelector("#taskbar-windows"),
  taskbarSafeMode: document.querySelector("#taskbar-safe-mode"),
  taskbarRunningCount: document.querySelector("#taskbar-running-count"),
  desktopCopy: document.querySelector("#desktop-copy"),
  chatContext: document.querySelector("#chat-context"),
  newChatDetails: document.querySelector("#new-chat-details"),
  homeSafeMode: document.querySelector("#home-safe-mode"),
  homeRunningCount: document.querySelector("#home-running-count"),
  homeEnabledTools: document.querySelector("#home-enabled-tools"),
  homeWorkspacePath: document.querySelector("#home-workspace-path")
};

const intakeLabels = {
  wants: "What the user wants",
  problem: "Problem",
  missing: "Missing now",
  clarify: "Needs clarification",
  features: "Needed features",
  cap: "Can select a CAP Pack"
};

const missingLabels = {
  "project name": "project name",
  "who it is for": "target user",
  "problem description": "problem description",
  "what is missing now": "missing current solution",
  "desired result": "desired result",
  "must-have features": "must-have features"
};

const localAppRoutes = {
  projectManagerUrl: "http://localhost:5173/creator",
  generatorUrl: "http://localhost:5173/creator",
  fullstackDesignerUrl: "http://localhost:5173/creator"
};

const aiOsApps = [
  {
    category: "AI Apps",
    apps: [
      { appId: "ai-chat", title: "AI Chat", icon: "AI", templateId: "panel-chat", status: "connected", description: "Local project planning, context and confirmed actions." },
      { appId: "generator", title: "Generator", icon: "GN", status: "local route", route: localAppRoutes.generatorUrl, host: "iframe", description: "Project generation, scaffold previews, implementation plans and patch workflows." },
      { appId: "fullstack-designer", title: "Fullstack Designer", icon: "FD", status: "local route", route: localAppRoutes.fullstackDesignerUrl, host: "iframe", description: "Project design workspace with variants, AI chat, architecture, database, API and UI planning." },
      { appId: "project-manager", title: "Project Manager", icon: "PM", status: "local route", route: localAppRoutes.projectManagerUrl, host: "iframe", description: "Manage local project intake, design and generation workflows." }
    ]
  },
  {
    category: "System",
    apps: [
      { appId: "system-monitor", title: "System Monitor", icon: "SM", templateId: "panel-dashboard", status: "connected", component: "AiOsSystemMonitor", description: "Runtime health, activity and workspace status." },
      { appId: "apps-manager", title: "Apps Manager", icon: "AM", templateId: "panel-apps", status: "connected", description: "Registered local applications and commands." },
      { appId: "tools", title: "Tools", icon: "TL", templateId: "panel-tools", status: "connected", description: "On-demand runtime-controlled workspace commands." },
      { appId: "workflows", title: "Workflows", icon: "WF", templateId: "panel-workflows", status: "connected", description: "Confirmed multi-step local workflows." },
      { appId: "files", title: "Files", icon: "FL", templateId: "panel-files", status: "connected", description: "Safe workspace file access." },
      { appId: "logs", title: "Logs", icon: "LG", templateId: "panel-logs", status: "connected", description: "Command and runtime execution history." },
      { appId: "project-intake", title: "Project Intake", icon: "PI", templateId: "panel-intake", status: "connected", description: "Turn project ideas into structured local intake." }
    ]
  },
  {
    category: "Knowledge",
    apps: [
      { appId: "pattern-library", title: "Pattern Library", icon: "PL", status: "unavailable", description: "Reusable project patterns available through tools and workflows." },
      { appId: "memory-context", title: "Memory / Context", icon: "MC", status: "not configured", description: "Persistent workspace context is not configured yet." }
    ]
  }
];

function AiOsShell() {
  renderStartMenu();
  renderTaskbar();
}

function AiOsTopBar() {
  renderTopbar();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();

  if (!response.ok) throw new Error(payload.error ?? `Request failed: ${response.status}`);
  return payload;
}

function allTools() {
  return state.apps.flatMap((app) => app.commands.map((command) => ({ app, command })));
}

function selectedApp() {
  return state.apps.find((app) => app.id === state.selectedAppId) ?? null;
}

function launcherApps() {
  return aiOsApps.flatMap((group) => group.apps);
}

function launcherApp(appId) {
  return launcherApps().find((app) => app.appId === appId);
}

function activeWindow() {
  return state.windows.find((win) => win.windowId === state.activeWindowId) ?? null;
}

function chatContextWindow() {
  const active = activeWindow();
  if (active?.appId !== "ai-chat") return active;
  return state.windows
    .filter((win) => win.appId !== "ai-chat" && !win.minimized)
    .sort((a, b) => b.zIndex - a.zIndex)[0] ?? null;
}

function topVisibleWindow() {
  return state.windows.filter((win) => !win.minimized).sort((a, b) => b.zIndex - a.zIndex)[0] ?? null;
}

function appStatusLabel(status) {
  return {
    connected: "Connected",
    "local route": "Local app",
    "not running": "Not running",
    "not configured": "Not configured",
    unavailable: "Unavailable"
  }[status] ?? "Unavailable";
}

function slug(value) {
  return String(value ?? "unavailable").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unavailable";
}

function AiOsStartMenu() {
  renderStartMenu();
}

function renderStartMenu() {
  els.startButton.setAttribute("aria-expanded", String(state.startMenuOpen));
  els.startMenu.hidden = !state.startMenuOpen;
  els.startMenu.innerHTML = `
    <header class="start-menu-header">
      <div><p class="eyebrow">Applications</p><h2>AI Workspace</h2></div>
      <span>${escapeHtml(state.status?.runningTools ?? 0)} running</span>
    </header>
    <div class="start-menu-groups">
      ${aiOsApps.map((group) => `
        <section class="start-menu-group">
          <h3>${escapeHtml(group.category)}</h3>
          ${group.apps.map((app) => `
            <button type="button" data-launch-app="${escapeHtml(app.appId)}">
              <span class="launcher-icon">${escapeHtml(app.icon ?? "AI")}</span>
              <span class="launcher-copy"><strong>${escapeHtml(app.title)}</strong><small>${escapeHtml(app.description)}</small></span>
              <span class="launcher-status launcher-status-${escapeHtml(slug(app.status))}">${escapeHtml(appStatusLabel(app.status))}</span>
            </button>
          `).join("")}
        </section>
      `).join("")}
    </div>
    <footer class="start-menu-footer"><span><i aria-hidden="true"></i>${state.status?.safeMode ? "Safe mode active" : "Safety disabled"}</span><code>E:/AI_WORKSPACE</code></footer>
  `;

  els.startMenu.querySelectorAll("[data-launch-app]").forEach((button) => {
    button.addEventListener("click", () => {
      openApp(button.dataset.launchApp);
      state.startMenuOpen = false;
      AiOsStartMenu();
    });
  });
}

function AiOsTaskbar() {
  renderTaskbar();
}

function renderTaskbar() {
  els.taskbarSafeMode.textContent = state.status?.safeMode ? "Safe mode" : "Unsafe";
  els.taskbarRunningCount.textContent = `${state.status?.runningTools ?? 0} running`;
  els.taskbarWindows.innerHTML = state.windows.length ? state.windows.map((win) => `
    <button type="button" data-taskbar-window="${escapeHtml(win.windowId)}" aria-selected="${win.windowId === state.activeWindowId && !win.minimized}">
      <span class="taskbar-dot" data-window-state="${win.minimized ? "minimized" : win.focused ? "active" : "open"}"></span>
      ${escapeHtml(win.title)}
    </button>
  `).join("") : '<span class="taskbar-empty">Workspace ready</span>';

  els.taskbarWindows.querySelectorAll("[data-taskbar-window]").forEach((button) => {
    button.addEventListener("click", () => restoreWindow(button.dataset.taskbarWindow));
  });
}

function AiOsAppHost(app) {
  const host = document.createElement("section");
  host.className = `app-host-state app-host-${slug(app.status)}`;
  host.innerHTML = `
    <div class="app-host-intro">
      <span class="app-host-icon">${escapeHtml(app.icon ?? "AI")}</span>
      <div><p class="eyebrow">${escapeHtml(appStatusLabel(app.status))}</p><h2>${escapeHtml(app.title)}</h2></div>
    </div>
    <p class="app-host-description">${escapeHtml(app.description ?? "This app does not have a local view configured yet.")}</p>
    ${app.route ? `
      <div class="local-route-bar">
        <div><span class="route-status"><i aria-hidden="true"></i>Local route configured</span><code>${escapeHtml(app.route)}</code></div>
        <a class="run-button" href="${escapeHtml(app.route)}" target="_blank" rel="noreferrer">Open app</a>
      </div>
      ${app.host === "iframe" ? `<details class="embedded-app-preview"><summary>Embedded preview</summary><iframe class="local-app-frame" src="${escapeHtml(app.route)}" title="${escapeHtml(app.title)}" loading="lazy" sandbox="allow-same-origin allow-scripts allow-forms allow-popups"></iframe></details>` : ""}
    ` : ""}
  `;
  return host;
}

function AiOsChatWindow() {
  return windowContent(launcherApp("ai-chat"));
}

function AiOsSystemMonitor() {
  return windowContent(launcherApp("system-monitor"));
}

function windowContent(app) {
  if (app.templateId) {
    const panel = document.querySelector(`#${CSS.escape(app.templateId)}`);
    if (!panel) return AiOsAppHost({ ...app, status: "unavailable", description: "App template is missing." });
    panel.hidden = false;
    return panel;
  }
  return AiOsAppHost(app);
}

function AiOsWindow(win) {
  const element = document.createElement("article");
  element.className = `ai-os-window window-${slug(win.appId)}`;
  element.dataset.windowId = win.windowId;
  element.innerHTML = `
    <header class="window-titlebar">
      <div class="window-title">
        <span class="window-app-mark">${escapeHtml(win.app.icon ?? "AI")}</span>
        <span class="window-title-copy"><strong>${escapeHtml(win.title)}</strong><small>${escapeHtml(win.app.description ?? win.appId)}</small></span>
      </div>
      <div class="window-controls">
        <button type="button" data-window-action="minimize" aria-label="Minimize" title="Minimize">&#8722;</button>
        <button type="button" data-window-action="maximize" aria-label="Maximize" title="Maximize">&#9633;</button>
        <button type="button" data-window-action="close" aria-label="Close" title="Close">&#215;</button>
      </div>
    </header>
    <div class="window-body"></div>
  `;
  element.querySelector(".window-body").appendChild(windowContent(win.app));
  element.addEventListener("pointerdown", () => focusWindow(win.windowId));
  element.querySelector('[data-window-action="minimize"]').addEventListener("click", (event) => {
    event.stopPropagation();
    minimizeWindow(win.windowId);
  });
  element.querySelector('[data-window-action="maximize"]').addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMaximizeWindow(win.windowId);
  });
  element.querySelector('[data-window-action="close"]').addEventListener("click", (event) => {
    event.stopPropagation();
    closeWindow(win.windowId);
  });
  enableWindowDrag(element, win);
  return element;
}

function AiOsWindowManager() {
  syncWindowElements();
}

function openApp(appId) {
  const app = launcherApp(appId);
  if (!app) return;
  const existing = state.windows.find((win) => win.appId === appId);
  if (existing) {
    existing.minimized = false;
    focusWindow(existing.windowId);
    return;
  }

  const offset = state.windowOffset++ % 7;
  const bounds = els.windowLayer.getBoundingClientRect();
  const desiredWidth = appId === "ai-chat" ? 900 : 1000;
  const desiredHeight = appId === "ai-chat" ? 650 : 680;
  const width = Math.max(360, Math.min(desiredWidth, bounds.width - 64));
  const height = Math.max(300, Math.min(desiredHeight, bounds.height - 48));
  const win = {
    windowId: `window-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    appId,
    title: app.title,
    x: Math.max(8, Math.min(40 + offset * 26, bounds.width - width - 8)),
    y: Math.max(8, Math.min(24 + offset * 22, bounds.height - height - 8)),
    width,
    height,
    zIndex: ++state.nextZIndex,
    focused: true,
    minimized: false,
    maximized: false,
    app
  };

  state.windows.forEach((item) => { item.focused = false; });
  state.windows.push(win);
  state.activeWindowId = win.windowId;
  const element = AiOsWindow(win);
  els.windowLayer.appendChild(element);
  syncWindowElements();
}

function focusWindow(windowId) {
  const win = state.windows.find((item) => item.windowId === windowId);
  if (!win) return;
  state.windows.forEach((item) => { item.focused = item.windowId === windowId; });
  win.zIndex = ++state.nextZIndex;
  state.activeWindowId = windowId;
  syncWindowElements();
}

function minimizeWindow(windowId) {
  const win = state.windows.find((item) => item.windowId === windowId);
  if (!win) return;
  win.minimized = true;
  win.focused = false;
  state.activeWindowId = topVisibleWindow()?.windowId ?? null;
  if (state.activeWindowId) focusWindow(state.activeWindowId);
  syncWindowElements();
}

function restoreWindow(windowId) {
  const win = state.windows.find((item) => item.windowId === windowId);
  if (!win) return;
  win.minimized = false;
  focusWindow(windowId);
}

function toggleMaximizeWindow(windowId) {
  const win = state.windows.find((item) => item.windowId === windowId);
  if (!win) return;
  win.maximized = !win.maximized;
  win.minimized = false;
  focusWindow(windowId);
}

function closeWindow(windowId) {
  const index = state.windows.findIndex((item) => item.windowId === windowId);
  if (index < 0) return;
  const [win] = state.windows.splice(index, 1);
  const element = els.windowLayer.querySelector(`[data-window-id="${CSS.escape(windowId)}"]`);
  const templateRoot = document.querySelector("#app-templates");
  const panel = element?.querySelector(".shell-panel");
  if (panel) templateRoot.appendChild(panel);
  element?.remove();
  state.activeWindowId = topVisibleWindow()?.windowId ?? null;
  if (state.activeWindowId) focusWindow(state.activeWindowId);
  else syncWindowElements();
  win.focused = false;
}

function syncWindowElements() {
  state.windows.forEach((win) => {
    const element = els.windowLayer.querySelector(`[data-window-id="${CSS.escape(win.windowId)}"]`);
    if (!element) return;
    element.classList.toggle("focused", win.focused);
    element.classList.toggle("maximized", win.maximized);
    element.hidden = win.minimized;
    element.style.zIndex = String(win.zIndex);
    if (!win.maximized) {
      element.style.left = `${win.x}px`;
      element.style.top = `${win.y}px`;
      element.style.width = `${win.width}px`;
      element.style.height = `${win.height}px`;
    } else {
      element.style.left = "";
      element.style.top = "";
      element.style.width = "";
      element.style.height = "";
    }
  });
  els.desktopCopy.hidden = state.windows.some((win) => !win.minimized);
  updateChatContext();
  AiOsTaskbar();
}

function enableWindowDrag(element, win) {
  const titlebar = element.querySelector(".window-titlebar");
  titlebar.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button") || win.maximized) return;
    event.preventDefault();
    focusWindow(win.windowId);
    const startX = event.clientX;
    const startY = event.clientY;
    const originalX = win.x;
    const originalY = win.y;
    titlebar.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      win.x = Math.max(8, originalX + moveEvent.clientX - startX);
      win.y = Math.max(8, originalY + moveEvent.clientY - startY);
      syncWindowElements();
    };
    const stop = () => {
      titlebar.removeEventListener("pointermove", move);
      titlebar.removeEventListener("pointerup", stop);
      titlebar.removeEventListener("pointercancel", stop);
    };
    titlebar.addEventListener("pointermove", move);
    titlebar.addEventListener("pointerup", stop);
    titlebar.addEventListener("pointercancel", stop);
  });
}

function updateChatContext() {
  if (!els.chatContext) return;
  const win = chatContextWindow();
  els.chatContext.textContent = win ? `Active app: ${win.title} (${win.appId})` : "No active app context yet.";
}

function localModelName(model) {
  return typeof model === "string" ? model : String(model?.id ?? model?.name ?? model?.model ?? "");
}

function localLlmContextLimit() {
  const config = state.localLlm.config ?? {};
  const activeModel = config.activeModel ?? config.active_model ?? config.model;
  const model = state.localLlm.models.find((item) => localModelName(item) === activeModel) ?? {};
  return state.localLlm.health?.contextLimit
    ?? state.localLlm.health?.context_limit
    ?? config.contextLimit
    ?? config.context_limit
    ?? model.contextLength
    ?? model.context_length
    ?? model.maxContextLength
    ?? model.max_context_length
    ?? null;
}

function localLlmView() {
  const health = state.localLlm.health ?? {};
  const rawStatus = String(health.status ?? state.localLlm.modelsStatus ?? "offline");
  const normalized = rawStatus.toLowerCase();
  const connected = health.connected === true || health.ok === true || /^(connected|online|ready|healthy)$/.test(normalized);
  const fallback = /fallback/.test(normalized) || health.fallback === true;
  const label = state.localLlm.busy && !state.localLlm.health
    ? "Checking"
    : fallback
      ? "Fallback mode"
      : connected
        ? "Connected"
        : rawStatus.replaceAll("_", " ");
  return { label, tone: fallback ? "warning" : connected ? "success" : "error" };
}

function localLlmContextText() {
  const health = state.localLlm.health ?? {};
  const usage = health.contextUsage ?? health.context_usage ?? health.usage;
  const tokenTotal = typeof usage === "object"
    ? usage?.totalTokens ?? usage?.total_tokens
      ?? (Number(usage?.inputTokens ?? usage?.input_tokens ?? 0) + Number(usage?.outputTokens ?? usage?.output_tokens ?? 0) || null)
    : usage;
  const used = health.contextUsed ?? health.context_used ?? (typeof usage === "object" ? usage?.used ?? tokenTotal : usage);
  const limit = localLlmContextLimit();
  return used != null && limit != null ? `${used} / ${limit}` : limit != null ? String(limit) : "—";
}

function localLlmDurationText() {
  const health = state.localLlm.health ?? {};
  const duration = state.localLlm.lastDurationMs ?? health.responseDurationMs ?? health.durationMs ?? health.duration_ms;
  return Number.isFinite(Number(duration)) ? `${Math.round(Number(duration))} ms` : "—";
}

function renderLocalLlm() {
  const config = state.localLlm.config ?? {};
  const view = localLlmView();
  const provider = config.provider ?? state.localLlm.health?.provider ?? "Local LLM";
  const providerLabel = provider === "lmstudio" ? "LM Studio" : provider;
  const activeModel = config.activeModel ?? config.active_model ?? config.model ?? "";
  const draftModel = els.localLlmSettings.open ? els.localLlmModel.value : activeModel;
  const modelNames = [...new Set([activeModel, ...state.localLlm.models.map(localModelName)].filter(Boolean))];

  els.localLlmBadge.className = `chat-local-badge chat-local-badge-${view.tone}`;
  els.localLlmBadge.textContent = view.label;
  els.localLlmSummary.innerHTML = `
    <span><strong>${escapeHtml(providerLabel)}</strong></span>
    <span>Model: <strong>${escapeHtml(activeModel || "Not selected")}</strong></span>
    <span class="status status-${view.tone}">${escapeHtml(view.label)}</span>
    <span>Context: <strong>${escapeHtml(localLlmContextText())}</strong></span>
    <span>Duration: <strong>${escapeHtml(localLlmDurationText())}</strong></span>
  `;
  els.localLlmProvider.value = providerLabel;
  if (!els.localLlmSettings.open || !els.localLlmBaseUrl.value) els.localLlmBaseUrl.value = config.baseUrl ?? config.base_url ?? "";
  els.localLlmModel.innerHTML = `<option value="">${modelNames.length ? "Select model" : "No models found"}</option>${modelNames
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("")}`;
  els.localLlmModel.value = modelNames.includes(draftModel) ? draftModel : activeModel;
  els.localLlmContextLimit.value = localLlmContextLimit() ?? "—";
  els.localLlmSettingsStatus.textContent = state.localLlm.message;
  const requestBusy = state.localLlm.busy || state.chatBusy || Boolean(state.ideaLab.busyAction);
  els.openLocalLlmSettings.disabled = requestBusy;
  els.localLlmConfigForm.querySelectorAll("button, input:not([readonly]), select").forEach((control) => {
    control.disabled = requestBusy;
  });
  els.chatSendButton.disabled = requestBusy || !state.currentChat;
  renderIdeaLabControls();
}

function switchPanel(panel) {
  state.activePanel = panel;
}

function renderTopbar() {
  const workspacePath = state.status?.workspaceRoot ?? "E:/AI_WORKSPACE";
  const safeMode = state.status?.safeMode !== false;
  els.workspacePath.textContent = workspacePath;
  els.safeMode.textContent = safeMode ? "Safe mode" : "Unsafe";
  els.runtimeSummary.textContent = `${state.status?.toolsEnabled ?? 0}/${state.status?.toolsTotal ?? 0} tools enabled`;
  els.runningSummary.textContent = `${state.status?.runningTools ?? 0} running`;
  els.homeSafeMode.textContent = safeMode ? "Safe mode" : "Unsafe";
  els.homeRunningCount.textContent = String(state.status?.runningTools ?? 0);
  els.homeEnabledTools.textContent = `${state.status?.toolsEnabled ?? 0} / ${state.status?.toolsTotal ?? 0}`;
  els.homeWorkspacePath.textContent = workspacePath;
}

function renderDashboard() {
  const s = state.status ?? {};
  const cards = [
    ["Apps", s.appsTotal ?? 0],
    ["Tools", s.toolsTotal ?? 0],
    ["Enabled", s.toolsEnabled ?? 0],
    ["Disabled", s.toolsDisabled ?? 0],
    ["Running", s.runningTools ?? 0],
    ["Chats", s.recentChats?.length ?? 0],
    ["Intakes", s.recentProjectIntakes?.length ?? 0]
  ];

  els.dashboardStats.innerHTML = cards.map(([label, value]) => `
    <article class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>
  `).join("");

  els.dashboardRecent.innerHTML = `
    ${renderMiniList("Recent Workflow Runs", s.recentWorkflowRuns, (run) => `${run.workflowName} - ${run.status}`)}
    ${renderMiniList("Recent Logs", s.recentLogs, (log) => `${log.appId}/${log.commandId} - ${log.runtimeStatus}`)}
    ${renderMiniList("Recent Chats", s.recentChats, (chat) => chat.title)}
    ${renderMiniList("Recent Project Intakes", s.recentProjectIntakes, (intake) => intake.input?.projectName || "Untitled project")}
  `;
}

function renderMiniList(title, values = [], labelFor) {
  return `
    <section class="mini-panel">
      <h3>${escapeHtml(title)}</h3>
      <ul>
        ${(values.length ? values : [null]).map((value) => `<li>${value ? escapeHtml(labelFor(value)) : '<span class="muted">None yet</span>'}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderApps() {
  if (state.apps.length === 0) {
    els.apps.innerHTML = '<p class="muted">No manifests found.</p>';
    return;
  }

  els.apps.innerHTML = state.apps.map((app) => {
    const enabled = app.commands.filter((command) => command.runtime?.enabled !== false).length;
    const disabled = app.commands.length - enabled;

    return `
      <button class="app-button" data-app-id="${escapeHtml(app.id)}" aria-selected="${app.id === state.selectedAppId}">
        <strong>${escapeHtml(app.name)}</strong>
        <span class="muted">${escapeHtml(app.id)} - ${escapeHtml(app.version)}</span>
        <span>${app.commands.length} command(s), ${enabled} enabled, ${disabled} disabled</span>
      </button>
    `;
  }).join("");

  els.apps.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedAppId = button.dataset.appId;
      renderApps();
      renderAppDetails();
    });
  });
}

function renderAppDetails() {
  const app = selectedApp();

  if (!app) {
    els.appName.textContent = "No app selected";
    els.appDetails.innerHTML = "";
    return;
  }

  const running = app.commands.filter((command) => command.runtime?.runtimeStatus === "running").length;
  const enabled = app.commands.filter((command) => command.runtime?.enabled !== false).length;
  els.appName.textContent = app.name;
  els.appDetails.innerHTML = `
    <dt>ID</dt><dd>${escapeHtml(app.id)}</dd>
    <dt>Version</dt><dd>${escapeHtml(app.version)}</dd>
    <dt>Type</dt><dd>${escapeHtml(app.type)}</dd>
    <dt>Path</dt><dd>${escapeHtml(app.path)}</dd>
    <dt>Description</dt><dd>${escapeHtml(app.description)}</dd>
    <dt>Commands</dt><dd>${app.commands.length}</dd>
    <dt>Enabled</dt><dd>${enabled}</dd>
    <dt>Disabled</dt><dd>${app.commands.length - enabled}</dd>
    <dt>Health</dt><dd>${running > 0 ? `${running} running` : "idle"}</dd>
  `;

  els.errors.hidden = state.errors.length === 0;
  els.errors.innerHTML = state.errors.map((error) => `<p><strong>${escapeHtml(error.path)}</strong><br>${escapeHtml(error.error)}</p>`).join("");
}

function renderTools() {
  const tools = allTools();

  if (tools.length === 0) {
    els.commands.innerHTML = '<p class="muted">No commands registered.</p>';
    return;
  }

  els.commands.innerHTML = tools.map(({ app, command }) => {
    const runtime = command.runtime ?? {};
    const enabled = runtime.enabled !== false;
    const adapterType = command.runner?.type ?? "mock";

    return `
      <article class="tool-row">
        <div class="tool-main">
          <span class="tool-owner">${escapeHtml(app.name)}</span>
          <strong>${escapeHtml(command.name)}</strong>
          <span class="tool-id">${escapeHtml(app.id)} / ${escapeHtml(command.id)}</span>
          <span class="tool-type">${escapeHtml(command.category ?? "tool")} / ${escapeHtml(adapterType)} process / ${escapeHtml(runtime.resourceCost ?? command.resources?.cost ?? "low")} cost</span>
        </div>
        <div class="tool-runtime">
          <span class="status status-${enabled ? "success" : "error"}">${enabled ? "enabled" : "disabled"}</span>
          <span class="status status-${escapeHtml(runtime.runtimeStatus ?? "dormant")}">${escapeHtml(runtime.runtimeStatus ?? "dormant")}</span>
          <span class="runtime-meta">${escapeHtml(runtime.timeoutMs ?? command.resources?.timeoutMs ?? command.runner?.timeoutMs ?? 30000)}ms timeout / max ${escapeHtml(runtime.maxConcurrent ?? 1)}</span>
        </div>
        <div class="command-actions">
          <button class="run-button" data-action="run" data-app-id="${escapeHtml(app.id)}" data-command-id="${escapeHtml(command.id)}" ${enabled ? "" : "disabled"}>Run</button>
          <button class="secondary-button" data-action="toggle" data-enabled="${enabled ? "false" : "true"}" data-app-id="${escapeHtml(app.id)}" data-command-id="${escapeHtml(command.id)}">${enabled ? "Disable" : "Enable"}</button>
        </div>
      </article>
    `;
  }).join("");

  els.commands.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.action === "toggle") {
        toggleCommand(button.dataset.appId, button.dataset.commandId, button.dataset.enabled === "true", button);
      } else {
        runCommand(button.dataset.appId, button.dataset.commandId, button);
      }
    });
  });
}

function workflowValue(workflow, field) {
  return state.workflowPrefill?.workflowId === workflow.id ? state.workflowPrefill.input?.[field] : undefined;
}

function renderWorkflowInput(workflow, field, schema) {
  const value = workflowValue(workflow, field);

  if (field === "targetPath") {
    return `
      <label class="field-label">${escapeHtml(schema.title ?? field)}
        <select data-workflow-input="${escapeHtml(field)}" data-workflow-id="${escapeHtml(workflow.id)}">
          ${state.workflowTargets.map((target) => `<option value="${escapeHtml(target.targetPath)}">${escapeHtml(target.label)} - ${escapeHtml(target.targetPath)}</option>`).join("")}
        </select>
      </label>
    `;
  }

  if (Array.isArray(schema.enum)) {
    return `
      <label class="field-label">${escapeHtml(schema.title ?? field)}
        <select data-workflow-input="${escapeHtml(field)}" data-workflow-type="string" data-workflow-id="${escapeHtml(workflow.id)}">
          ${schema.enum.map((option) => `<option value="${escapeHtml(option)}" ${value === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
      </label>
    `;
  }

  if (schema.type === "array") {
    return `
      <label class="field-label">${escapeHtml(schema.title ?? field)}
        <input type="text" value="${escapeHtml(Array.isArray(value) ? value.join(", ") : "")}" data-workflow-input="${escapeHtml(field)}" data-workflow-type="array" data-workflow-id="${escapeHtml(workflow.id)}">
      </label>
    `;
  }

  if (schema.type === "integer" || schema.type === "number") {
    return `
      <label class="field-label">${escapeHtml(schema.title ?? field)}
        <input type="number" min="1" step="1" value="${escapeHtml(value ?? schema.default ?? "")}" data-workflow-input="${escapeHtml(field)}" data-workflow-type="${escapeHtml(schema.type)}" data-workflow-id="${escapeHtml(workflow.id)}">
      </label>
    `;
  }

  return `
    <label class="field-label">${escapeHtml(schema.title ?? field)}
      <input type="text" value="${escapeHtml(value ?? "")}" data-workflow-input="${escapeHtml(field)}" data-workflow-type="string" data-workflow-id="${escapeHtml(workflow.id)}">
    </label>
  `;
}

function renderWorkflows() {
  if (state.workflows.length === 0) {
    els.workflows.innerHTML = '<p class="muted">No workflows registered.</p>';
    return;
  }

  els.workflows.innerHTML = state.workflows.map((workflow) => {
    const inputFields = Object.entries(workflow.inputSchema?.properties ?? {});

    return `
      <article class="workflow-card">
        <strong>${escapeHtml(workflow.name)}</strong>
        <p class="muted">${escapeHtml(workflow.id)}</p>
        <p>${escapeHtml(workflow.description ?? "")}</p>
        ${inputFields.map(([field, schema]) => renderWorkflowInput(workflow, field, schema)).join("")}
        <ol>${workflow.steps.map((step) => `<li><strong>${escapeHtml(step.name)}</strong> <span class="muted">${escapeHtml(step.appId)} / ${escapeHtml(step.commandId)}</span></li>`).join("")}</ol>
        <button class="run-button" data-workflow-id="${escapeHtml(workflow.id)}">Run Workflow</button>
      </article>
    `;
  }).join("");

  els.workflows.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => runWorkflow(button.dataset.workflowId, button));
  });
}

function renderWorkflowResult() {
  els.workflowResult.hidden = !state.latestWorkflowRun;
  els.workflowResult.innerHTML = state.latestWorkflowRun
    ? `<p><strong>${escapeHtml(state.latestWorkflowRun.workflowName)}</strong> <span class="status status-${escapeHtml(state.latestWorkflowRun.status)}">${escapeHtml(state.latestWorkflowRun.status)}</span></p><p>${escapeHtml(state.latestWorkflowRun.combinedReport?.summary ?? state.latestWorkflowRun.stopReason ?? "")}</p>`
    : "";
}

function renderWorkflowRuns() {
  els.workflowRuns.innerHTML = state.workflowRuns.length === 0
    ? '<p class="muted">No workflow runs yet.</p>'
    : state.workflowRuns.slice(0, 8).map((run) => `
      <div class="log-row">
        <div>${escapeHtml(new Date(run.startedAt).toLocaleString())}</div>
        <div><strong>${escapeHtml(run.workflowName)}</strong><br><span class="muted">${escapeHtml(run.combinedReport?.summary ?? "")}</span></div>
        <div>${escapeHtml(run.stepResults.length)} step(s)</div>
        <div>${escapeHtml(run.stopReason ?? "No stop reason")}</div>
        <div><span class="status status-${escapeHtml(run.status)}">${escapeHtml(run.status)}</span></div>
      </div>
    `).join("");
}

function renderIntakeList(values, emptyText = "None") {
  return `<ul>${(values?.length ? values : [emptyText]).map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`;
}

function renderProjectIntakeResult() {
  const intake = state.latestProjectIntake;
  const analysis = intake?.analysis;
  const input = intake?.input ?? {};
  const missing = (analysis?.missingInformation ?? []).map((value) => missingLabels[value] ?? value);

  els.projectIntakeResult.hidden = !analysis;
  els.projectIntakeResult.innerHTML = analysis
    ? `
      <div class="intake-summary-grid">
        <div class="intake-summary-item"><strong>${intakeLabels.wants}</strong><p>${escapeHtml(input.desiredResult || analysis.humanSummary)}</p></div>
        <div class="intake-summary-item"><strong>${intakeLabels.problem}</strong><p>${escapeHtml(analysis.coreProblem)}</p></div>
        <div class="intake-summary-item"><strong>${intakeLabels.missing}</strong><p>${escapeHtml(input.whatIsMissingNow || missing.join(", ") || "No critical gaps found.")}</p></div>
        <div class="intake-summary-item"><strong>${intakeLabels.clarify}</strong>${renderIntakeList(missing.map((value) => `Clarify: ${value}`), "Nothing else for now.")}</div>
        <div class="intake-summary-item"><strong>${intakeLabels.features}</strong>${renderIntakeList(analysis.suggestedFeatures)}</div>
        <div class="intake-summary-item"><strong>${intakeLabels.cap}</strong><p>${analysis.readiness === "ready_for_cap_pack" ? "Yes, enough basics are present." : "Not yet, clarify the missing answers first."}</p></div>
      </div>
    `
    : "";
}

function renderProjectIntakeHistory() {
  els.projectIntakes.innerHTML = state.projectIntakes.length === 0
    ? '<p class="muted">No saved project intakes yet.</p>'
    : state.projectIntakes.slice(0, 8).map((intake) => `
      <div class="intake-history-row">
        <strong>${escapeHtml(intake.input?.projectName || "Untitled project")}</strong>
        <span class="muted">${escapeHtml(intake.analysis?.detectedProjectType ?? "web-app")} - ${escapeHtml(new Date(intake.createdAt).toLocaleString())}</span>
        <span class="status status-${intake.analysis?.readiness === "ready_for_cap_pack" ? "success" : "warning"}">${intake.analysis?.readiness === "ready_for_cap_pack" ? "ready" : "needs info"}</span>
      </div>
    `).join("");
}

function renderActionResult(result) {
  if (!result) return "";

  if (Array.isArray(result.createdFiles) || Array.isArray(result.skippedFiles)) {
    return `
      <div class="action-result">
        <p class="muted">${escapeHtml(result.relativePath ?? result.draftPath ?? "Draft workspace")}</p>
        ${renderIntakeList(result.createdFiles, "No files created.").replace("<ul>", "<strong>Created</strong><ul>")}
        ${renderIntakeList(result.skippedFiles, "No files skipped.").replace("<ul>", "<strong>Skipped</strong><ul>")}
        ${result.overwrittenFiles?.length ? renderIntakeList(result.overwrittenFiles).replace("<ul>", "<strong>Overwritten</strong><ul>") : ""}
      </div>
    `;
  }

  return `<p class="muted">${escapeHtml(result.relativePath ?? result.workflowId ?? result.intakeId ?? "confirmed")}</p>`;
}

function ideaText(value) {
  if (value == null) return "";
  if (typeof value !== "object") return String(value);
  return String(value.title ?? value.name ?? value.label ?? value.summary ?? value.description ?? JSON.stringify(value));
}

function ideaValues(values) {
  return Array.isArray(values) ? values : values == null ? [] : [values];
}

function ideaSessionId(session = state.ideaLab.session) {
  return session?.ideaSessionId ?? session?.id ?? null;
}

function ideaSessionMatchesCurrentChat() {
  const conversationId = state.ideaLab.session?.conversationId ?? state.ideaLab.session?.conversation_id;
  return Boolean(conversationId && conversationId === state.currentChat?.session?.id);
}

function ideaVariantId(variant) {
  return String(variant?.variantId ?? variant?.id ?? "");
}

function recommendedIdeaVariant(result = state.ideaLab.result) {
  const recommendation = result?.recommendedVariant ?? result?.recommended_variant;
  const variants = result?.variants ?? [];
  if (!recommendation) return null;
  const key = typeof recommendation === "object"
    ? ideaVariantId(recommendation) || String(recommendation.title ?? "")
    : String(recommendation);
  return variants.find((variant) => ideaVariantId(variant) === key || String(variant.title ?? "") === key)
    ?? (typeof recommendation === "object" ? recommendation : null);
}

function ideaScore(variant, result, field) {
  const scores = result?.scores;
  const variantScores = Array.isArray(scores)
    ? scores.find((item) => ideaVariantId(item) === ideaVariantId(variant))
    : scores?.[ideaVariantId(variant)] ?? scores;
  return variant?.[field] ?? variantScores?.[field] ?? "—";
}

function renderIdeaListCard(title, values, emptyText = "None") {
  const list = ideaValues(values).map(ideaText).filter(Boolean);
  return `<div class="intake-summary-item"><strong>${escapeHtml(title)}</strong>${renderIntakeList(list, emptyText)}</div>`;
}

function renderIdeaVariant(variant, result) {
  const recommended = recommendedIdeaVariant(result);
  const recommendedKey = recommended ? ideaVariantId(recommended) || String(recommended.title ?? "") : "";
  const key = ideaVariantId(variant) || String(variant.title ?? "");
  const selectedId = result?.selectedVariantId ?? result?.selected_variant_id
    ?? state.ideaLab.session?.selectedVariantId ?? state.ideaLab.session?.selected_variant_id;
  const selected = selectedId != null && String(selectedId) === ideaVariantId(variant);
  const scoreFields = [
    ["Feasibility", "feasibilityScore"],
    ["Product value", "productValueScore"],
    ["Complexity", "implementationComplexityScore"],
    ["Recommendation", "recommendationScore"]
  ];
  const details = [
    ["Target user", variant.targetUser ?? variant.target_user],
    ["Value", variant.valueProposition ?? variant.value_proposition],
    ["Workflow", variant.coreWorkflow ?? variant.core_workflow],
    ["Architecture", variant.technicalArchitectureSummary ?? variant.technical_architecture_summary]
  ].filter(([, value]) => value);

  return `
    <article class="idea-variant-card${recommendedKey === key ? " recommended" : ""}${selected ? " selected" : ""}">
      <header>
        <div><span class="muted">${escapeHtml(ideaVariantId(variant) || "Variant")}</span><h4>${escapeHtml(variant.title ?? "Untitled variant")}</h4></div>
        ${recommendedKey === key ? '<span class="status status-success">Recommended</span>' : ""}
      </header>
      <p>${escapeHtml(variant.concept ?? "")}</p>
      <dl>${details.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(ideaText(value))}</dd></div>`).join("")}</dl>
      <div class="idea-score-grid">${scoreFields.map(([label, field]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(ideaScore(variant, result, field))}</strong></div>`).join("")}</div>
      <div class="idea-variant-lists">
        ${renderIdeaListCard("Advantages", variant.advantages, "Not listed")}
        ${renderIdeaListCard("Risks", variant.risks ?? variant.weaknesses, "Not listed")}
      </div>
      <button class="secondary-button" type="button" data-select-variant="${escapeHtml(ideaVariantId(variant))}" ${!ideaVariantId(variant) || selected || state.ideaLab.busyAction ? "disabled" : ""}>${selected ? "Selected" : "Use this variant"}</button>
    </article>
  `;
}

function renderIdeaComparison(variants, result) {
  if (!state.ideaLab.showComparison || variants.length < 2) return "";
  return `
    <div class="idea-comparison">
      <table>
        <thead><tr><th>Variant</th><th>Feasibility</th><th>Value</th><th>Complexity</th><th>Recommendation</th></tr></thead>
        <tbody>${variants.map((variant) => `<tr>
          <th>${escapeHtml(variant.title ?? ideaVariantId(variant))}</th>
          <td>${escapeHtml(ideaScore(variant, result, "feasibilityScore"))}</td>
          <td>${escapeHtml(ideaScore(variant, result, "productValueScore"))}</td>
          <td>${escapeHtml(ideaScore(variant, result, "implementationComplexityScore"))}</td>
          <td>${escapeHtml(ideaScore(variant, result, "recommendationScore"))}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function renderIdeaResult() {
  const result = state.ideaLab.result;
  const action = state.ideaLab.action;
  const intake = state.ideaLab.intake;
  const handoff = state.ideaLab.handoff;
  if (!ideaSessionMatchesCurrentChat() || (!result && !action && !intake && !handoff)) return "";
  const variants = result?.variants ?? [];
  const recommended = recommendedIdeaVariant(result);
  const technicalDetails = JSON.stringify({ session: state.ideaLab.session, result, action, intake, handoff }, null, 2);

  return `
    <section class="idea-lab-result" aria-label="Idea Lab analysis">
      <header class="idea-result-heading">
        <div><p class="eyebrow">Idea Lab result</p><h3>${escapeHtml(result?.normalizedIdea ?? result?.normalized_idea ?? state.ideaLab.session?.normalizedIdea ?? state.ideaLab.session?.normalized_idea ?? result?.problem ?? "Structured analysis")}</h3></div>
        ${recommended ? `<span class="status status-success">Recommended: ${escapeHtml(recommended.title ?? ideaVariantId(recommended))}</span>` : ""}
      </header>
      <div class="intake-summary-grid">
        <div class="intake-summary-item"><strong>Problem</strong><p>${escapeHtml(result?.problem ?? "Not defined yet.")}</p></div>
        ${renderIdeaListCard("Target users", result?.targetUsers ?? result?.target_users, "Not defined yet")}
        ${renderIdeaListCard("Missing information", result?.missingInformation ?? result?.missing_information, "Nothing critical listed")}
        ${renderIdeaListCard("Risks", result?.risks, "No risks listed")}
        ${renderIdeaListCard("Technical opportunities", result?.technicalOpportunities ?? result?.technical_opportunities)}
        ${renderIdeaListCard("AI and automation", [
          ...ideaValues(result?.aiOpportunities ?? result?.ai_opportunities),
          ...ideaValues(result?.automationOpportunities ?? result?.automation_opportunities)
        ])}
        ${renderIdeaListCard("Assumptions", result?.assumptions)}
        ${renderIdeaListCard("Data requirements", result?.dataRequirements ?? result?.data_requirements)}
        ${renderIdeaListCard("Required tools", result?.requiredTools ?? result?.required_tools)}
        ${renderIdeaListCard("Tool evidence", result?.toolAnalysis ? [result.toolAnalysis.summary, ...ideaValues(result.toolAnalysis.evidence)] : [])}
        ${renderIdeaListCard("Next safe actions", result?.nextSafeActions ?? result?.next_safe_actions)}
      </div>
      ${variants.length ? `<div class="idea-variants-heading"><h3>Variants</h3><span>${escapeHtml(variants.length)} compared</span></div><div class="idea-variant-grid">${variants.map((variant) => renderIdeaVariant(variant, result)).join("")}</div>` : ""}
      ${renderIdeaComparison(variants, result)}
      ${action ? `<div class="idea-result-notice"><strong>${escapeHtml(action.title ?? "Next action prepared")}</strong><span>${escapeHtml(action.description ?? (action.requiresConfirmation ? "Waiting for confirmation." : "Ready."))}</span>${action.requiresConfirmation && action.status === "pending" ? `<button class="secondary-button" type="button" data-confirm-idea-action="${escapeHtml(action.actionId)}">${action.actionType === "idea_lab_fullstack_handoff" ? "Confirm Handoff" : "Confirm Tool Analysis"}</button>` : ""}</div>` : ""}
      ${intake ? `<div class="idea-result-notice"><strong>Project Intake ready</strong><span>${escapeHtml(intake.id ?? intake.intakeId ?? "Saved locally")}</span></div>` : ""}
      ${handoff ? `<div class="idea-result-notice"><strong>Fullstack Designer handoff ready</strong><span>${escapeHtml(handoff.result?.summary ?? "Session created locally")}</span></div>` : ""}
      <details class="idea-technical-details"><summary>Technical details</summary><pre>${escapeHtml(technicalDetails)}</pre></details>
    </section>
  `;
}

function renderIdeaLabControls() {
  const result = ideaSessionMatchesCurrentChat() ? state.ideaLab.result : null;
  const variants = result?.variants ?? [];
  const recommended = recommendedIdeaVariant(result);
  const disabled = !state.currentChat || state.chatBusy || state.localLlm.busy || Boolean(state.ideaLab.busyAction);
  els.chatMode.value = state.chatMode;
  els.chatMode.disabled = state.chatBusy || state.localLlm.busy || Boolean(state.ideaLab.busyAction);
  els.ideaLabStatus.textContent = ideaSessionMatchesCurrentChat() || state.ideaLab.busyAction ? state.ideaLab.status : "Ready";
  els.ideaLabControls.querySelectorAll("[data-idea-action]").forEach((button) => {
    const action = button.dataset.ideaAction;
    button.disabled = disabled
      || (action === "compare" && variants.length < 2)
      || (action === "use-recommended" && !recommended)
      || (action === "send-to-fullstack-designer" && !result)
      || (action === "create-project-intake" && !result);
  });
}

function renderChats() {
  els.chatList.innerHTML = state.chats.length === 0
    ? '<p class="muted">No chats yet.</p>'
    : state.chats.map((chat) => `
      <button class="app-button" data-chat-id="${escapeHtml(chat.id)}" aria-selected="${state.currentChat?.session?.id === chat.id}">
        <strong>${escapeHtml(chat.title)}</strong>
        <span class="muted">${escapeHtml(new Date(chat.updatedAt).toLocaleString())}</span>
      </button>
    `).join("");

  els.chatList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => loadChat(button.dataset.chatId));
  });

  const chat = state.currentChat;
  const messages = chat?.messages.filter((msg) => msg.role !== "system") ?? [];
  els.newChatDetails.open = !chat;
  const messageMarkup = messages.length
    ? `
      ${chat.session.draftPath ? `<p class="chat-draft-path">Draft workspace: ${escapeHtml(chat.session.draftPath)}</p>` : ""}
      ${messages.map((msg) => `
        <article class="message message-${escapeHtml(msg.role)}">
          <strong class="message-role">${msg.role === "user" ? "You" : "AI Workspace"}</strong>
          <p>${escapeHtml(msg.content)}</p>
        </article>
      `).join("")}
    `
    : `
      <div class="chat-empty">
        <span class="chat-empty-mark" aria-hidden="true">AI</span>
        <h3>${chat ? "Conversation ready" : "Start a local conversation"}</h3>
        <p>${chat ? "Ask for project analysis or a confirmed next action." : "Create or select a chat to plan inside this workspace."}</p>
      </div>
    `;
  els.chatMessages.innerHTML = `${renderIdeaResult()}${messageMarkup}`;

  const actions = chat?.actions ?? [];
  els.chatActions.innerHTML = actions.length === 0
    ? ""
    : actions.slice().reverse().map((item) => `
      <article class="action-card">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.description)}</p>
          ${renderActionResult(item.result)}
        </div>
        <button class="secondary-button" data-action-id="${escapeHtml(item.id)}" ${item.status === "confirmed" ? "disabled" : ""}>${item.status === "confirmed" ? "Confirmed" : "Confirm"}</button>
      </article>
    `).join("");

  els.chatActions.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => confirmChatAction(button.dataset.actionId, button));
  });
  els.chatMessages.querySelectorAll("[data-select-variant]").forEach((button) => {
    button.addEventListener("click", () => runIdeaAction("select-variant", button.dataset.selectVariant));
  });
  els.chatMessages.querySelectorAll("[data-confirm-idea-action]").forEach((button) => {
    button.addEventListener("click", () => confirmIdeaAction(button.dataset.confirmIdeaAction));
  });
  els.chatSendButton.disabled = state.chatBusy || state.localLlm.busy || Boolean(state.ideaLab.busyAction) || !chat;
  els.chatRequestStatus.textContent = state.chatStatus;
  renderIdeaLabControls();
}

function renderWorkspaceFiles() {
  const listing = state.workspaceListing;
  els.workspacePathInput.value = state.workspacePath;

  if (!listing) {
    els.workspaceFiles.innerHTML = '<p class="muted">No workspace listing loaded.</p>';
    return;
  }

  const parent = listing.relativePath ? listing.relativePath.split(/[\\/]/).slice(0, -1).join("/") : "";
  els.workspaceFiles.innerHTML = `
    <div class="file-list-heading">
      <strong>${escapeHtml(listing.relativePath || ".")}</strong>
      ${listing.relativePath ? `<button class="secondary-button" data-open-path="${escapeHtml(parent)}">Up</button>` : ""}
    </div>
    ${listing.entries.map((entry) => `
      <button class="file-row" data-open-path="${escapeHtml(entry.type === "folder" ? entry.relativePath : "")}" ${entry.type === "folder" ? "" : "disabled"}>
        <span>${entry.type === "folder" ? "[dir]" : "[file]"}</span>
        <strong>${escapeHtml(entry.name)}</strong>
        <span class="muted">${escapeHtml(entry.relativePath)}</span>
      </button>
    `).join("") || '<p class="muted">Empty folder.</p>'}
  `;

  els.workspaceFiles.querySelectorAll("[data-open-path]").forEach((button) => {
    if (button.dataset.openPath !== "") {
      button.addEventListener("click", () => openWorkspacePath(button.dataset.openPath));
    }
  });
}

function renderLatestResult() {
  els.latestResult.hidden = !state.latestResult;
  els.latestResult.innerHTML = state.latestResult
    ? `<pre>${escapeHtml(JSON.stringify(state.latestResult, null, 2))}</pre>`
    : "";
}

function renderLog() {
  els.log.innerHTML = state.logs.length === 0
    ? '<p class="muted">No commands run yet.</p>'
    : state.logs.map((entry) => `
      <div class="log-row">
        <div>${escapeHtml(new Date(entry.timestamp).toLocaleString())}</div>
        <div><strong>${escapeHtml(entry.appId)} / ${escapeHtml(entry.commandId)}</strong><br><span class="muted">${escapeHtml(entry.summary)}</span></div>
        <div>${escapeHtml(entry.adapterType ?? "unknown")}<br><span class="muted">${escapeHtml(entry.runtimeStatus ?? "unknown")}, ${entry.durationMs ?? 0}ms</span></div>
        <div>${entry.blockedReason ? escapeHtml(entry.blockedReason) : entry.stderrSummary ? escapeHtml(entry.stderrSummary) : '<span class="muted">No stderr</span>'}</div>
        <div><span class="status status-${escapeHtml(entry.status)}">${escapeHtml(entry.status)}</span></div>
      </div>
    `).join("");
}

function render() {
  switchPanel(state.activePanel);
  AiOsTopBar();
  renderDashboard();
  renderApps();
  renderAppDetails();
  renderTools();
  renderWorkflows();
  renderWorkflowResult();
  renderWorkflowRuns();
  renderProjectIntakeResult();
  renderProjectIntakeHistory();
  renderLocalLlm();
  renderChats();
  renderWorkspaceFiles();
  renderLatestResult();
  renderLog();
  AiOsShell();
  AiOsWindowManager();
}

async function refreshStatus() {
  state.status = await fetchJson("/api/workspace-shell/status");
}

async function refreshApps() {
  const registry = await fetchJson("/api/apps");
  state.apps = registry.apps;
  state.errors = registry.errors;
  state.selectedAppId = state.apps.some((app) => app.id === state.selectedAppId) ? state.selectedAppId : state.apps[0]?.id ?? null;
}

async function refreshLogs() {
  state.logs = (await fetchJson("/api/logs")).logs;
}

async function refreshWorkflows() {
  state.workflows = (await fetchJson("/api/workflows")).workflows;
}

async function refreshWorkflowTargets() {
  state.workflowTargets = (await fetchJson("/api/workflows/targets")).targets;
}

async function refreshWorkflowRuns() {
  state.workflowRuns = (await fetchJson("/api/workflows/runs")).runs;
}

async function refreshProjectIntakes() {
  state.projectIntakes = (await fetchJson("/api/project-intakes")).intakes;
}

async function refreshChats() {
  state.chats = (await fetchJson("/api/chats")).chats;
}

async function refreshLocalLlm() {
  state.localLlm.busy = true;
  state.localLlm.message = "Refreshing local model status...";
  renderLocalLlm();
  const [configResult, healthResult, modelsResult] = await Promise.allSettled([
    fetchJson("/api/local-llm/config"),
    fetchJson("/api/local-llm/health"),
    fetchJson("/api/local-llm/models")
  ]);
  const errors = [configResult, healthResult, modelsResult]
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message)
    .filter(Boolean);

  if (configResult.status === "fulfilled") state.localLlm.config = configResult.value.config;
  if (healthResult.status === "fulfilled") state.localLlm.health = healthResult.value.health;
  else state.localLlm.health = { status: "offline", error: healthResult.reason?.message };
  if (modelsResult.status === "fulfilled") {
    state.localLlm.models = Array.isArray(modelsResult.value.models) ? modelsResult.value.models : [];
    state.localLlm.modelsStatus = modelsResult.value.status ?? null;
  }

  state.localLlm.message = errors[0]
    ?? state.localLlm.health?.message
    ?? state.localLlm.health?.error
    ?? localLlmView().label;
  state.localLlm.busy = false;
  renderLocalLlm();
}

async function refreshWorkspaceFiles() {
  state.workspaceListing = (await fetchJson(`/api/workspace-files?path=${encodeURIComponent(state.workspacePath)}`)).listing;
}

async function refreshShell() {
  await Promise.all([
    refreshStatus(),
    refreshApps(),
    refreshLogs(),
    refreshWorkflows(),
    refreshWorkflowTargets(),
    refreshWorkflowRuns(),
    refreshProjectIntakes(),
    refreshChats(),
    refreshLocalLlm(),
    refreshWorkspaceFiles()
  ]);
}

async function saveLocalLlmConfig(event) {
  event.preventDefault();
  const input = Object.fromEntries(new FormData(els.localLlmConfigForm).entries());
  state.localLlm.busy = true;
  state.localLlm.message = "Saving local model settings...";
  renderLocalLlm();
  try {
    const payload = await fetchJson("/api/local-llm/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseUrl: input.baseUrl, activeModel: input.activeModel })
    });
    state.localLlm.config = payload.config;
    await refreshLocalLlm();
    state.localLlm.message = "Local model settings saved.";
  } catch (error) {
    state.localLlm.message = error.message;
  } finally {
    state.localLlm.busy = false;
    renderLocalLlm();
  }
}

async function testLocalLlm() {
  const startedAt = Date.now();
  state.localLlm.busy = true;
  state.localLlm.message = "Testing local model connection...";
  renderLocalLlm();
  try {
    const payload = await fetchJson("/api/local-llm/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    const test = typeof payload.test === "object" && payload.test ? payload.test : { message: payload.test };
    state.localLlm.health = test.health ?? { ...state.localLlm.health, ...test };
    state.localLlm.lastDurationMs = test.responseDurationMs ?? test.durationMs ?? test.duration_ms ?? Date.now() - startedAt;
    state.localLlm.message = test.data?.message ?? test.message ?? "Connection test completed.";
  } catch (error) {
    state.localLlm.health = { status: "offline", error: error.message };
    state.localLlm.lastDurationMs = Date.now() - startedAt;
    state.localLlm.message = error.message;
  } finally {
    state.localLlm.busy = false;
    renderLocalLlm();
  }
}

async function unloadLocalLlm() {
  state.localLlm.busy = true;
  state.localLlm.message = "Unloading local model...";
  renderLocalLlm();
  try {
    const payload = await fetchJson("/api/local-llm/unload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    state.localLlm.message = payload.result?.message ?? "Local model unloaded.";
  } catch (error) {
    state.localLlm.message = error.message;
  } finally {
    state.localLlm.busy = false;
    renderLocalLlm();
  }
}

async function toggleCommand(appId, commandId, enabled, button) {
  button.disabled = true;
  try {
    state.apps = (await fetchJson("/api/commands/runtime", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appId, commandId, enabled })
    })).apps;
    await refreshStatus();
  } finally {
    button.disabled = false;
    render();
  }
}

async function runCommand(appId, commandId, button) {
  button.disabled = true;
  try {
    const payload = await fetchJson("/api/commands/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appId, commandId, input: {} })
    });
    state.latestResult = payload.result;
    await Promise.all([refreshLogs(), refreshApps(), refreshStatus()]);
  } catch (error) {
    state.latestResult = { status: "error", summary: error.message };
  } finally {
    button.disabled = false;
    render();
  }
}

async function runWorkflow(workflowId, button) {
  button.disabled = true;
  const input = {};
  const fields = els.workflows.querySelectorAll(`[data-workflow-id="${CSS.escape(workflowId)}"][data-workflow-input]`);

  fields.forEach((field) => {
    const name = field.dataset.workflowInput;
    if (field.dataset.workflowType === "array") input[name] = field.value.split(",").map((item) => item.trim()).filter(Boolean);
    else if (field.dataset.workflowType === "integer" || field.dataset.workflowType === "number") input[name] = Number(field.value);
    else if (field.value !== "") input[name] = field.value;
  });

  try {
    state.latestWorkflowRun = (await fetchJson("/api/workflows/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflowId, input })
    })).run;
    await Promise.all([refreshWorkflowRuns(), refreshApps(), refreshStatus()]);
  } catch (error) {
    state.latestWorkflowRun = { workflowName: workflowId, status: "stopped", stopReason: error.message, stepResults: [], combinedReport: { summary: error.message } };
  } finally {
    button.disabled = false;
    render();
  }
}

async function analyzeProjectIntake(event) {
  event.preventDefault();
  const button = els.projectIntakeForm.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    state.latestProjectIntake = (await fetchJson("/api/project-intake/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(els.projectIntakeForm).entries()))
    })).intake;
    await Promise.all([refreshProjectIntakes(), refreshStatus()]);
  } finally {
    button.disabled = false;
    render();
  }
}

async function createNewChat(event) {
  event.preventDefault();
  const payload = await fetchJson("/api/chats", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(Object.fromEntries(new FormData(els.newChatForm).entries()))
  });
  state.currentChat = payload.chat;
  els.newChatForm.reset();
  await Promise.all([refreshChats(), refreshStatus()]);
  render();
}

async function loadChat(chatId) {
  state.currentChat = (await fetchJson(`/api/chats/${encodeURIComponent(chatId)}`)).chat;
  state.chatStatus = "";
  render();
}

function currentIdeaText() {
  const typed = els.chatInput.value.trim();
  const latestUserMessage = state.currentChat?.messages.slice().reverse().find((message) => message.role === "user")?.content;
  return typed || latestUserMessage || state.ideaLab.session?.rawIdea || state.ideaLab.session?.raw_idea || "";
}

async function ensureIdeaSession() {
  if (!state.currentChat) throw new Error("Create or select a chat first.");
  const typed = els.chatInput.value.trim();
  const rawIdea = currentIdeaText();
  const existingRawIdea = state.ideaLab.session?.rawIdea ?? state.ideaLab.session?.raw_idea;
  if (ideaSessionMatchesCurrentChat() && (!typed || typed === existingRawIdea)) return state.ideaLab.session;
  if (!rawIdea) throw new Error("Enter an idea or send one in chat first.");
  const context = chatContextWindow();
  const config = state.localLlm.config ?? {};
  const payload = await fetchJson("/api/idea-lab/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      conversationId: state.currentChat.session.id,
      rawIdea,
      activeProjectId: state.currentChat.session.activeProjectId ?? state.currentChat.session.projectId ?? null,
      selectedModel: config.activeModel ?? config.active_model ?? config.model ?? null,
      activeAppId: context?.appId ?? null,
      activeAppTitle: context?.title ?? null
    })
  });
  if (!payload.session || !ideaSessionId(payload.session)) throw new Error("Idea Lab did not return a session.");
  state.ideaLab.session = payload.session;
  state.ideaLab.result = payload.result ?? null;
  state.ideaLab.action = null;
  state.ideaLab.intake = null;
  state.ideaLab.handoff = null;
  state.ideaLab.showComparison = false;
  return payload.session;
}

async function runIdeaAction(action, variantId = null) {
  if (state.chatBusy || state.localLlm.busy || state.ideaLab.busyAction) return;
  if (action === "create-project-intake") {
    if (!ideaSessionMatchesCurrentChat() || !state.ideaLab.result) return;
    if (!window.confirm("Create a Project Intake from the analyzed idea?")) return;
  }
  state.chatMode = "idea_lab";
  if (action === "compare") {
    state.ideaLab.showComparison = !state.ideaLab.showComparison;
    state.ideaLab.status = state.ideaLab.showComparison ? "Comparison shown." : "Comparison hidden.";
    render();
    return;
  }

  let requestAction = action;
  if (action === "use-recommended") {
    requestAction = "select-variant";
    variantId = ideaVariantId(recommendedIdeaVariant());
    if (!variantId) {
      state.ideaLab.status = "No recommended variant is available yet.";
      render();
      return;
    }
  }

  const startedAt = Date.now();
  state.ideaLab.busyAction = action;
  state.ideaLab.status = `${action.replaceAll("-", " ")} in progress...`;
  render();
  try {
    const session = await ensureIdeaSession();
    const context = chatContextWindow();
    const body = {
      activeAppId: context?.appId ?? null,
      activeAppTitle: context?.title ?? null,
      mode: "idea_lab"
    };
    if (requestAction === "select-variant") body.variantId = variantId;
    if (requestAction === "create-project-intake") {
      body.confirm = true;
      const intakeVariantId = variantId
        ?? (state.ideaLab.result?.selectedVariantId ?? state.ideaLab.result?.selected_variant_id)
        ?? ideaVariantId(recommendedIdeaVariant());
      if (intakeVariantId) body.variantId = intakeVariantId;
    }
    if (requestAction === "send-to-fullstack-designer") {
      body.variantId = state.ideaLab.session?.selectedVariantId ?? ideaVariantId(recommendedIdeaVariant());
    }
    const payload = await fetchJson(`/api/idea-lab/session/${encodeURIComponent(ideaSessionId(session))}/${requestAction}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    state.ideaLab.session = payload.session ?? session;
    if ("result" in payload) state.ideaLab.result = payload.result;
    state.ideaLab.action = payload.action ?? null;
    state.ideaLab.intake = payload.intake ?? null;
    state.ideaLab.handoff = payload.handoff ?? null;
    state.localLlm.lastDurationMs = Date.now() - startedAt;
    state.ideaLab.status = payload.action?.requiresConfirmation
      ? "Plan ready for confirmation."
      : payload.intake
        ? "Project Intake ready."
        : "Idea analysis updated.";
    if (payload.intake) await refreshProjectIntakes();
  } catch (error) {
    state.ideaLab.status = error.message;
  } finally {
    state.ideaLab.busyAction = null;
    render();
  }
}

async function confirmIdeaAction(actionId) {
  const sessionId = ideaSessionId();
  const fullstackHandoff = state.ideaLab.action?.actionType === "idea_lab_fullstack_handoff";
  if (!sessionId || state.ideaLab.busyAction || !window.confirm(fullstackHandoff ? "Create this Fullstack Designer session through Runtime Manager?" : "Run this approved analysis through Runtime Manager?")) return;
  const startedAt = Date.now();
  state.ideaLab.busyAction = "confirm-tools";
  state.ideaLab.status = "Running approved tools...";
  render();
  try {
    const payload = await fetchJson(`/api/idea-lab/session/${encodeURIComponent(sessionId)}/${fullstackHandoff ? "send-to-fullstack-designer" : "analyze-with-tools"}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actionId, confirm: true })
    });
    state.ideaLab.session = payload.session;
    state.ideaLab.result = payload.result;
    state.ideaLab.action = payload.action;
    state.ideaLab.handoff = payload.handoff ?? null;
    state.ideaLab.status = fullstackHandoff ? "Fullstack Designer handoff created." : "Tool evidence synthesized.";
  } catch (error) {
    state.ideaLab.status = error.message;
  } finally {
    state.localLlm.lastDurationMs = Date.now() - startedAt;
    state.ideaLab.busyAction = null;
    render();
  }
}

async function sendChatMessage(event) {
  event.preventDefault();
  if (!state.currentChat || state.chatBusy || state.localLlm.busy || state.ideaLab.busyAction) return;
  const content = els.chatInput.value.trim();
  if (!content) return;
  const context = chatContextWindow();
  const startedAt = Date.now();
  state.chatBusy = true;
  state.chatStatus = "Waiting for the local model...";
  render();
  try {
    const payload = await fetchJson(`/api/chats/${encodeURIComponent(state.currentChat.session.id)}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content,
        activeAppId: context?.appId ?? null,
        activeAppTitle: context?.title ?? null,
        mode: state.chatMode
      })
    });
    state.currentChat = payload.chat;
    els.chatInput.value = "";
    state.chatStatus = "Response received.";
    await refreshChats();
  } catch (error) {
    state.chatStatus = error.message;
  } finally {
    state.localLlm.lastDurationMs = Date.now() - startedAt;
    state.chatBusy = false;
    render();
  }
}

async function confirmChatAction(actionId, button) {
  if (!state.currentChat || !window.confirm("Confirm this local action?")) return;
  button.disabled = true;
  const payload = await fetchJson(`/api/chats/${encodeURIComponent(state.currentChat.session.id)}/actions/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ actionId })
  });
  state.currentChat = payload.chat;
  const confirmed = state.currentChat.actions.find((item) => item.id === actionId);

  if (confirmed?.result?.workflowId) {
    state.workflowPrefill = confirmed.result;
    state.activePanel = "workflows";
  }

  await Promise.all([refreshChats(), refreshProjectIntakes(), refreshWorkspaceFiles(), refreshStatus()]);
  render();
}

async function openWorkspacePath(path) {
  state.workspacePath = path;
  await refreshWorkspaceFiles();
  render();
}

async function createFolder(event) {
  event.preventDefault();
  const path = new FormData(els.createFolderForm).get("path");
  await fetchJson("/api/workspace-files/create-folder", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path })
  });
  els.createFolderForm.reset();
  await refreshWorkspaceFiles();
  render();
}

async function createFile(event) {
  event.preventDefault();
  if (!window.confirm("Create this file?")) return;
  await fetchJson("/api/workspace-files/create-file", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...Object.fromEntries(new FormData(els.createFileForm).entries()), confirm: true })
  });
  els.createFileForm.reset();
  await refreshWorkspaceFiles();
  render();
}

async function writeFile(event) {
  event.preventDefault();
  if (!window.confirm("Overwrite this text file?")) return;
  await fetchJson("/api/workspace-files/write-file", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...Object.fromEntries(new FormData(els.writeFileForm).entries()), confirm: true, overwrite: true })
  });
  els.writeFileForm.reset();
  await refreshWorkspaceFiles();
  render();
}

els.projectIntakeForm.addEventListener("submit", analyzeProjectIntake);
els.newChatForm.addEventListener("submit", createNewChat);
els.chatMessageForm.addEventListener("submit", sendChatMessage);
els.localLlmConfigForm.addEventListener("submit", saveLocalLlmConfig);
els.localLlmTest.addEventListener("click", testLocalLlm);
els.localLlmRefresh.addEventListener("click", refreshLocalLlm);
els.localLlmUnload.addEventListener("click", unloadLocalLlm);
els.openLocalLlmSettings.addEventListener("click", () => {
  els.localLlmSettings.open = true;
  els.localLlmBaseUrl.focus();
});
els.chatMode.addEventListener("change", () => {
  state.chatMode = els.chatMode.value;
});
els.ideaLabControls.addEventListener("click", (event) => {
  const button = event.target.closest("[data-idea-action]");
  if (button) runIdeaAction(button.dataset.ideaAction);
});
els.workspaceBrowseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  openWorkspacePath(new FormData(els.workspaceBrowseForm).get("path") ?? "");
});
els.createFolderForm.addEventListener("submit", createFolder);
els.createFileForm.addEventListener("submit", createFile);
els.writeFileForm.addEventListener("submit", writeFile);

els.startButton.addEventListener("click", (event) => {
  event.stopPropagation();
  state.startMenuOpen = !state.startMenuOpen;
  AiOsStartMenu();
});

els.quickLaunch.addEventListener("click", (event) => {
  const button = event.target.closest("[data-quick-launch-app]");
  if (!button) return;
  openApp(button.dataset.quickLaunchApp);
});

document.addEventListener("pointerdown", (event) => {
  if (!state.startMenuOpen) return;
  if (event.target.closest("#start-menu") || event.target.closest("#start-button")) return;
  state.startMenuOpen = false;
  AiOsStartMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !state.startMenuOpen) return;
  state.startMenuOpen = false;
  AiOsStartMenu();
});

refreshShell().then(() => {
  render();
}).catch((error) => {
  els.workspacePath.textContent = "Unable to load shell";
  els.dashboardStats.innerHTML = `<p class="errors">${escapeHtml(error.message)}</p>`;
});
