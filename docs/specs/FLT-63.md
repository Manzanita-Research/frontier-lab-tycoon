# FLT-63: Placement modes (sticky path, one-shot buildings, Esc/right-click, hint) + Start menu (Facilities ▸ submenu, Run… opens widgets), all skins

_Copied from the task description (label: explore). Lead: thr_uzeftrbh67._

**Placement modes and the Start menu** (Jem's play-test, items 5 and 6). All six skins. These are UX/visible changes, so before/after screenshots are required.

**A. Placement modes: never get stuck.**
1. **Path tool is sticky:** it stays active after each tile, and dragging lays a run of tiles. It ends on Esc, right-click, clicking the tool again or picking another tool.
2. **Buildings drop out after one placement.** Optionally, holding Shift keeps placing (an RCT power-user nicety); say if you add it.
3. **Esc and right-click always cancel any mode.** They never open a context menu or deselect something else first.
4. **A small mode hint while a tool is active:** "Esc to stop building" (per-skin styling, near the cursor or the toolbar). On touch devices, show a visible **Done ✕** button instead, since there's no Esc or right-click.
5. **Edge cases:** a card, the coach, a window opening or a speed change never leaves a half-mode behind. The ghost preview and cursor always match the mode.

**B. Start menu (all skins):**
1. **Building types move out of the top level into a submenu** like Windows 95's "Programs". Call it **"Facilities ▸"** (a skin may use its own flavour word, with the same structure), grouped sensibly (compute, research, amenities, staff offices).
2. **The "Run…" equivalent opens UI widgets, not buildings:** the news ticker, stat panels (Lab Properties, Finance), Arena, Thoughts, Network Traffic, Discourse Monitor, Papers, Mods, Today's Drama. In Frontier 95, make it a real **Run dialog** you can type into ("thoughts.txt", "arena.exe") with a list below. Every skin gets an equivalent widget launcher.
3. **Coach steps and `data-coach` ids** that point into the menu keep working, and the stranger and journey e2e stay green.

**Evidence:**
- Before/after screenshots of each skin's Start menu (open with Facilities ▸ expanded) and the Run dialog.
- The path tool mid-run with the hint.
- The phone Done button.
- 1440×900 plus 390×844 for Frontier 95.

