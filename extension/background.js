const MENU_ROOT = "mtools-root";
const MENU_CALC = "mtools-calc";
const MENU_CONV = "mtools-conv";
const MENU_TEXT = "mtools-text";
const MENU_TEXT_UPPER = "mtools-text-upper";
const MENU_TEXT_LOWER = "mtools-text-lower";
const MENU_TEXT_TRIM = "mtools-text-trim";
const MENU_COLOR = "mtools-color";
const MENU_PASS = "mtools-pass";

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ROOT,
      title: "MTools",
      contexts: ["all"],
    });
    chrome.contextMenus.create({
      id: MENU_CALC,
      parentId: MENU_ROOT,
      title: "Калькулятор — вычислить выделение",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: MENU_CONV,
      parentId: MENU_ROOT,
      title: "Конвертер",
      contexts: ["page", "selection"],
    });
    chrome.contextMenus.create({
      id: MENU_TEXT,
      parentId: MENU_ROOT,
      title: "Текст",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: MENU_TEXT_UPPER,
      parentId: MENU_TEXT,
      title: "ВЕРХНИЙ регистр",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: MENU_TEXT_LOWER,
      parentId: MENU_TEXT,
      title: "нижний регистр",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: MENU_TEXT_TRIM,
      parentId: MENU_TEXT,
      title: "Очистить пробелы",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: MENU_COLOR,
      parentId: MENU_ROOT,
      title: "Определить цвет из выделения",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: MENU_PASS,
      parentId: MENU_ROOT,
      title: "Генератор паролей",
      contexts: ["page", "selection"],
    });
  });
}

async function openPanel(tabId, action) {
  await chrome.storage.local.set({
    mtools_context_action: {
      ...action,
      createdAt: Date.now(),
    },
  });
  try {
    await chrome.sidePanel.open({ tabId });
  } catch {
    // The panel may already be open or Chrome may reject the request for the current surface.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
  createContextMenus();
});

chrome.runtime.onStartup?.addListener(() => createContextMenus());

chrome.commands.onCommand.addListener((command) => {
  if (command !== "open-mtools") return;
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const tab = tabs?.[0];
    if (tab?.id) openPanel(tab.id, { tool: "calc" }).catch(() => {});
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const selection = (info.selectionText || "").trim();
  switch (info.menuItemId) {
    case MENU_CALC:
      openPanel(tab.id, { tool: "calc", selection }).catch(() => {});
      break;
    case MENU_CONV:
      openPanel(tab.id, { tool: "conv", selection }).catch(() => {});
      break;
    case MENU_TEXT_UPPER:
      openPanel(tab.id, { tool: "text", selection, action: "upper" }).catch(() => {});
      break;
    case MENU_TEXT_LOWER:
      openPanel(tab.id, { tool: "text", selection, action: "lower" }).catch(() => {});
      break;
    case MENU_TEXT_TRIM:
      openPanel(tab.id, { tool: "text", selection, action: "trim" }).catch(() => {});
      break;
    case MENU_COLOR:
      openPanel(tab.id, { tool: "color", selection }).catch(() => {});
      break;
    case MENU_PASS:
      openPanel(tab.id, { tool: "pass" }).catch(() => {});
      break;
  }
});
