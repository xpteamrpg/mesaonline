import { getMyTables } from "./lib/tables/myTables";
import { useEffect, useState } from "react";
import type { CharacterSheet } from "./types/sheet";
import { INITIAL_CHARACTERS } from "./data/characters";
import { T20Navbar } from "./components/layout/T20Navbar";
import { T20CharacterSheet } from "./components/sheet/T20CharacterSheet";
import { T20DiceTray, type RollEvent } from "./components/sheet/T20DiceTray";
import { JsonFeederModal } from "./components/sheet/JsonFeederModal";
import { EditCharacterModal } from "./components/sheet/EditCharacterModal";
import { PdfImportModal } from "./components/sheet/PdfImportModal";
import { CharacterBuilderWorkshop } from "./components/workshop/CharacterBuilderWorkshop";
import { CharactersListView } from "./components/views/CharactersListView";
import { CampaignsView, CompanionsView, type CampaignRecord, type Companion } from "./components/views/CampaignsView";
import { BestiaryView, BooksView, ClassesView, CompendiumView, EquipmentView, RacesView, SpellsView, type BookEntry } from "./components/views/CompendiumView";
import { VttImportModal } from "./components/sheet/VttImportModal";
import { AboutView, HomeView } from "./components/views/PortalViews";
import { OnlineTableView } from "./components/views/OnlineTableView";
import { HomebrewView } from "./components/views/HomebrewView";
import { CreateCharacterView, ReadyCharactersView } from "./components/views/CharacterCreateViews";
import { AccountOrders, AccountOverview, AccountProfile } from "./components/views/AccountViews";
import { SiteFooter } from "./components/layout/SiteFooter";
import { applyCampaignDraft, hasCampaignDraft, myTables } from "./lib/campaigns/client";
import { RequireLogin } from "./components/auth/RequireLogin";
import { classAbilitiesFor, recalc, uid } from "./lib/t20/sheetRules";
import { levelForXp } from "./lib/t20/xp";
import { VIEW_HASH, viewFromHash, type View } from "./types/view";
import { AuthProvider, useAuth } from "./lib/auth/AuthContext";
import { STORAGE_KEY, loadInitialCharacters, useAccountCharacters } from "./lib/characters/accountSync";
import { heroJsonToSheet, isHeroJson } from "./lib/pdf/heroJson";
import { isLegacyFicha, legacyFichaToSheet } from "./lib/pdf/legacyFicha";
import { shrinkDataUrl } from "./lib/imageFile";

const HASH = VIEW_HASH;

function usePersisted<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* storage cheio */
    }
  };
  return [value, set];
}

/** Garante que fichas vindas de JSON/versões antigas tenham todos os campos do modelo T20. */
function normalize(raw: Partial<CharacterSheet> & Record<string, unknown>): CharacterSheet | null {
  if (!raw || typeof raw !== "object" || !raw.name || !raw.attributes) return null;
  const base = INITIAL_CHARACTERS[0];
  const attrs = { ...base.attributes };
  for (const k of Object.keys(attrs) as (keyof typeof attrs)[]) {
    const a = (raw.attributes as Record<string, { value?: number; mod?: number }>)[k];
    const v = typeof a?.value === "number" ? (a.value >= 8 && "mod" in (a ?? {}) ? (a.mod as number) : a.value) : 0;
    attrs[k] = { ...attrs[k], value: v };
  }
  const xpRaw = raw.xp as unknown;
  const xp = typeof xpRaw === "number" ? xpRaw : typeof xpRaw === "object" && xpRaw ? Number((xpRaw as { current?: number }).current ?? 0) : 0;
  const s: CharacterSheet = {
    id: String(raw.id ?? uid("pj")),
    name: String(raw.name),
    avatar: raw.avatar as string | undefined,
    raceVariantId: typeof raw.raceVariantId === "string" ? raw.raceVariantId : undefined,
    avatarPos: typeof raw.avatarPos === "string" ? raw.avatarPos : undefined,
    race: String(raw.race ?? "Humano"),
    raceId: raw.raceId as string | undefined,
    class: String(raw.class ?? "Guerreiro"),
    classId: raw.classId as string | undefined,
    path: raw.path as string | undefined,
    origin: raw.origin as string | undefined,
    originId: raw.originId as string | undefined,
    deity: raw.deity as string | undefined,
    deityId: raw.deityId as string | undefined,
    level: Number(raw.level ?? 1) || 1,
    campaign: String(raw.campaign ?? "Campanha livre"),
    attributes: attrs,
    hp: { current: Number((raw.hp as { current?: number })?.current ?? 10), max: Number((raw.hp as { max?: number })?.max ?? 10) },
    mp: { current: Number((raw.mp as { current?: number })?.current ?? 0), max: Number((raw.mp as { max?: number })?.max ?? 0) },
    defenseOther: Number(raw.defenseOther ?? 0),
    defenseOtherTemp: Number(raw.defenseOtherTemp ?? 0),
    flySpeed: typeof raw.flySpeed === "number" ? raw.flySpeed : undefined,
    burrowSpeed: typeof raw.burrowSpeed === "number" ? raw.burrowSpeed : undefined,
    builder: raw.builder && typeof raw.builder === "object" ? (raw.builder as CharacterSheet["builder"]) : undefined,
    speed: Number(raw.speed ?? 9),
    skills: (raw.skills as CharacterSheet["skills"]) ?? {},
    attacks: Array.isArray(raw.attacks) ? (raw.attacks as CharacterSheet["attacks"]).filter((a) => a && a.name).map((a) => ({ ...a, id: a.id ?? uid("atk"), skill: a.skill === "Pontaria" ? "Pontaria" : "Luta", damage: a.damage ?? "1d4", critical: a.critical ?? "x2", damageType: a.damageType ?? "Impacto" })) : [],
    racialAbilities: (raw.racialAbilities as CharacterSheet["racialAbilities"]) ?? [],
    classAbilities: (raw.classAbilities as CharacterSheet["classAbilities"]) ?? [],
    powers: (raw.powers as CharacterSheet["powers"]) ?? [],
    spells: Array.isArray(raw.spells) ? (raw.spells as CharacterSheet["spells"]).map((sp) => ({ ...sp, cost: Number(sp.cost ?? 1), circle: Number(sp.circle ?? 1) })) : [],
    money: typeof raw.money === "number" ? raw.money : Number((raw.currency as { gold?: number })?.gold ?? 0),
    equipment: Array.isArray(raw.equipment) ? (raw.equipment as (CharacterSheet["equipment"][number] & { weight?: string; cost?: string })[]).map((e) => ({ id: e.id ?? uid("eq"), equipped: !!e.equipped, name: e.name, quantity: Number(e.quantity ?? 1), slots: typeof e.slots === "number" ? e.slots : parseFloat(String(e.weight ?? "1")) || 1, price: typeof e.price === "number" ? e.price : parseInt(String(e.cost ?? "")) || null, description: e.description ?? "", category: e.category ?? "Item Geral", defenseBonus: e.defenseBonus, armorPenalty: e.armorPenalty, source: e.source })) : [],
    languages: String(raw.languages ?? "Comum"),
    appearance: raw.appearance as string | undefined,
    personality: raw.personality as string | undefined,
    history: raw.history as string | undefined,
    xp,
    notes: String(raw.notes ?? ""),
    journal: Array.isArray(raw.journal) ? (raw.journal as CharacterSheet["journal"]) : undefined,
    createdAt: raw.createdAt as string | undefined,
    updatedAt: raw.updatedAt as string | undefined,
  };
  if (!s.classAbilities.length && s.classId) s.classAbilities = classAbilitiesFor(s.classId, undefined, s.level);
  return s;
}

export default function App() {
  return <AuthProvider><PortalApp /></AuthProvider>;
}

function PortalApp() {
  const { user, loading: authLoading } = useAuth();
  /** Nomes das mesas de que a pessoa participa (como mestre ou jogador, pela conta): entram na lista "Campanha" da ficha. */
  const [joinedTableNames, setJoinedTableNames] = useState<string[]>([]);
  useEffect(() => {
    if (!user) { setJoinedTableNames([]); return; }
    let alive = true;
    myTables().then((list) => { if (alive) setJoinedTableNames(list.map((entry) => entry.table.name).filter(Boolean)); }).catch(() => undefined);
    return () => { alive = false; };
  }, [user?.id]);
  const [characters, setCharacters] = useState<CharacterSheet[]>(loadInitialCharacters);
  const [activeId, setActiveId] = useState<string>(() => localStorage.getItem(STORAGE_KEY + ":active") || "");
  const sync = useAccountCharacters({ userId: user?.id ?? null, authLoading, characters, setCharacters });
  const [view, setView] = useState<View>(viewFromHash);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [vttOpen, setVttOpen] = useState(false);
  const [roll, setRoll] = useState<RollEvent | null>(null);
  const [campaigns, setCampaigns] = usePersisted<CampaignRecord[]>("tormenta20_online_campaigns_v1", []);
  const [books, setBooks] = usePersisted<BookEntry[]>("tormenta20_online_books_v1", []);
  const [companions, setCompanions] = usePersisted<Companion[]>("tormenta20_online_companions_v1", []);
  const rollDice = (label: string, formula: string) => setRoll({ label, formula });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(characters));
      localStorage.setItem(STORAGE_KEY + ":active", activeId || "");
    } catch {
      /* storage cheio */
    }
  }, [characters, activeId]);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (v: View) => {
    if (v === "workshop") setEditingId(null);
    setView(v);
    if (window.location.hash !== HASH[v]) window.location.hash = HASH[v];
  };

  const activeOrNone = characters.find((c) => c.id === activeId) ?? characters[0];
  /** Sem personagens, as janelas de importação ainda precisam de uma ficha-base; ela nunca aparece na lista. */
  const active = activeOrNone ?? INITIAL_CHARACTERS[0];
  // Campanhas do Portal, mesas criadas em Mesa online (campanha e one-shot) e as já usadas nas fichas.
  const campaignNames = [...new Set([...campaigns.map((c) => c.name), ...getMyTables().map((t) => t.name), ...joinedTableNames, ...characters.map((c) => c.campaign).filter(Boolean)])];

  const update = (s: CharacterSheet) => setCharacters((p) => p.map((c) => (c.id === s.id ? s : c)));
  /** Convites/códigos de campanha escolhidos na ficha só valem quando ela é salva. */
  const flushDraft = (s: CharacterSheet) => {
    if (!hasCampaignDraft()) return;
    void applyCampaignDraft(s).then((problems) => { if (problems.length) alert(["Alguns vínculos com mesas online não foram feitos:", ...problems].join("\n")); });
  };
  const add = (s: CharacterSheet) => {
    flushDraft(s);
    setCharacters((p) => [s, ...p.filter((c) => c.id !== s.id)]);
    setActiveId(s.id);
    navigate("sheet");
  };
  const startEdit = (id: string) => {
    setActiveId(id);
    navigate("workshop");
    setEditingId(id);
  };
  const finishEdit = (s: CharacterSheet) => {
    flushDraft(s);
    update(s);
    setActiveId(s.id);
    navigate("sheet");
  };
  const clone = (id: string) => {
    const src = characters.find((c) => c.id === id);
    if (!src) return;
    add({ ...JSON.parse(JSON.stringify(src)), id: uid("pj"), name: `${src.name} (cópia)` });
  };
  /** Copia um herói pronto para a conta (o retrato vira dado na própria ficha, para não depender do endereço do site). */
  const cloneReady = async (src: CharacterSheet) => {
    let avatar = src.avatar;
    try {
      const blob = await (await fetch(src.avatar as string)).blob();
      avatar = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error("avatar")); r.readAsDataURL(blob); });
    } catch { /* fica com o endereço do retrato */ }
    const now = new Date().toISOString();
    const copy: CharacterSheet = { ...JSON.parse(JSON.stringify(src)), id: uid("pj"), avatar, createdAt: now, updatedAt: now };
    setCharacters([copy, ...characters]);
    setActiveId(copy.id);
    navigate("characters");
  };
  const remove = (id: string) => {
    const rest = characters.filter((c) => c.id !== id);
    setCharacters(rest);
    if (activeId === id) setActiveId(rest[0]?.id ?? "");
  };
  const importJson = async (text: string) => {
    try {
      const parsed = JSON.parse(text);
      const list = (Array.isArray(parsed) ? parsed : [parsed]).map((x) => (isHeroJson(x) ? heroJsonToSheet(x) : isLegacyFicha(x) ? legacyFichaToSheet(x) : normalize(x))).filter((x): x is CharacterSheet => !!x);
      if (!list.length) throw new Error("nenhuma ficha válida encontrada.");
      // Retrato de vários MB dentro do JSON: reduz antes de guardar na ficha e na conta.
      await Promise.all(list.map(async (sheet) => { if (sheet.avatar?.startsWith("data:") && sheet.avatar.length > 300_000) sheet.avatar = await shrinkDataUrl(sheet.avatar); }));
      setCharacters((p) => [...list, ...p.filter((c) => !list.some((l) => l.id === c.id))]);
      setActiveId(list[0].id);
      navigate("sheet");
    } catch (e) {
      alert("Erro ao importar JSON: " + (e as Error).message);
    }
  };
  const importVtt = (chars: CharacterSheet[], camp?: CampaignRecord) => {
    if (chars.length) {
      setCharacters((p) => [...chars, ...p.filter((c) => !chars.some((l) => l.id === c.id))]);
      setActiveId(chars[0].id);
    }
    if (camp) {
      setCampaigns([...campaigns.filter((c) => c.name !== camp.name), { ...camp, encounters: [] }]);
      navigate("campaigns");
    } else if (chars.length) navigate("sheet");
  };
  const levelUp = () => {
    const target = Math.max(active.level + 1, levelForXp(active.xp));
    const next = recalc({ ...active, level: Math.min(20, target) });
    update({ ...next, hp: { ...next.hp, current: next.hp.max }, mp: { ...next.mp, current: next.mp.max } });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f2eb] text-[#2b261f]">
      <T20Navbar
        characters={characters}
        activeId={activeOrNone?.id ?? ""}
        view={view}
        onNavigate={navigate}
        onSelectCharacter={(id) => { setActiveId(id); navigate("sheet"); }}
        onOpenJson={() => setJsonOpen(true)}
        onOpenPdf={() => setPdfOpen(true)}
        onOpenVtt={() => setVttOpen(true)}
      />

      {user && sync.error && <div role="alert" className="no-print bg-[#fff0f0] px-4 py-2 text-center text-xs font-bold text-[#c92a2a]">Não foi possível sincronizar os personagens com a sua conta: {sync.error}</div>}
      {/* espaço fixo de 20 cm entre o fim do conteúdo e a faixa preta do rodapé, em todas as páginas (proposital: o rodapé só aparece rolando) */}
      <main className="flex-1 pb-[20cm]">
        {view === "home" && <HomeView characters={characters} onNavigate={navigate} />}
        {view === "about" && <AboutView onNavigate={navigate} />}
        {view === "sheet" && <RequireLogin what="a sua ficha">{!activeOrNone ? <NoCharacters loading={!!user && !sync.ready && !sync.error} onCreate={() => navigate("createChar")} /> : <T20CharacterSheet sheet={active} onUpdate={update} onRoll={setRoll} onEdit={() => startEdit(active.id)} onQuickEdit={() => setEditOpen(true)} onClone={() => clone(active.id)} onLevelUp={levelUp} />}</RequireLogin>}
        {view === "workshop" && <RequireLogin what="a Oficina de Heróis"><CharacterBuilderWorkshop key={editingId ?? "novo"} initial={characters.find((c) => c.id === editingId)} campaignNames={campaignNames} onFinish={editingId ? finishEdit : add} onCancel={() => navigate("sheet")} /></RequireLogin>}
        {view === "characters" && (
          <RequireLogin what="os seus personagens"><CharactersListView characters={characters} activeId={active.id} onSelect={(id) => { setActiveId(id); navigate("sheet"); }} onEdit={startEdit} onPdf={(id) => { setActiveId(id); navigate("sheet"); setTimeout(() => window.print(), 600); }} onOpenWorkshop={() => navigate("createChar")} onOpenJson={() => setJsonOpen(true)} onOpenPdf={() => setPdfOpen(true)} onOpenVtt={() => setVttOpen(true)} onClone={clone} onDelete={remove} onImportJson={importJson} /></RequireLogin>
        )}
        {view === "campaigns" && <RequireLogin what="as suas campanhas"><CampaignsView characters={characters} campaigns={campaigns} onChangeCampaigns={setCampaigns} onSelect={(id) => { setActiveId(id); navigate("sheet"); }} onOpenWorkshop={() => navigate("workshop")} onOpenVtt={() => setVttOpen(true)} onRoll={rollDice} /></RequireLogin>}
        {view === "createChar" && <CreateCharacterView onBlank={() => navigate("workshop")} onReady={() => navigate("readyChars")} />}
        {view === "readyChars" && <ReadyCharactersView onClone={cloneReady} />}
        {view === "account" && <AccountOverview onNavigate={navigate} />}
        {view === "accountProfile" && <AccountProfile onNavigate={navigate} />}
        {view === "accountOrders" && <AccountOrders onNavigate={navigate} />}
        {view === "online" && <OnlineTableView campaigns={campaigns} characters={characters} onOpenCharacter={(id) => { setActiveId(id); navigate("sheet"); }} onManageCampaigns={() => navigate("campaigns")} />}
        {view === "homebrew" && <HomebrewView onNavigate={navigate} />}
        {view === "companions" && <RequireLogin what="os seus parceiros"><CompanionsView companions={companions} characters={characters} onChange={setCompanions} /></RequireLogin>}
        {view === "compendium" && <CompendiumView onNavigate={navigate} />}
        {view === "books" && <BooksView books={books} onChange={setBooks} />}
        {view === "races" && <RacesView />}
        {view === "classes" && <ClassesView />}
        {view === "equipment" && <EquipmentView />}
        {view === "spells" && <SpellsView />}
        {view === "bestiary" && <BestiaryView onRoll={rollDice} />}
      </main>
      <SiteFooter />

      <T20DiceTray activeRoll={roll} onClear={() => setRoll(null)} />

      <JsonFeederModal key={jsonOpen ? active.id : "closed"} isOpen={jsonOpen} onClose={() => setJsonOpen(false)} current={active} all={characters} onImport={(list) => importJson(JSON.stringify(list))} />
      {editOpen && <EditCharacterModal campaignNames={campaignNames} isOpen onClose={() => setEditOpen(false)} current={active} onSave={(s) => { update(s); flushDraft(s); }} />}
      {pdfOpen && <PdfImportModal isOpen onClose={() => setPdfOpen(false)} current={active} onCreate={add} onMerge={update} />}
      {vttOpen && <VttImportModal isOpen onClose={() => setVttOpen(false)} onImport={importVtt} />}
    </div>
  );
}

function NoCharacters({ loading, onCreate }: { loading: boolean; onCreate: () => void }) {
  return (
    <div className="mx-auto max-w-xl p-6 sm:p-10">
      <div className="rounded-lg border border-[#ded7c6] bg-white p-8 text-center shadow-sm">
        <h1 className="font-serif text-2xl font-black text-[#b92b3a]">{loading ? "Carregando os seus personagens…" : "Você ainda não tem personagens"}</h1>
        {!loading && <button onClick={onCreate} className="mt-5 rounded bg-[#b92b3a] px-6 py-2.5 text-xs font-black uppercase text-white hover:bg-[#9c1f2d]">Criar personagem</button>}
      </div>
    </div>
  );
}
