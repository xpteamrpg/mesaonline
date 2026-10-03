/**
 * Apelido de quem está jogando, lido da sessão da conta (o Portal e a Mesa vivem na mesma origem). Sem conta, nada: o Mestre mostra "Jogador".
 * A sessão do Supabase fica em `sb-<projeto>-auth-token` (JSON com user.user_metadata.nickname).
 */
export function accountNickname(storage: Pick<Storage, "length" | "key" | "getItem"> = localStorage): string {
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key || !/^sb-.*-auth-token$/.test(key)) continue;
      const session = JSON.parse(storage.getItem(key) || "null");
      const user = session?.user ?? session?.currentSession?.user;
      const meta = user?.user_metadata;
      const nickname = typeof meta?.nickname === "string" ? meta.nickname.trim() : "";
      if (nickname) return nickname;
      if (typeof user?.email === "string" && user.email) return user.email.split("@")[0];
    }
  } catch { /* sem armazenamento ou sessão ilegível */ }
  return "";
}
