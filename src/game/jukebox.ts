import { SYNTH_PREFIX, SYNTH_SFX, playSynth, synthIdFromUrl } from "./sfxSynth";
import { YoutubeTrack, extractYoutubeId } from "./youtubePlayer";
/**
 * JUKEBOX — player real de faixa e efeitos.
 *
 * Antes o painel tinha controles desabilitados e uma nota dizendo que o áudio
 * "permanece no módulo Jukebox do runtime VTT" — que não existe nesta Mesa.
 * Não havia campo de URL: pela interface não dava para tocar nada.
 *
 * Recuperado de `Vtt/app.js`: playAmbient, stopAmbient, playSfx, carregarMp3Local,
 * _carregarYtApi/_extrairYtId/_tocarYt (YouTube fica fora por ora — ver ressalva).
 */
export interface JukeboxState {
  url: string;
  title: string;
  playing: boolean;
  volume: number;
  loop: boolean;
  /** de onde vem o som: arquivo/URL de áudio ou vídeo do YouTube (só o áudio toca) */
  source: "audio" | "youtube";
  /** por que a faixa não toca (ex.: vídeo que não permite incorporação) */
  error?: string;
}

const LISTENERS = new Set<() => void>();
let element: HTMLAudioElement | null = null;
let state: JukeboxState = { url: "", title: "", playing: false, volume: 0.4, loop: true, source: "audio" };
let youtube: YoutubeTrack | null = null;

function yt(): YoutubeTrack {
  if (!youtube) {
    youtube = new YoutubeTrack({
      onEnded: () => { state = { ...state, playing: false }; emit(); },
      onError: (message) => { state = { ...state, playing: false, error: message || "O YouTube não conseguiu tocar este link." }; emit(); },
      onPlaying: (playing) => { if (state.source === "youtube" && state.playing !== playing) { state = { ...state, playing }; emit(); } },
    });
  }
  return youtube;
}

function emit() { for (const listener of LISTENERS) listener(); }

export function jukeboxState(): JukeboxState { return state; }

export function subscribeJukebox(listener: () => void): () => void {
  LISTENERS.add(listener);
  return () => { LISTENERS.delete(listener); };
}

function audio(): HTMLAudioElement | null {
  if (typeof document === "undefined") return null;
  if (!element) {
    element = document.createElement("audio");
    element.preload = "none";
    element.addEventListener("ended", () => { if (!state.loop) { state = { ...state, playing: false }; emit(); } });
    element.addEventListener("error", () => { state = { ...state, playing: false }; emit(); });
  }
  return element;
}

/** Extrai um título legível da URL, como o VTT antigo fazia com o nome do arquivo. */
export function titleFromUrl(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url, "http://local").pathname.split("/").pop() || "");
    return name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || "Faixa";
  } catch { return "Faixa"; }
}

export function loadTrack(url: string, title?: string): void {
  const player = audio();
  const videoId = extractYoutubeId(url);
  if (videoId) {
    // Link do YouTube: o áudio sai do player oficial escondido; o <audio> fica parado.
    try { player?.pause(); } catch { /* ambiente sem media (jsdom) */ }
    state = { ...state, url, title: title || "YouTube", playing: false, source: "youtube", error: undefined };
    void yt().load(videoId, state.volume, state.loop);
  } else {
    if (state.source === "youtube") yt().stop();
    state = { ...state, url, title: title || titleFromUrl(url), playing: false, source: "audio", error: undefined };
    if (player) { player.src = url; player.loop = state.loop; player.volume = state.volume; }
  }
  emit();
}

export async function playTrack(): Promise<void> {
  if (!state.url) return;
  if (state.source === "youtube") {
    await yt().play();
    state = { ...state, playing: true };
    emit();
    return;
  }
  const player = audio();
  if (!player) return;
  try { await player.play(); state = { ...state, playing: true }; }
  catch { state = { ...state, playing: false }; }
  emit();
}

export function pauseTrack(): void {
  if (state.source === "youtube") yt().pause();
  else { try { audio()?.pause(); } catch { /* ambiente sem media (jsdom) */ } }
  state = { ...state, playing: false };
  emit();
}

export function stopTrack(): void {
  if (state.source === "youtube") yt().stop();
  else {
    const player = audio();
    if (player) { try { player.pause(); } catch { /* ambiente sem media */ } player.currentTime = 0; }
  }
  state = { ...state, playing: false };
  emit();
}

export function setVolume(volume: number): void {
  const clamped = Math.min(1, Math.max(0, volume));
  state = { ...state, volume: clamped };
  const player = audio();
  if (player) player.volume = clamped;
  if (youtube) youtube.setVolume(clamped);
  emit();
}

export function setLoop(loop: boolean): void {
  state = { ...state, loop };
  const player = audio();
  if (player) player.loop = loop;
  if (youtube) youtube.setLoop(loop);
  emit();
}

/** Efeitos curtos do soundboard: tocam por cima da faixa, sem interromper. */
export function playSfx(url: string, volume = 0.7): void {
  const synth = synthIdFromUrl(url);
  if (synth) { playSynth(synth, volume); return; }
  if (typeof Audio === "undefined") return;
  try { const sfx = new Audio(url); sfx.volume = volume; void sfx.play(); } catch { /* silencioso */ }
}

/** Efeitos curtos que já vêm prontos (gerados no navegador, sem arquivos): plim, espada, porta abrindo... */
export const SOUNDBOARD: Array<{ id: string; label: string; url: string }> = SYNTH_SFX.map((entry) => ({
  id: entry.id, label: entry.label, url: `${SYNTH_PREFIX}${entry.id}`,
}));

/** Somente para teste: devolve o <audio> real. */
export function jukeboxElement(): HTMLAudioElement | null { return element; }
