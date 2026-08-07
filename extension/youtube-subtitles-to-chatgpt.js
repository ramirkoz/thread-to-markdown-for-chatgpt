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
      console.error('Thread to Markdown: YouTube subtitles could not be read.', error);
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
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const playerResponse = window.ytInitialPlayerResponse || (() => {
      try {
        const raw = window.ytplayer?.config?.args?.player_response;
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {
        return null;
      }
    })();

    const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return { text: '' };
    }

    const preferred = String(preferredLanguage || '').toLowerCase();
    const scoreTrack = (track) => {
      const code = String(track?.languageCode || '').toLowerCase();
      let score = track?.kind === 'asr' ? 0 : 30;
      if (code === preferred) score += 100;
      else if (preferred && code.startsWith(`${preferred}-`)) score += 80;
      if (track?.isTranslatable) score += 2;
      return score;
    };

    const track = [...tracks].sort((a, b) => scoreTrack(b) - scoreTrack(a))[0];
    if (!track?.baseUrl) return { text: '' };

    const captionUrl = new URL(track.baseUrl);
    captionUrl.searchParams.set('fmt', 'json3');
    const response = await fetch(captionUrl.toString(), { credentials: 'include' });
    if (!response.ok) return { text: '' };

    const payload = await response.json();
    const lines = [];
    for (const event of Array.isArray(payload?.events) ? payload.events : []) {
      const segments = Array.isArray(event?.segs) ? event.segs : [];
      const line = normalize(segments.map((segment) => segment?.utf8 || '').join(''));
      if (!line || line === '\n') continue;
      if (lines[lines.length - 1] !== line) lines.push(line);
    }

    let transcript = lines.join('\n').trim();
    const limit = Math.max(2000, Number(maxLength) || 26000);
    let truncated = false;
    if (transcript.length > limit) {
      const cut = transcript.slice(0, limit);
      const boundary = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf(' '));
      transcript = cut.slice(0, boundary > limit * 0.8 ? boundary : limit).trim();
      truncated = true;
    }

    const trackName = track?.name?.simpleText ||
      (Array.isArray(track?.name?.runs) ? track.name.runs.map((run) => run?.text || '').join('') : '');
    const title = playerResponse?.videoDetails?.title ||
      document.querySelector('h1 yt-formatted-string')?.textContent ||
      document.title.replace(/\s*-\s*YouTube\s*$/i, '');

    return {
      title: normalize(title),
      languageCode: String(track.languageCode || ''),
      languageName: normalize(trackName),
      automatic: track.kind === 'asr',
      text: transcript,
      truncated
    };
  }
})();
