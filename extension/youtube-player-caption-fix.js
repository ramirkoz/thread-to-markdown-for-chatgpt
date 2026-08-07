'use strict';

(() => {
  const button = document.getElementById('send-youtube-subtitles-to-chatgpt');
  if (!button) return;

  const CHATGPT_ORIGIN = 'https://chatgpt.com/*';
  const MAX_TRANSCRIPT_LENGTH = 26000;
  const MAX_HANDOFF_LENGTH = 30000;
  let running = false;

  const uiLanguage = String(chrome.i18n.getUILanguage?.() || 'en').toLowerCase();
  const isUkrainian = uiLanguage.startsWith('uk');
  const labels = isUkrainian ? {
    reading: 'Зчитуємо субтитри YouTube…',
    wrongPage: 'Відкрийте відео YouTube і повторіть спробу.',
    unavailable: 'Для цього відео не вдалося отримати субтитри.',
    permission: 'Не надано дозвіл на вставлення вмісту в ChatGPT.',
    opening: 'Відкриваємо новий чат ChatGPT…',
    composer: 'Не вдалося знайти поле повідомлення ChatGPT.',
    inserted: 'Субтитри вставлено в ChatGPT. Перевірте текст і надішліть вручну.',
    title: 'YouTube-відео',
    source: 'Джерело',
    language: 'Мова субтитрів',
    transcript: 'Субтитри',
    automatic: 'автоматичні',
    shortened: '[Субтитри скорочено відповідно до ліміту.]'
  } : {
    reading: 'Reading YouTube subtitles…',
    wrongPage: 'Open a YouTube video and try again.',
    unavailable: 'Subtitles could not be obtained for this video.',
    permission: 'Permission to insert content into ChatGPT was not granted.',
    opening: 'Opening a new ChatGPT chat…',
    composer: 'The ChatGPT message field could not be found.',
    inserted: 'The subtitles were inserted into ChatGPT. Review them and send manually.',
    title: 'YouTube video',
    source: 'Source',
    language: 'Subtitle language',
    transcript: 'Subtitles',
    automatic: 'automatic',
    shortened: '[Subtitles were shortened to fit the limit.]'
  };

  const showStatus = (message, className = '') => {
    if (typeof setStatus === 'function') setStatus(message, className);
  };

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    void sendYoutubeSubtitles();
  }, true);

  async function sendYoutubeSubtitles() {
    if (running) return;
    running = true;
    button.disabled = true;
    showStatus(labels.reading);

    try {
      const [sourceTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!sourceTab?.id || !isYoutubeVideoUrl(sourceTab.url || '')) {
        throw new Error(labels.wrongPage);
      }

      const preferredLanguage = uiLanguage.split('-')[0] || 'en';
      const runs = await chrome.scripting.executeScript({
        target: { tabId: sourceTab.id },
        world: 'MAIN',
        func: readActiveYoutubeCaptions,
        args: [preferredLanguage, MAX_TRANSCRIPT_LENGTH]
      });
      const result = runs?.[0]?.result;
      if (!result?.text) throw new Error(labels.unavailable);

      const allowed = await chrome.permissions.request({ origins: [CHATGPT_ORIGIN] });
      if (!allowed) throw new Error(labels.permission);

      const handoff = buildHandoffText(result, sourceTab.url || '');
      if (handoff.length > MAX_HANDOFF_LENGTH) throw new Error(labels.unavailable);

      showStatus(labels.opening);
      const response = await chrome.runtime.sendMessage({
        type: 'insert-selected-text',
        text: handoff
      });
      if (!response?.ok) throw new Error(response?.error || labels.composer);
      showStatus(labels.inserted, 'success');
    } catch (error) {
      showStatus(String(error?.message || error), 'error');
    } finally {
      running = false;
      button.disabled = false;
    }
  }

  function isYoutubeVideoUrl(value) {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      return (host === 'youtube.com' || host.endsWith('.youtube.com')) &&
        (url.pathname === '/watch' || url.pathname.startsWith('/shorts/'));
    } catch {
      return false;
    }
  }

  function buildHandoffText(result, sourceUrl) {
    const language = String(result.languageName || result.languageCode || '').trim();
    const automatic = result.automatic ? ` (${labels.automatic})` : '';
    const languageLine = language ? `${labels.language}: ${language}${automatic}\n` : '';
    const shortened = result.truncated ? `\n\n${labels.shortened}` : '';
    return `${labels.title}: ${String(result.title || '').trim()}\n${labels.source}: ${sourceUrl}\n${languageLine}\n${labels.transcript}:\n${String(result.text || '').trim()}${shortened}`;
  }

  async function readActiveYoutubeCaptions(preferredLanguage, maxLength) {
    const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const preferred = String(preferredLanguage || '').toLowerCase();
    const limit = Math.max(2000, Number(maxLength) || 26000);

    const currentVideoId = (() => {
      try {
        const url = new URL(location.href);
        if (url.pathname === '/watch') return String(url.searchParams.get('v') || '');
        if (url.pathname.startsWith('/shorts/')) return String(url.pathname.split('/')[2] || '');
      } catch {}
      return '';
    })();

    const pageTitle = () => normalize(
      document.querySelector('h1 yt-formatted-string')?.textContent ||
      document.querySelector('h1.ytd-watch-metadata')?.textContent ||
      document.title.replace(/\s*-\s*YouTube\s*$/i, '')
    );

    const clip = (raw) => {
      let value = String(raw || '').trim();
      let truncated = false;
      if (value.length > limit) {
        const cut = value.slice(0, limit);
        const boundary = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf(' '));
        value = cut.slice(0, boundary > limit * 0.8 ? boundary : limit).trim();
        truncated = true;
      }
      return { text: value, truncated };
    };

    const scoreTrack = (track) => {
      const code = String(track?.languageCode || track?.langCode || '').toLowerCase();
      let score = track?.kind === 'asr' ? 0 : 30;
      if (code === preferred) score += 100;
      else if (preferred && code.startsWith(`${preferred}-`)) score += 80;
      if (track?.isTranslatable) score += 2;
      return score;
    };

    const trackName = (track) => normalize(
      track?.languageName ||
      track?.name?.simpleText ||
      (Array.isArray(track?.name?.runs) ? track.name.runs.map((run) => run?.text || '').join('') : '') ||
      track?.displayName ||
      track?.name || ''
    );

    const parseJson3 = (payload) => {
      const lines = [];
      for (const event of Array.isArray(payload?.events) ? payload.events : []) {
        const segments = Array.isArray(event?.segs) ? event.segs : [];
        const line = normalize(segments.map((segment) => segment?.utf8 || '').join(''));
        if (!line || line === '\n') continue;
        if (lines[lines.length - 1] !== line) lines.push(line);
      }
      return lines.join('\n').trim();
    };

    const fetchTrack = async (track) => {
      if (!track?.baseUrl) return '';
      try {
        const url = new URL(track.baseUrl, location.origin);
        url.searchParams.set('fmt', 'json3');
        const response = await fetch(url.toString(), { credentials: 'include', cache: 'no-store' });
        if (!response.ok) return '';
        return parseJson3(await response.json());
      } catch {
        return '';
      }
    };

    const player = document.getElementById('movie_player');
    const responses = [];
    try {
      const response = player?.getPlayerResponse?.();
      if (response) responses.push(response);
    } catch {}
    if (window.ytInitialPlayerResponse) responses.push(window.ytInitialPlayerResponse);
    try {
      const raw = window.ytplayer?.config?.args?.raw_player_response || window.ytplayer?.config?.args?.player_response;
      if (raw) responses.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
    } catch {}

    let playerResponse = responses.find((response) => {
      const videoId = String(response?.videoDetails?.videoId || '');
      const tracks = response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      return (!currentVideoId || !videoId || videoId === currentVideoId) && Array.isArray(tracks) && tracks.length;
    }) || null;

    if (!playerResponse && currentVideoId) {
      try {
        const ytcfg = window.ytcfg;
        const apiKey = String(ytcfg?.get?.('INNERTUBE_API_KEY') || '');
        const clientVersion = String(ytcfg?.get?.('INNERTUBE_CLIENT_VERSION') || '');
        const clientNameRaw = ytcfg?.get?.('INNERTUBE_CLIENT_NAME');
        const clientName = typeof clientNameRaw === 'string' && clientNameRaw ? clientNameRaw : 'WEB';
        if (apiKey && clientVersion) {
          const endpoint = new URL('/youtubei/v1/player', location.origin);
          endpoint.searchParams.set('key', apiKey);
          endpoint.searchParams.set('prettyPrint', 'false');
          const response = await fetch(endpoint.toString(), {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              context: {
                client: {
                  clientName,
                  clientVersion,
                  hl: preferred || 'en',
                  gl: String(ytcfg?.get?.('GL') || 'US')
                }
              },
              videoId: currentVideoId,
              contentCheckOk: true,
              racyCheckOk: true
            })
          });
          if (response.ok) {
            const fresh = await response.json();
            const tracks = fresh?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (Array.isArray(tracks) && tracks.length) playerResponse = fresh;
          }
        }
      } catch {}
    }

    let tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    let track = Array.isArray(tracks) && tracks.length
      ? [...tracks].sort((a, b) => scoreTrack(b) - scoreTrack(a))[0]
      : null;
    let transcript = await fetchTrack(track);

    if (!transcript) {
      try {
        const playerTrackList = player?.getOption?.('captions', 'tracklist');
        const playerTrack = player?.getOption?.('captions', 'track');
        const fallbackTracks = [];
        if (Array.isArray(playerTrackList)) fallbackTracks.push(...playerTrackList);
        else if (Array.isArray(playerTrackList?.captionTracks)) fallbackTracks.push(...playerTrackList.captionTracks);
        if (playerTrack && typeof playerTrack === 'object') fallbackTracks.push(playerTrack);
        const candidate = fallbackTracks.sort((a, b) => scoreTrack(b) - scoreTrack(a))[0];
        if (candidate?.baseUrl) {
          transcript = await fetchTrack(candidate);
          if (transcript) track = candidate;
        }
      } catch {}
    }

    const domTranscript = () => {
      const selectors = [
        'ytd-transcript-segment-renderer .segment-text',
        'ytd-transcript-segment-renderer [class*="segment-text"]',
        'ytd-transcript-segment-renderer yt-formatted-string',
        '[target-id="engagement-panel-searchable-transcript"] ytd-transcript-segment-renderer',
        'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"] ytd-transcript-segment-renderer'
      ];
      const lines = [];
      const seen = new Set();
      for (const selector of selectors) {
        for (const node of document.querySelectorAll(selector)) {
          const line = normalize(node.textContent);
          if (!line || seen.has(line)) continue;
          seen.add(line);
          lines.push(line);
        }
        if (lines.length > 2) break;
      }
      return lines.join('\n').trim();
    };

    if (!transcript) {
      transcript = domTranscript();
      if (!transcript) {
        const pattern = /(show\s+transcript|transcript|показати\s+текст\s+відео|текст\s+відео|стенограм|розшифров|расшифров)/iu;
        const controls = [...document.querySelectorAll('button, [role="button"], ytd-button-renderer, tp-yt-paper-button')];
        const target = controls.find((element) => pattern.test(normalize(`${element.textContent || ''} ${element.getAttribute?.('aria-label') || ''}`)));
        try { target?.click?.(); } catch {}
        const deadline = Date.now() + 5000;
        while (!transcript && Date.now() < deadline) {
          await wait(200);
          transcript = domTranscript();
        }
      }
    }

    if (!transcript) return { text: '' };
    const clipped = clip(transcript);
    return {
      title: normalize(playerResponse?.videoDetails?.title || pageTitle()),
      languageCode: String(track?.languageCode || track?.langCode || ''),
      languageName: trackName(track),
      automatic: track?.kind === 'asr',
      text: clipped.text,
      truncated: clipped.truncated,
      source: track?.baseUrl ? 'player-caption-track' : 'youtube-transcript-panel'
    };
  }
})();
