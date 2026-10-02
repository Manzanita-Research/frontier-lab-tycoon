import type { Player } from "./api";
import type { CloudActions, CloudVM } from "./cloud/controller";

/**
 * The sign-in's slot contract (FLT-67): what each skin's `AccountSkin` gets, shaped like a HUD slot (plain data plus
 * actions, no sim, no store). It lives beside the account code, not in `src/skins/types.ts`, because the whole account
 * UI is compiled out of builds without VITE_FLT_AUTH=on; when accounts are on for good it moves in as a real slot.
 */
export interface AccountVM {
  /** `loading` until the first session check answers. */
  status: "loading" | "guest" | "member";
  player: Player | null;
  /** Which window is up: log on (a guest), the player's own (a member), the delete confirm, or none. */
  open: null | "logon" | "member" | "delete";
  /** A request is in flight: disable the buttons. */
  busy: boolean;
  /** Something to tell the player in the open window, or null. */
  notice: string | null;
  /** The one-sentence privacy promise, shown wherever a player decides to log on. */
  privacy: string;
}

export interface AccountActions {
  open(which: "logon" | "member" | "delete"): void;
  close(): void;
  /** Off to Hugging Face and back. */
  logOn(): void;
  logOff(): void;
  /** Deletes the account and its cloud saves (after the skin has asked). */
  deleteAccount(): void;
}

export interface AccountSkinProps {
  vm: AccountVM;
  actions: AccountActions;
  /** Cloud saves (a member's): the ☁ slots in the Save window, uploads, and "Continue from the cloud". */
  cloud: CloudVM;
  cloudActions: CloudActions;
}
