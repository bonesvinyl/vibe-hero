/* global chrome */
document.querySelector('#play').addEventListener('click', async () => {
  const status = document.querySelector('#status');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url || '');
    if (!['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(url.hostname) || url.pathname !== '/watch') throw new Error('Open a YouTube song’s watch page, then click Play here.');
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (contexts.length) { const prep = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'status' }); if (prep?.busy) throw new Error('Finish or cancel background preparation before starting gameplay.'); }
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
