/* global chrome */
const status = document.querySelector('#status'), progress = document.querySelector('#progress'), cancel = document.querySelector('#cancel'), songs = document.querySelector('#songs');
let loading = false;
async function render() {
  if (loading) return;
  loading = true;
  try {
    const values = await chrome.storage.local.get(null), job = values['vh.preparation'];
    const stale = job?.status === 'preparing' && Date.now() - job.updatedAt > 15000;
    status.textContent = !job ? 'Nothing preparing.' : `${job.title || job.videoId} — ${stale ? 'No recent progress. The song may be paused, playing an ad, or preparation may have stopped. Check its tab.' : job.status === 'ready' ? 'Saved and ready to play.' : job.status === 'preparing' ? `Preparing quietly · ${job.progress}%` : job.error || job.status}`;
    progress.hidden = job?.status !== 'preparing'; progress.value = job?.progress || 0; cancel.hidden = job?.status !== 'preparing';
    songs.replaceChildren();
    const records = Object.entries(values).filter(([key, value]) => key.startsWith('vh.chart.') && /^[\w-]{11}$/.test(value?.youtubeId || '') && Array.isArray(value.notes)).map(([, value]) => value).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
    if (!records.length) songs.textContent = 'Your saved charts will appear here. Previous JSON downloads can be imported through the game and saved to this library.';
    for (const record of records) {
      const card = document.createElement('article'), title = document.createElement('h3'), detail = document.createElement('small'), link = document.createElement('a'), download = document.createElement('button');
      title.textContent = record.title || record.youtubeId;
      detail.textContent = `${record.notes.length} notes · ${record.settings?.difficulty || 'custom'} · ${record.settings?.bpm || '?'} BPM · saved ${new Date(record.savedAt).toLocaleString()}`;
      link.textContent = 'Open on YouTube ↗'; link.href = `https://www.youtube.com/watch?v=${record.youtubeId}`; link.target = '_blank'; link.rel = 'noopener';
      download.textContent = 'Download backup'; download.className = 'secondary';
      download.onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(record)], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = `vibe-hero-${record.youtubeId}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
      card.append(title, detail, link, download); songs.append(card);
    }
  } catch (error) { status.textContent = `Could not load library: ${error.message}`; }
  finally { loading = false; }
}
cancel.onclick = async () => { try { const result = await chrome.runtime.sendMessage({ target: 'background', type: 'cancel' }); if (result?.error) throw new Error(result.error); status.textContent = 'Cancellation requested…'; } catch (error) { status.textContent = error.message; } };
chrome.storage.onChanged.addListener(render);
render();
setInterval(render, 5000);
