const CARD_TYPES = ['观念卡', '案例卡', '方法卡'];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    CARD_TYPES.forEach(type => {
      chrome.contextMenus.create({
        id: `lambert-${type}`,
        title: `加入 ${type}`,
        contexts: ['selection']
      });
    });
  });
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const type = String(info.menuItemId || '').replace('lambert-', '') || '观念卡';
  const excerpt = (info.selectionText || '').trim();
  if (!excerpt) return;

  const draft = {
    type,
    title: '',
    thought: '',
    excerpt,
    sourceTitle: tab?.title || '微信读书',
    sourceUrl: tab?.url || '',
    capturedAt: new Date().toISOString()
  };

  await chrome.storage.local.set({ lambertReadingDraft: draft });

  if (tab?.id && chrome.sidePanel?.open) {
    chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  }
});
