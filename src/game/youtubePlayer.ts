/**
 * Música do YouTube no Jukebox (recuperado do legado: `_extrairYtId`,
 * `_carregarYtApi`, `_tocarYt`). Usa o player oficial embutido (IFrame API),
 * escondido: só o áudio importa. Precisa de internet e de o vídeo permitir
 * incorporação; qualquer falha vira "faixa parou", nunca um erro na mesa.
 */

const validId = (id: string | null | undefined) => (id && /^[\w-]{11}$/.test(id) ? id : null);

/** Extrai o id de um link do YouTube (watch, youtu.be, embed, shorts, live). */
export function extractYoutubeId(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^(www|m|music)\./, "");
    if (host === "youtu.be") return validId(parsed.pathname.slice(1).split("/")[0]);
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const fromQuery = validId(parsed.searchParams.get("v"));
      if (fromQuery) return fromQuery;
      return validId(parsed.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/)?.[1]);
    }
  } catch { /* não é um endereço */ }
  return null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<void> | null = null;

function loadApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Sem navegador."));
  if (window.YT?.Player) return Promise.resolve();
  if (!apiPromise) {
    apiPromise = new Promise<void>((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(); };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => { apiPromise = null; reject(new Error("YouTube indisponível.")); };
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

/** Motivo (em português) de um código de erro do player do YouTube. */
export function youtubeErrorText(code: number | undefined): string {
  if (code === 101 || code === 150) return "O dono deste vídeo não permite tocar fora do YouTube. Use outro link.";
  if (code === 100) return "Vídeo não encontrado ou privado.";
  if (code === 2 || code === 5) return "O link do YouTube não pôde ser lido.";
  return "O YouTube não conseguiu tocar este link.";
}

export interface YoutubeEvents {
  onEnded: () => void;
  onError: (message?: string) => void;
  onPlaying: (playing: boolean) => void;
}

/** Um player de YouTube por mesa: troca de faixa, play, pausa, volume e repetição. */
export class YoutubeTrack {
  private player: any = null;
  private starting: Promise<void> | null = null;
  private videoId = "";
  /** id que o player já carregou para tocar (cue sozinho não toca: o play usa loadVideoById) */
  private started = "";
  private volume = 0.4;
  private loop = true;

  constructor(private readonly events: YoutubeEvents) {}

  private ensure(id: string): Promise<void> {
    if (this.player) return Promise.resolve();
    if (!this.starting) {
      this.starting = loadApi().then(() => new Promise<void>((resolve) => {
        const host = document.createElement("div");
        host.setAttribute("aria-hidden", "true");
        // O YouTube só toca em player de pelo menos 200x200: fica fora da tela, não minúsculo.
        host.style.cssText = "position:fixed;left:-400px;bottom:0;width:200px;height:200px;pointer-events:none;overflow:hidden";
        const slot = document.createElement("div");
        host.appendChild(slot);
        document.body.appendChild(host);
        this.player = new window.YT.Player(slot, {
          width: "200", height: "200", videoId: this.videoId || id,
          playerVars: { controls: 0, disablekb: 1, playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => { this.player.setVolume(Math.round(this.volume * 100)); resolve(); },
            onStateChange: (event: { data: number }) => {
              if (event.data === 0) { // terminou
                if (this.loop) { this.player.seekTo(0); this.player.playVideo(); } else this.events.onEnded();
              } else if (event.data === 1) this.events.onPlaying(true);
              else if (event.data === 2) this.events.onPlaying(false);
            },
            onError: (event: { data: number }) => this.events.onError(youtubeErrorText(event?.data)),
          },
        });
      })).catch(() => { this.starting = null; this.events.onError(); });
    }
    return this.starting;
  }

  async load(id: string, volume: number, loop: boolean): Promise<void> {
    this.videoId = id; this.volume = volume; this.loop = loop;
    this.started = "";
    await this.ensure(id);
    try { this.player?.setVolume(Math.round(volume * 100)); } catch { /* player ainda subindo */ }
  }

  async play(): Promise<void> {
    await this.ensure(this.videoId);
    try {
      if (this.started !== this.videoId) { this.started = this.videoId; this.player?.loadVideoById(this.videoId); }
      else this.player?.playVideo();
    } catch { /* sem player */ }
  }
  pause(): void { try { this.player?.pauseVideo(); } catch { /* sem player */ } }
  stop(): void { this.started = ""; try { this.player?.stopVideo(); } catch { /* sem player */ } }
  setVolume(volume: number): void { this.volume = volume; try { this.player?.setVolume(Math.round(volume * 100)); } catch { /* sem player */ } }
  setLoop(loop: boolean): void { this.loop = loop; }
}
