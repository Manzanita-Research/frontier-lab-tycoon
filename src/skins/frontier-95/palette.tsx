// FLT-94: "Facilities", the build palette. Every building the lab can put up, as a grid of tiles with the price, the
// upkeep and a plain line on what it is for; the path tool and the bulldozer on top; what is still locked at the bottom.
// It is an applet (Quick Launch, Start ▸ Facilities…), so building is two clicks away: open it, pick a tile. On a desktop
// it stays open while you build, the way a 1999 construction window did; on a phone it gets out of the way of the map.
import { useState, useSyncExternalStore } from "react";
import { door, facilityGroups } from "../kit";
import { useCoach, useT } from "../context";
import type { BuildItemVM, HudActions, HudVM } from "../../ui/hud/types";
import { Ico } from "./icons";
import { Win } from "./parts";
import { useStackWindow } from "./stack";

// The palette is the skin's own window (no other skin has one), so its open state lives here, shared by the Start menu,
// Quick Launch and the stack. A tiny store: the server snapshot is the same value, so the tests can open it.
let open = false;
const listeners = new Set<() => void>();
export const palette = {
  get: () => open,
  set(next: boolean) {
    if (open === next) return;
    open = next;
    for (const l of [...listeners]) l();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};
export const usePalette = () => useSyncExternalStore(palette.subscribe, palette.get, palette.get);

/** Open the palette (the coach's first step waits for the build panel, and this is one). */
export function openPalette(actions: HudActions) {
  palette.set(true);
  actions.buildPanel(true);
}

/** The window, while it is open. */
export function Facilities({ vm, actions }: { vm: HudVM; actions: HudActions }) {
  return usePalette() ? <Palette vm={vm} actions={actions} /> : null;
}

function Palette({ vm, actions }: { vm: HudVM; actions: HudActions }) {
  const t = useT();
  const coach = useCoach();
  const [folded, setFolded] = useState(false);
  const [hover, setHover] = useState<BuildItemVM | null>(null);
  useStackWindow("facilities", folded, setFolded);
  const items = vm.buildItems;
  const { tools, groups } = facilityGroups(items);
  const teasers = vm.progress.teasers;
  const phone = vm.layout.compact;
  const pick = (it: BuildItemVM) => {
    // Staff and the Senate are windows: open them, never shut them from here. A building toggles, as on the Start menu.
    if (!(it.panel && it.selected)) actions.place(it.kind);
    if (phone || it.panel) palette.set(false);
  };
  const tile = (it: BuildItemVM) => {
    const label = it.isBulldoze ? `${t("build.bulldoze")}…` : it.name;
    const price = it.free ? t("build.free") : it.priceText;
    return (
      <li key={it.kind}>
        <button
          type="button"
          className={`f95-ptile${it.selected ? " on" : ""}${it.isPath || it.isBulldoze ? " tool" : ""}`}
          {...coach.attrs(`build:${it.kind}`)}
          {...(it.kind === "staff" ? door("hire:*") : {})}
          aria-pressed={it.panel ? undefined : it.selected}
          disabled={!it.affordable && !it.selected}
          title={`${label} (${price})${it.does ? `: ${it.does}` : ""}`}
          onClick={() => pick(it)}
          onPointerEnter={(e) => e.pointerType === "mouse" && setHover(it)}
          onPointerLeave={() => setHover(null)}
        >
          <Ico name={it.kind} size={it.isPath || it.isBulldoze ? 20 : 32} />
          <b className="n">{label}</b>
          <span className={`p${it.free ? " free" : ""}`}>{price}</span>
          {!(it.isPath || it.isBulldoze) && (
            <>
              <small className="does">{it.does ?? it.blurb}</small>
              {it.upkeepText && <small className="up">{it.upkeepText}</small>}
              {it.built > 0 && <small className="built">×{it.built}</small>}
            </>
          )}
        </button>
      </li>
    );
  };
  const status = hover?.blurb ?? (vm.buildTip ? `${vm.buildTip.name}: ${vm.buildTip.text}` : "Pick a building, then click the map. Esc puts it down.");

  return (
    <Win
      className={`f95-palette${folded ? "" : " open"}`}
      place="facilities"
      title={t("build.facilities")}
      icon="build"
      label={t("build.facilities")}
      attrs={{ "data-anchor": "win:facilities", "data-coach-panel": "" }}
      onTitleClick={() => setFolded(!folded)}
      buttons={[
        { g: "min", label: folded ? "Restore" : "Minimize", onClick: () => setFolded(!folded) },
        { g: "close", label: "Close", onClick: () => palette.set(false) },
      ]}
    >
      {!folded && (
        <>
          <ul className="f95-tools" role="group" aria-label="Tools">
            {tools.map(tile)}
          </ul>
          <div className="f95-ptiles inset">
            {groups.map((g) => (
              <section key={g.id} aria-label={t(`build.group.${g.id}`)}>
                <h3>{t(`build.group.${g.id}`)}</h3>
                <ul>{g.items.map(tile)}</ul>
              </section>
            ))}
            {teasers.length > 0 && (
              <section aria-label={t("build.locked")} className="locked">
                <h3>{t("build.locked")}</h3>
                <ul>
                  {teasers.map((teaser, i) => (
                    <li key={`${teaser.label}-${i}`}>
                      <span className="f95-ptile locked" title={`${t("build.locked")}: ${teaser.hint}`}>
                        <Ico name="lock" size={32} />
                        <b className="n">{teaser.label}</b>
                        <small className="does">{teaser.hint}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <div className="f95-status">{status}</div>
        </>
      )}
    </Win>
  );
}
