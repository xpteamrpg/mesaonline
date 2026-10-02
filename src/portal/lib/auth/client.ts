/**
 * Cliente do backend opcional de contas/compartilhamento (ver server/).
 * O app continua funcionando 100% localmente sem esse servidor; estas
 * chamadas só são usadas quando o usuário decide entrar/criar conta.
 */
export interface AuthUser {
  id: string;
  email: string;
  /** apelido escolhido ao criar a conta */
  nickname?: string;
  /** e-mail já confirmado */
  confirmed?: boolean;
  /** perfil público (guardado nos dados da conta) */
  displayName?: string;
  handle?: string;
  bio?: string;
  newsletter?: boolean;
  createdAt?: string;
  /** formas de entrada ligadas à conta: "email", "google"... */
  providers?: Array<{ provider: string; email?: string }>;
}

export interface SharedCampaign {
  id: string;
  ownerId: string;
  isOwner: boolean;
  participants: string[];
  participantEmails: string[];
  data: Record<string, unknown>;
  updatedAt: string;
}

const TOKEN_KEY = "tormenta20_online_auth_token_v1";
const API_BASE = (import.meta.env?.VITE_API_BASE as string | undefined) || "http://localhost:4000";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* localStorage indisponível: sessão só dura a aba atual */
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error("Não foi possível falar com o servidor de contas. Ele está rodando (`npm run server`)?");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Erro ${res.status}`);
  return body as T;
}

export async function register(email: string, password: string): Promise<AuthUser> {
  const { token, user } = await request<{ token: string; user: AuthUser }>("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password }) });
  setToken(token);
  return user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const { token, user } = await request<{ token: string; user: AuthUser }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  setToken(token);
  return user;
}

export function logout() {
  setToken(null);
}

export async function fetchMe(): Promise<AuthUser | null> {
  if (!getToken()) return null;
  try {
    const { user } = await request<{ user: AuthUser }>("/api/auth/me");
    return user;
  } catch {
    setToken(null);
    return null;
  }
}

export async function listSharedCampaigns(): Promise<SharedCampaign[]> {
  const { campaigns } = await request<{ campaigns: SharedCampaign[] }>("/api/campaigns");
  return campaigns;
}

export async function createSharedCampaign(data: Record<string, unknown>): Promise<SharedCampaign> {
  const { campaign } = await request<{ campaign: SharedCampaign }>("/api/campaigns", { method: "POST", body: JSON.stringify({ data }) });
  return campaign;
}

export async function updateSharedCampaign(id: string, data: Record<string, unknown>): Promise<SharedCampaign> {
  const { campaign } = await request<{ campaign: SharedCampaign }>(`/api/campaigns/${id}`, { method: "PUT", body: JSON.stringify({ data }) });
  return campaign;
}

export async function shareCampaign(id: string, email: string): Promise<SharedCampaign> {
  const { campaign } = await request<{ campaign: SharedCampaign }>(`/api/campaigns/${id}/share`, { method: "POST", body: JSON.stringify({ email }) });
  return campaign;
}

export async function unshareCampaign(id: string, userId: string): Promise<SharedCampaign> {
  const { campaign } = await request<{ campaign: SharedCampaign }>(`/api/campaigns/${id}/unshare`, { method: "POST", body: JSON.stringify({ userId }) });
  return campaign;
}
