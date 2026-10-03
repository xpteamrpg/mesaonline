import Peer, { type DataConnection, type PeerOptions } from "peerjs";
import type { MultiplayerState, RemoteCommandResult } from "./types";
import { forgetSession, masterPeerId, normalizeRoomCode, playerPeerIdFor, rememberSession } from "./peerIdentity";

export type RuntimeCommand = {
  name: string;
  args: unknown[];
  requestId: string;
};

export interface RuntimeCommandContext {
  /** Obtido da DataConnection no Mestre; nunca é aceito do payload do cliente. */
  peerId: string;
}

type RuntimeCommandResult = { requestId: string; ok: true } | { requestId: string; ok: false; error: string };

type WireMessage =
  | { type: "armada-runtime-state"; payload: unknown }
  | { type: "armada-runtime-command"; payload: RuntimeCommand }
  | { type: "armada-runtime-command-result"; payload: RuntimeCommandResult }
  | { type: "armada-signal"; payload: unknown }
  | { type: "armada-audio"; payload: unknown }
  | { type: "armada-kicked" };

type Handlers = {
  /** O Mestre pode redigir o snapshot de acordo com o peer destinatário. */
  getSnapshot: (recipientPeerId?: string) => unknown;
  applySnapshot: (snapshot: unknown) => void;
  runCommand: (command: RuntimeCommand, context: RuntimeCommandContext) => void;
  onState: (state: MultiplayerState) => void;
  /** Sinal efêmero (ping, faixa). No Mestre devolve se é válido e deve ser reenviado; no jogador só aplica. */
  onSignal?: (signal: unknown, fromMaster: boolean) => boolean;
  /** Sinais que o Mestre entrega a quem acabou de entrar (ex.: faixa tocando). */
  initialSignals?: () => unknown[];
  /** Jogador: recebeu um pedaço de áudio do Mestre. */
  onAudio?: (chunk: unknown) => void;
  /** Mestre: pedaços do áudio que está tocando, para quem acabou de entrar. */
  initialAudio?: () => Promise<unknown[]>;
};

declare global {
  interface Window {
    /** Endpoint alternativo usado por testes E2E; produção usa o PeerJS padrão. */
    __MODERNRPG_PEER_OPTIONS__?: PeerOptions;
  }
}

const INITIAL: MultiplayerState = {
  role: "local",
  status: "disconnected",
  roomCode: "",
  peerId: "",
  peers: [],
  commandLog: [],
};

/** Histórico durável de resultados; limitado para não crescer sem fim. */
const COMMAND_LOG_LIMIT = 50;
/** Reconexão rápida: o id persistido pode ainda estar registrado no servidor. */
const ID_RETRY_DELAYS_MS = [400, 900, 1800];
/** Religar o canal de dados com o Mestre depois de uma queda. */
const RECONNECT_DELAYS_MS = [400, 900, 1800, 3600];
const MASTER_ID_IN_USE = "Já existe um Mestre ativo com este código de sala. Feche a outra aba ou use outro código.";
const PLAYER_ID_IN_USE = "Esta mesa já está aberta em outra aba deste navegador. Feche a outra aba para reassumir seus personagens.";

type PeerFailure = Error & { type?: string };

/** Explica em português os erros mais comuns do PeerJS, mantendo o texto original no fim (ajuda a achar a causa). */
export function describePeerError(error: PeerFailure | { message?: string; type?: string }): string {
  const raw = String(error?.message || "").trim();
  const type = error?.type || "";
  let friendly = "";
  if (/negotiation of connection|ice|webrtc/i.test(raw) || type === "webrtc") friendly = "A conexão direta entre os dois computadores não fechou (rede, roteador ou firewall bloqueando). Tentem outra rede (por exemplo, o celular como roteador) ou desliguem VPN/antivírus.";
  else if (/could not connect to peer/i.test(raw) || type === "peer-unavailable") friendly = "Não encontrei a outra ponta da sala. Confira o código e se o Mestre já abriu a sala.";
  else if (type === "network" || /lost connection to server|network/i.test(raw)) friendly = "Sem acesso ao servidor que apresenta os jogadores ao Mestre (internet ou bloqueio).";
  else if (type === "server-error" || type === "socket-error" || type === "socket-closed") friendly = "O servidor que apresenta os jogadores ao Mestre está fora do ar ou bloqueado. Tente de novo em instantes.";
  return friendly ? `${friendly} (${raw || type})` : raw || type || "Erro de conexão.";
}

function createPeer(id: string): Peer {
  const options = typeof window !== "undefined" ? window.__MODERNRPG_PEER_OPTIONS__ : undefined;
  return options ? new Peer(id, options) : new Peer(id);
}

/**
 * Única conexão PeerJS do produto final. Componentes nunca instanciam Peer.
 * O mestre é autoritativo: jogadores enviam comandos; o mestre devolve BOARD,
 * SCENES e combatState no mesmo envelope.
 *
 * Identidade: o Mestre usa um id derivado do código da sala e o Jogador usa a
 * identidade persistida por `peerIdentity`. Com isso `controlledBy` sobrevive a
 * recargas — sem afrouxar nada: a autoridade continua vindo de `connection.peer`.
 */
export class ArmadaMultiplayer {
  private peer: Peer | null = null;
  private connections = new Map<string, DataConnection>();
  /** Peers expulsos pelo Mestre nesta sessão: se tentarem voltar, a conexão é fechada na hora. */
  private banned = new Set<string>();
  /** requestId → nome do comando, para rotular o resultado que voltar. */
  private pending = new Map<string, string>();
  private handlers: Handlers;
  private state: MultiplayerState = INITIAL;
  /** Saída pedida pelo usuário: impede que o religamento automático dispare. */
  private manualDisconnect = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(handlers: Handlers) {
    this.handlers = handlers;
  }

  snapshot(): MultiplayerState {
    return { ...this.state, peers: [...this.state.peers], commandLog: [...this.state.commandLog] };
  }

  /**
   * Último resultado devolvido pelo Mestre, opcionalmente filtrado por comando.
   * Diferente de `state.error` (transitório, zerado a cada novo comando), este
   * registro é acumulado e não é apagado pelo comando seguinte.
   */
  lastCommandResult(name?: string): RemoteCommandResult | null {
    for (let index = this.state.commandLog.length - 1; index >= 0; index -= 1) {
      const entry = this.state.commandLog[index];
      if (!name || entry.name === name) return { ...entry };
    }
    return null;
  }

  private setState(patch: Partial<MultiplayerState>) {
    this.state = { ...this.state, ...patch };
    this.handlers.onState(this.snapshot());
  }

  async host(preferredCode?: string): Promise<string> {
    this.teardown();
    this.banned.clear();
    const roomCode = normalizeRoomCode(preferredCode || randomCode());
    this.manualDisconnect = false;
    this.setState({ role: "master", status: "connecting", roomCode, peerId: "", peers: [], error: undefined, commandLog: [] });
    const peer = await this.openPeer(masterPeerId(roomCode), MASTER_ID_IN_USE);
    peer.on("connection", (connection) => this.acceptConnection(connection, true));
    this.setState({ status: "connected", peerId: peer.id, error: undefined });
    rememberSession({ role: "master", roomCode });
    return roomCode;
  }

  async join(code: string): Promise<void> {
    const roomCode = normalizeRoomCode(code);
    if (!roomCode) throw new Error("Informe o código da mesa.");
    this.teardown();
    this.manualDisconnect = false;
    // Identidade estável desta mesa: é o que mantém controlledBy válido após F5.
    const identity = playerPeerIdFor(roomCode);
    this.setState({ role: "player", status: "connecting", roomCode, peerId: "", peers: [], error: undefined, commandLog: [] });
    const peer = await this.openPeer(identity, PLAYER_ID_IN_USE);
    this.setState({ peerId: peer.id });
    await this.connectToMaster(peer, roomCode);
    rememberSession({ role: "player", roomCode });
  }

  /**
   * Abre o Peer com o id pedido. Se o id ainda estiver registrado no servidor
   * de sinalização (aba antiga fechando, reconexão rápida), espera e tenta
   * DE NOVO O MESMO ID — nunca troca por outro id permanente, porque isso
   * quebraria silenciosamente o vínculo de `controlledBy`.
   */
  private openPeer(id: string, inUseMessage: string): Promise<Peer> {
    return new Promise<Peer>((resolve, reject) => {
      const attempt = (index: number) => {
        if (this.manualDisconnect) {
          reject(new Error("Conexão cancelada."));
          return;
        }
        const peer = createPeer(id);
        this.peer = peer;
        let settled = false;
        peer.on("open", () => {
          settled = true;
          this.attachPeerLifecycle(peer);
          resolve(peer);
        });
        peer.on("error", (raw) => {
          const error = raw as PeerFailure;
          if (settled) {
            this.setState({ status: "error", error: describePeerError(error) });
            return;
          }
          if (error.type === "unavailable-id" && index < ID_RETRY_DELAYS_MS.length) {
            settled = true;
            peer.destroy();
            this.setState({ status: "reconnecting", error: undefined });
            setTimeout(() => attempt(index + 1), ID_RETRY_DELAYS_MS[index]);
            return;
          }
          settled = true;
          peer.destroy();
          if (this.peer === peer) this.peer = null;
          const failure = error.type === "unavailable-id" ? new Error(inUseMessage) : error;
          this.setState({ status: "error", error: failure.message });
          reject(failure);
        });
      };
      attempt(0);
    });
  }

  /** Queda do socket de sinalização: o PeerJS religa mantendo o mesmo id. */
  private attachPeerLifecycle(peer: Peer) {
    peer.on("disconnected", () => {
      if (this.manualDisconnect || peer.destroyed || this.peer !== peer) return;
      this.setState({ status: "reconnecting" });
      try { peer.reconnect(); } catch { /* destruído entre o evento e a chamada */ }
    });
  }

  private connectToMaster(peer: Peer, roomCode: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const onError = (raw: unknown) => {
        const error = raw as PeerFailure;
        if (error.type === "peer-unavailable") finish(new Error(`Nenhum Mestre encontrado na sala ${roomCode}.`));
      };
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        peer.off("error", onError as never);
        if (error) reject(error); else resolve();
      };
      const timer = setTimeout(() => finish(new Error("O Mestre desta sala não respondeu.")), 15_000);
      peer.on("error", onError as never);
      const connection = peer.connect(masterPeerId(roomCode), { reliable: true, serialization: "json" });
      this.acceptConnection(connection, false, () => finish());
    });
  }

  private acceptConnection(connection: DataConnection, master: boolean, onOpen?: () => void) {
    if (master && this.banned.has(connection.peer)) {
      connection.on("open", () => {
        try { connection.send({ type: "armada-kicked" } satisfies WireMessage); } catch { /* já fechada */ }
        setTimeout(() => { try { connection.close(); } catch { /* já fechada */ } }, 200);
      });
      return;
    }
    // Reconexão com a mesma identidade: a conexão nova substitui a antiga.
    const previous = this.connections.get(connection.peer);
    if (previous && previous !== connection) {
      try { previous.close(); } catch { /* já fechada */ }
    }
    this.connections.set(connection.peer, connection);
    connection.on("open", () => {
      this.connections.set(connection.peer, connection);
      this.reconnectAttempt = 0;
      this.setState({ status: "connected", error: undefined, peers: [...this.connections.keys()] });
      if (master) {
        this.sendState(connection);
        for (const signal of this.handlers.initialSignals?.() || []) connection.send({ type: "armada-signal", payload: signal } satisfies WireMessage);
        // Quem (re)entra pode ter perdido o arquivo: reenvia o áudio em uso.
        for (const peers of this.audioSent.values()) peers.delete(connection.peer);
        void this.sendInitialAudio(connection);
      }
      onOpen?.();
    });
    connection.on("data", (data) => this.receive(data as WireMessage, master, connection));
    connection.on("close", () => this.handleConnectionClosed(connection, master));
    connection.on("error", (error) => this.setState({ status: "error", error: describePeerError(error as PeerFailure) }));
  }

  /**
   * Nunca apaga `controlledBy`: o token continua do jogador que caiu, e a UI
   * do Mestre passa a mostrá-lo como "Offline" até ele voltar.
   */
  private handleConnectionClosed(connection: DataConnection, master: boolean) {
    // A conexão já pode ter sido substituída por uma reconexão do mesmo peer.
    if (this.connections.get(connection.peer) !== connection) return;
    this.connections.delete(connection.peer);
    this.setState({ peers: [...this.connections.keys()] });
    if (master || this.manualDisconnect || this.state.role !== "player") return;
    this.schedulePlayerReconnect();
  }

  /** Jogador removido pelo Mestre: sai da sala, esquece a sessão e não tenta reconectar. */
  private handleKicked() {
    this.teardown();
    forgetSession();
    this.setState({ status: "error", error: "Você foi removido da mesa pelo Mestre." });
  }

  /** Mestre: expulsa um jogador conectado. Ele é avisado, desconectado e não volta nesta sala enquanto o Mestre não a reabrir. */
  kick(peerId: string): boolean {
    if (this.state.role !== "master") return false;
    this.banned.add(peerId);
    const connection = this.connections.get(peerId);
    if (connection) {
      try { if (connection.open) connection.send({ type: "armada-kicked" } satisfies WireMessage); } catch { /* já fechada */ }
      setTimeout(() => { try { connection.close(); } catch { /* já fechada */ } }, 200);
      this.connections.delete(peerId);
      this.setState({ peers: [...this.connections.keys()] });
    }
    return true;
  }

  private schedulePlayerReconnect() {
    const peer = this.peer;
    if (!peer || peer.destroyed || this.manualDisconnect) return;
    if (this.reconnectAttempt >= RECONNECT_DELAYS_MS.length) {
      this.setState({ status: "error", error: "Conexão com o Mestre perdida. Entre novamente na sala." });
      return;
    }
    const delay = RECONNECT_DELAYS_MS[this.reconnectAttempt];
    const roomCode = this.state.roomCode;
    this.reconnectAttempt += 1;
    this.setState({ status: "reconnecting" });
    this.reconnectTimer = setTimeout(() => {
      if (this.manualDisconnect || !this.peer || this.peer.destroyed) return;
      // Mesmo peerId de sempre: o Mestre reconhece o jogador e o controlledBy
      // dos tokens continua valendo, sem reatribuição manual.
      this.connectToMaster(this.peer, roomCode).catch(() => this.schedulePlayerReconnect());
    }, delay);
  }

  private receive(message: WireMessage, master: boolean, connection: DataConnection) {
    if (!message || typeof message !== "object") return;
    if (message.type === "armada-runtime-command" && master) {
      let result: RuntimeCommandResult;
      try {
        this.handlers.runCommand(message.payload, { peerId: connection.peer });
        result = { requestId: message.payload.requestId, ok: true };
      } catch (error) {
        result = { requestId: message.payload.requestId, ok: false, error: (error as Error).message || "Comando recusado pelo Mestre." };
      }
      if (connection.open) connection.send({ type: "armada-runtime-command-result", payload: result } satisfies WireMessage);
      return;
    }
    if (message.type === "armada-kicked") {
      if (!master) this.handleKicked();
      return;
    }
    if (message.type === "armada-audio") {
      if (!master) this.handlers.onAudio?.(message.payload); // só o Mestre manda áudio
      return;
    }
    if (message.type === "armada-signal") {
      // Do jogador ao Mestre: valida (o peer vem da conexão) e reenvia aos demais.
      // Do Mestre ao jogador: só aplica.
      const accepted = this.handlers.onSignal?.(message.payload, !master);
      if (master && accepted) {
        for (const other of this.connections.values()) {
          if (other !== connection && other.open) other.send({ type: "armada-signal", payload: message.payload } satisfies WireMessage);
        }
      }
      return;
    }
    if (message.type === "armada-runtime-state" && !master) {
      this.handlers.applySnapshot(message.payload);
      return;
    }
    if (message.type === "armada-runtime-command-result" && !master) {
      this.recordCommandResult(message.payload);
    }
  }

  /** Grava no histórico durável e também no campo transitório usado pela UI. */
  private recordCommandResult(result: RuntimeCommandResult) {
    const name = this.pending.get(result.requestId) || "";
    this.pending.delete(result.requestId);
    const entry: RemoteCommandResult = {
      requestId: result.requestId,
      name,
      ok: result.ok,
      error: result.ok ? undefined : result.error,
      at: Date.now(),
    };
    this.setState({
      error: result.ok ? undefined : result.error,
      commandLog: [...this.state.commandLog, entry].slice(-COMMAND_LOG_LIMIT),
    });
  }

  request(name: string, ...args: unknown[]): boolean {
    if (this.state.role !== "player") return false;
    const connection = [...this.connections.values()][0];
    if (!connection?.open) throw new Error("A conexão com o mestre ainda não está pronta.");
    const command: RuntimeCommand = { name, args, requestId: crypto.randomUUID() };
    this.pending.set(command.requestId, name);
    // `error` é só o aviso visível na UI e some no próximo comando; o histórico
    // em `commandLog` é o registro estável de quem foi recusado e por quê.
    this.setState({ error: undefined });
    connection.send({ type: "armada-runtime-command", payload: command } satisfies WireMessage);
    return true;
  }

  /** Peers que já receberam cada áudio (id → peers), para não reenviar a cada play. */
  private audioSent = new Map<string, Set<string>>();

  /** Mestre: envia o áudio (em pedaços) a quem ainda não o tem. */
  async sendAudio(id: string, chunks: unknown[]): Promise<void> {
    if (this.state.role !== "master" || !chunks.length) return;
    const sent = this.audioSent.get(id) || new Set<string>();
    this.audioSent.set(id, sent);
    for (const connection of this.connections.values()) {
      if (!connection.open || sent.has(connection.peer)) continue;
      sent.add(connection.peer);
      await this.pushChunks(connection, chunks);
    }
  }

  private async pushChunks(connection: DataConnection, chunks: unknown[]): Promise<void> {
    for (let index = 0; index < chunks.length; index += 1) {
      if (!connection.open) return;
      connection.send({ type: "armada-audio", payload: chunks[index] } satisfies WireMessage);
      // Dá fôlego à conexão a cada punhado de pedaços (arquivos grandes).
      if (index % 40 === 39) await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  private async sendInitialAudio(connection: DataConnection): Promise<void> {
    const chunks = await this.handlers.initialAudio?.();
    if (!chunks?.length || !connection.open) return;
    const id = String((chunks[0] as { id?: string }).id || "");
    const sent = this.audioSent.get(id) || new Set<string>();
    this.audioSent.set(id, sent);
    sent.add(connection.peer);
    await this.pushChunks(connection, chunks);
  }

  /** Envia um sinal efêmero: o Mestre a todos, o jogador ao Mestre (que reenvia). */
  signal(payload: unknown): boolean {
    if (this.state.role === "local") return false;
    const message = { type: "armada-signal", payload } satisfies WireMessage;
    let sent = false;
    for (const connection of this.connections.values()) {
      if (connection.open) { connection.send(message); sent = true; }
    }
    return sent;
  }

  broadcast() {
    if (this.state.role !== "master") return;
    for (const connection of this.connections.values()) this.sendState(connection);
  }

  private sendState(connection: DataConnection) {
    if (!connection.open) return;
    // Não há snapshot "genérico" para jogadores: o Mestre entrega somente a
    // projeção autorizada para esta conexão (fog não é uma decisão de CSS).
    connection.send({ type: "armada-runtime-state", payload: this.handlers.getSnapshot(connection.peer) } satisfies WireMessage);
  }

  /** Fecha tudo sem tocar na identidade persistida da sala. */
  private teardown() {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempt = 0;
    for (const connection of this.connections.values()) {
      try { connection.close(); } catch { /* já fechada */ }
    }
    this.connections.clear();
    this.pending.clear();
    this.peer?.destroy();
    this.peer = null;
    this.state = INITIAL;
    this.handlers.onState(this.snapshot());
  }

  /**
   * Saída explícita da mesa. Esquece a sessão (não reconecta sozinho no próximo
   * carregamento) mas preserva a identidade da sala: se o jogador voltar, ele
   * volta como o mesmo peer e recupera os tokens que já eram dele.
   */
  disconnect() {
    this.teardown();
    forgetSession();
  }
}

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
