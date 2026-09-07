/* global chrome */
document.querySelector('#play').addEventListener('click', async () => {
  const status = document.querySelector('#status');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url || '');
    if (!['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(url.hostname) || url.pathname !== '/watch') throw new Error('Open a YouTube song’s watch page, then click Play here.');
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['overlay.js'] });
    window.close();
  } catch (error) { status.textContent = error.message; }
});
