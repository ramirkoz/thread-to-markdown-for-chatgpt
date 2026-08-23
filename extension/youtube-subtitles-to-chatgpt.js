'use strict';

(() => {
  const button = document.getElementById('send-youtube-subtitles-to-chatgpt');
  const heading = document.querySelector('[data-youtube-i18n="heading"]');
  const description = document.querySelector('[data-youtube-i18n="description"]');
  if (!button) return;

  const CHATGPT_ORIGIN = 'https://chatgpt.com/*';
  const MAX_HANDOFF_LENGTH = 30000;
  const MAX_TRANSCRIPT_LENGTH = 26000;
  let running = false;

  const uiLanguage = String(chrome.i18n.getUILanguage?.() || 'en').toLowerCase();
  const isUkrainian = uiLanguage.startsWith('uk');
  const text = isUkrainian ? {
    heading: 'Передати субтитри YouTube у ChatGPT',
    description: 'Субтитри відкритого відео буде зчитано локально та вставлено в новий чат без автоматичного надсилання.',
    button: 'Вставити субтитри YouTube',
    reading: 'Зчитуємо субтитри YouTube…',
    wrongPage: 'Відкрийте відео YouTube і повторіть спробу.',
    unavailable: 'Для цього відео не вдалося отримати субтитри.',
    opening: 'Відкриваємо новий чат ChatGPT…',
    permission: 'Не надано дозвіл на вставлення вмісту в ChatGPT.',
    composer: 'Не вдалося знайти поле повідомлення ChatGPT.',
    inserted: 'Субтитри вставлено в ChatGPT. Перевірте текст і надішліть вручну.',
    title: 'YouTube-відео',
    source: 'Джерело',
    language: 'Мова субтитрів',
    transcript: 'Субтитри',
    automatic: 'автоматичні',
    shortened: '[Субтитри скорочено відповідно до ліміту.]'
  } : {
    heading: 'Send YouTube subtitles to ChatGPT',
    description: 'Subtitles from the open video will be read locally and inserted into a new chat without being sent automatically.',
    button: 'Insert YouTube subtitles',
    reading: 'Reading YouTube subtitles…',
    wrongPage: 'Open a YouTube video and try again.',
    unavailable: 'Subtitles could not be obtained for this video.',
    opening: 'Opening a new ChatGPT chat…',
    permission: 'Permission to insert content into ChatGPT was not granted.',
    composer: 'The ChatGPT message field could not be found.',
    inserted: 'The subtitles were inserted into ChatGPT. Review them and send manually.',
    title: 'YouTube video',
    source: 'Source',
    language: 'Subtitle language',
    transcript: 'Subtitles',
    automatic: 'automatic',
    shortened: '[Subtitles were shortened to fit the limit.]'
  };

  if (heading) heading.textContent = text.heading;
  if (description) description.textContent = text.description;
  button.textContent = text.button;

  const showStatus = (message, className = '') => {
    if (typeof setStatus === 'function') setStatus(message, className);
  };

  button.addEventListener('click', () => {
    void sendYoutubeSubtitles();
  });

  async function sendYoutubeSubtitles() {
    if (running) return;
    running = true;
    button.disabled = true;
    showStatus(text.reading);

    try {
      const [sourceTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!sourceTab?.id || !isYoutubeVideoUrl(sourceTab.url || '')) {
        throw new Error(text.wrongPage);
      }

      const transcript = await readYoutubeTranscript(sourceTab.id);
      if (!transcript?.text) throw new Error(text.unavailable);

      const allowed = await chrome.permissions.request({ origins: [CHATGPT_ORIGIN] });
      if (!allowed) throw new Error(text.permission);

      const handoff = buildHandoffText(transcript, sourceTab.url || '');
      if (handoff.length > MAX_HANDOFF_LENGTH) throw new Error(text.unavailable);

      showStatus(text.opening);
      const response = await chrome.runtime.sendMessage({
        type: 'insert-selected-text',
        text: handoff
      });
      if (!response?.ok) throw new Error(response?.error || text.composer);

      showStatus(text.inserted, 'success');
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
      const youtubeHost = host === 'youtube.com' || host.endsWith('.youtube.com');
      return youtubeHost && (url.pathname === '/watch' || url.pathname.startsWith('/shorts/'));
    } catch {
      return false;
    }
  }

  async function readYoutubeTranscript(tabId) {
    const preferredLanguage = uiLanguage.split('-')[0] || 'en';
    try {
      const runs = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: extractYoutubeTranscript,
        args: [preferredLanguage, MAX_TRANSCRIPT_LENGTH]
      });
      return runs?.[0]?.result || null;
    } catch (error) {
      console.error('GPT Project & Memory Tools: YouTube subtitles could not be read.', error);
      throw new Error(text.unavailable);
    }
  }

  function buildHandoffText(result, sourceUrl) {
    const language = String(result.languageName || result.languageCode || '').trim();
    const automatic = result.automatic ? ` (${text.automatic})` : '';
    const languageLine = language ? `${text.language}: ${language}${automatic}\n` : '';
    const shortened = result.truncated ? `\n\n${text.shortened}` : '';

    return `${text.title}: ${String(result.title || '').trim()}\n${text.source}: ${sourceUrl}\n${languageLine}\n${text.transcript}:\n${String(result.text || '').trim()}${shortened}`;
  }

  async function extractYoutubeTranscript(preferredLanguage, maxLength) {
    const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const preferred = String(preferredLanguage || '').toLowerCase();
    const limit = Math.max(2000, Number(maxLength) || 26000);

    const currentVideoId = (() => {
      try {
        const url = new URL(location.href);
        if (url.pathname === '/watch') return String(url.searchParams.get('v') || '');
        if (url.pathname.startsWith('/shorts/')) return String(url.pathname.split('/')[2] || '');
      } catch {
        return '';
      }
      return '';
    })();

    const clipTranscript = (rawText) => {
      let transcript = String(rawText || '').trim();
      let truncated = false;
      if (transcript.length > limit) {
        const cut = transcript.slice(0, limit);
        const boundary = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf(' '));
        transcript = cut.slice(0, boundary > limit * 0.8 ? boundary : limit).trim();
        truncated = true;
      }
      return { transcript, truncated };
    };

    const pageTitle = () => normalize(
      document.querySelector('h1 yt-formatted-string')?.textContent ||
      document.querySelector('h1.ytd-watch-metadata')?.textContent ||
      document.title.replace(/\s*-\s*YouTube\s*$/i, '')
    );

    const transcriptFromDom = () => {
      const selectors = [
        'ytd-transcript-segment-renderer .segment-text',
        'ytd-transcript-segment-renderer yt-formatted-string.segment-text',
        '[target-id="engagement-panel-searchable-transcript"] .segment-text',
        'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"] .segment-text',
        'yt-formatted-string.segment-text'
      ];
      const nodes = [];
      for (const selector of selectors) {
        for (const node of document.querySelectorAll(selector)) {
          if (!nodes.includes(node)) nodes.push(node);
        }
      }
      const lines = [];
      for (const node of nodes) {
        const line = normalize(node.textContent);
        if (!line) continue;
        if (lines[lines.length - 1] !== line) lines.push(line);
      }
      return lines.join('\n').trim();
    };

    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };

    const clickTranscriptUi = async () => {
      const existing = transcriptFromDom();
      if (existing) return existing;

      const expandSelectors = [
        '#description-inline-expander #expand',
        'ytd-text-inline-expander #expand',
        'tp-yt-paper-button#expand',
        'button[aria-label*="more" i]'
      ];
      for (const selector of expandSelectors) {
        const expand = [...document.querySelectorAll(selector)].find(visible);
        if (expand) {
          try {
            expand.click();
            await wait(250);
          } catch {
            // Continue to transcript controls.
          }
          break;
        }
      }

      const transcriptPattern = /(show\s+transcript|transcript|показати\s+текст\s+відео|текст\s+відео|стенограм|розшифров|показать\s+расшифровку)/iu;
      const candidates = [
        ...document.querySelectorAll('button, [role="button"], yt-button-shape button, tp-yt-paper-button')
      ].filter((element) => {
        if (!visible(element)) return false;
        const label = normalize(`${element.textContent || ''} ${element.getAttribute('aria-label') || ''}`);
        return transcriptPattern.test(label);
      });

      if (candidates[0]) {
        try {
          candidates[0].click();
        } catch {
          return '';
        }
      }

      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const transcript = transcriptFromDom();
        if (transcript) return transcript;
        await wait(200);
      }
      return '';
    };

    const isCurrentPlayerResponse = (response) => {
      if (!response || typeof response !== 'object') return false;
      const responseVideoId = String(response?.videoDetails?.videoId || '');
      return !currentVideoId || !responseVideoId || responseVideoId === currentVideoId;
    };

    const findBalancedJson = (source, marker) => {
      const markerIndex = source.indexOf(marker);
      if (markerIndex < 0) return null;
      const start = source.indexOf('{', markerIndex + marker.length);
      if (start < 0) return null;
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let index = start; index < source.length; index += 1) {
        const char = source[index];
        if (inString) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === '"') inString = false;
          continue;
        }
        if (char === '"') {
          inString = true;
          continue;
        }
        if (char === '{') depth += 1;
        else if (char === '}') {
          depth -= 1;
          if (depth === 0) return source.slice(start, index + 1);
        }
      }
      return null;
    };

    const parsePlayerResponseFromHtml = (html) => {
      const markers = [
        'ytInitialPlayerResponse =',
        'var ytInitialPlayerResponse =',
        'window["ytInitialPlayerResponse"] =',
        'window.ytInitialPlayerResponse ='
      ];
      for (const marker of markers) {
        try {
          const json = findBalancedJson(html, marker);
          if (!json) continue;
          const parsed = JSON.parse(json);
          if (isCurrentPlayerResponse(parsed)) return parsed;
        } catch {
          // Try the next representation.
        }
      }
      return null;
    };

    const getPlayerResponse = async () => {
      const directCandidates = [];
      if (window.ytInitialPlayerResponse) directCandidates.push(window.ytInitialPlayerResponse);
      try {
        const raw = window.ytplayer?.config?.args?.raw_player_response ||
          window.ytplayer?.config?.args?.player_response;
        if (raw) directCandidates.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
      } catch {
        // Continue with fresh watch-page extraction.
      }

      for (const candidate of directCandidates) {
        const tracks = candidate?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (isCurrentPlayerResponse(candidate) && Array.isArray(tracks) && tracks.length) return candidate;
      }

      try {
        const freshResponse = await fetch(location.href, { credentials: 'include', cache: 'no-store' });
        if (freshResponse.ok) {
          const parsed = parsePlayerResponseFromHtml(await freshResponse.text());
          if (parsed) return parsed;
        }
      } catch {
        // DOM and timed-text fallbacks remain available.
      }
      return directCandidates.find(isCurrentPlayerResponse) || null;
    };

    const scoreTrack = (track) => {
      const code = String(track?.languageCode || track?.langCode || '').toLowerCase();
      let score = track?.kind === 'asr' ? 0 : 30;
      if (code === preferred) score += 100;
      else if (preferred && code.startsWith(`${preferred}-`)) score += 80;
      if (track?.isTranslatable) score += 2;
      return score;
    };

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

    const fetchTrackJson3 = async (track) => {
      if (!track?.baseUrl) return '';
      try {
        const captionUrl = new URL(track.baseUrl, location.origin);
        captionUrl.searchParams.set('fmt', 'json3');
        const response = await fetch(captionUrl.toString(), { credentials: 'include', cache: 'no-store' });
        if (!response.ok) return '';
        return parseJson3(await response.json());
      } catch {
        return '';
      }
    };

    const playerResponse = await getPlayerResponse();
    let tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    let track = Array.isArray(tracks) && tracks.length
      ? [...tracks].sort((a, b) => scoreTrack(b) - scoreTrack(a))[0]
      : null;
    let transcript = await fetchTrackJson3(track);

    if (!transcript && currentVideoId) {
      try {
        const listUrl = new URL('/api/timedtext', location.origin);
        listUrl.searchParams.set('type', 'list');
        listUrl.searchParams.set('v', currentVideoId);
        const listResponse = await fetch(listUrl.toString(), { credentials: 'include', cache: 'no-store' });
        if (listResponse.ok) {
          const xml = await listResponse.text();
          const documentXml = new DOMParser().parseFromString(xml, 'text/xml');
          const listedTracks = [...documentXml.querySelectorAll('track')].map((node) => ({
            languageCode: node.getAttribute('lang_code') || '',
            languageName: node.getAttribute('lang_translated') || node.getAttribute('name') || '',
            name: node.getAttribute('name') || '',
            kind: node.getAttribute('kind') || '',
            isTranslatable: true
          }));
          const fallbackTrack = listedTracks.sort((a, b) => scoreTrack(b) - scoreTrack(a))[0];
          if (fallbackTrack?.languageCode) {
            const captionUrl = new URL('/api/timedtext', location.origin);
            captionUrl.searchParams.set('v', currentVideoId);
            captionUrl.searchParams.set('lang', fallbackTrack.languageCode);
            captionUrl.searchParams.set('fmt', 'json3');
            if (fallbackTrack.name) captionUrl.searchParams.set('name', fallbackTrack.name);
            if (fallbackTrack.kind) captionUrl.searchParams.set('kind', fallbackTrack.kind);
            const captionResponse = await fetch(captionUrl.toString(), { credentials: 'include', cache: 'no-store' });
            if (captionResponse.ok) {
              transcript = parseJson3(await captionResponse.json());
              track = fallbackTrack;
            }
          }
        }
      } catch {
        // DOM fallback below remains available.
      }
    }

    if (!transcript) {
      transcript = transcriptFromDom() || await clickTranscriptUi();
      if (transcript) {
        const clipped = clipTranscript(transcript);
        return {
          title: pageTitle(),
          languageCode: '',
          languageName: '',
          automatic: false,
          text: clipped.transcript,
          truncated: clipped.truncated,
          source: 'youtube-transcript-panel'
        };
      }
    }

    if (!transcript) return { text: '' };

    const clipped = clipTranscript(transcript);
    const trackName = track?.languageName || track?.name?.simpleText ||
      (Array.isArray(track?.name?.runs) ? track.name.runs.map((run) => run?.text || '').join('') : '') ||
      track?.name || '';

    return {
      title: normalize(playerResponse?.videoDetails?.title || pageTitle()),
      languageCode: String(track?.languageCode || track?.langCode || ''),
      languageName: normalize(trackName),
      automatic: track?.kind === 'asr',
      text: clipped.transcript,
      truncated: clipped.truncated,
      source: 'youtube-caption-track'
    };
  }
})();
