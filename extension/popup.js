/* global chrome */
document.querySelector('#play').addEventListener('click', async () => {
  const status = document.querySelector('#status');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url || '');
    if (!['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(url.hostname) || url.pathname !== '/watch') throw new Error('Open a YouTube song’s watch page, then click Play here.');
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (contexts.length) { const prep = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'status' }); if (prep?.busy) throw new Error('Close the current game or finish/cancel preparation before starting another set.'); }
    // User's extension click authorizes tab capture; an offscreen dry path keeps music audible.
    if (!contexts.length) await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['USER_MEDIA'], justification: 'Audible gameplay with a temporary star-power echo effect.' });
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    const effects = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'start-effects', streamId, tabId: tab.id });
    if (effects?.error) throw new Error(effects.error);
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['overlay.js'] });
    window.close();
  } catch (error) { status.textContent = error.message; }
});

document.querySelector('#prepare').addEventListener('click', async () => {
  const button = document.querySelector('#prepare'), status = document.querySelector('#status');
  button.disabled = true; status.textContent = 'Starting quiet preparation…';
  try {
    const result = await chrome.runtime.sendMessage({ target: 'background', type: 'prepare', difficulty: 'medium' });
    if (result?.error) throw new Error(result.error);
    status.textContent = 'Starting in the background. Open My song library for progress and any errors.';
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});
document.querySelector('#library').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('library.html') }));
