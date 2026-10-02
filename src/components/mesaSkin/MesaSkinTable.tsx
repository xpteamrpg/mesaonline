import { AnimatePresence, motion } from "framer-motion";
import { LINKS, type LinkMap } from "./config";
import type { View } from "./data";
import { LeftRail, TopBar } from "./components/Chrome";
import { MapArea } from "./components/MapArea";
import { CharacterSheet, CombatActions, InitiativePanel, RollTable } from "./components/Panels";
import { CornerMount } from "./components/ui";
import { SkinRuntimeContext, type SkinRuntime } from "./runtime";
import { withBase } from "../../utils/assetUrl";

export type MesaSkinTableProps = {
  /**
   * The visual source is controlled by the Mesa runtime, rather than keeping a
   * second, independent combat state inside the presentation layer.
   */
  view: View;
  onViewChange: (view: View) => void;
  /** Every source control resolves through the existing Mesa runtime. */
  onAction?: (id: string) => void;
  /** Logical map cell chosen on the supplied visual map. */
  onMapPoint?: (point: { x: number; y: number }) => void;
  /** The source page's optional link slots remain available to its host. */
  links?: Partial<LinkMap>;
  /** Estado real da mesa (BOARD/combatState) projetado para a máscara. */
  runtime: SkinRuntime;
};

/**
 * Literal visual source supplied for the online table.
 *
 * This file deliberately preserves the imported page's component tree and
 * Tailwind classes. The only adaptation is that its explore/combat switch is
 * driven by the application's existing runtime state, so it cannot create a
 * parallel game session.
 */
export default function MesaSkinTable({ view, onViewChange, links = {}, onAction = () => {}, onMapPoint, runtime }: MesaSkinTableProps) {
  const hrefs = { ...LINKS, ...links } as Record<string, string>;

  function handleNav(id: string) {
    onAction(id);
  }

  /** Botão "Combate" do cabeçalho: entra no combate; dentro dele vira "Encerrar combate". */
  function toggleCombat() {
    onViewChange(view === "explore" ? "combat" : "explore");
  }

  return (
    <SkinRuntimeContext.Provider value={runtime}>
    <div className="appearance-table relative flex min-h-screen w-full flex-col bg-[color:var(--mx-0b0706)] lg:h-screen lg:overflow-hidden" data-mesa-view={view}>
      <img className="mx-exp mx-dragon" src={withBase("/ui/expandido/dragao-canto.webp")} alt="" draggable={false} />
      {/* ormolu corner mounts of the imported console */}
      <div className="pointer-events-none absolute inset-0 z-50 hidden lg:block">
        <CornerMount className="absolute top-0 left-0" />
        <CornerMount className="absolute top-0 right-0" flip />
        <CornerMount className="absolute bottom-0 left-0" style={{ transform: "scaleY(-1)" }} />
        <CornerMount className="absolute right-0 bottom-0" flip style={{ transform: "scale(-1,-1)" }} />
      </div>

      <TopBar links={hrefs} onAction={onAction} view={view} onCombat={toggleCombat} />

      <div className="flex min-h-0 flex-1">
        <LeftRail links={hrefs} onNavigate={handleNav} />

        {/* mesinha de rolagem: abre entre a barra esquerda e o mapa e empurra o palco */}
        {runtime.dicePanel}

        <main className="flex min-w-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5 lg:overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              className="flex min-h-0 flex-1 flex-col gap-2.5 lg:flex-row"
            >
              {view === "explore" ? (
                <>
                  <MapArea mode="explore" links={hrefs} onAction={onAction} onMapPoint={onMapPoint} />
                  <CharacterSheet links={hrefs} onAction={onAction} />
                </>
              ) : (
                <>
                  {/* coluna do mapa: mapa + iniciativa em cima, Mesa de Rolagens só na largura deles */}
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5">
                    <div className="flex min-h-0 flex-1 flex-col gap-2.5 lg:flex-row">
                      <MapArea mode="combat" links={hrefs} onAction={onAction} onMapPoint={onMapPoint} />
                      <InitiativePanel links={hrefs} onAction={onAction} />
                    </div>
                    <RollTable links={hrefs} onAction={onAction} />
                  </div>
                  {/* painel do personagem: desce até o fim da tela */}
                  <CombatActions links={hrefs} onAction={onAction} />
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
    </SkinRuntimeContext.Provider>
  );
}
