import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteAccount, getPlayer, logOff, logOn, takeReturn } from "./api";
import type { AccountActions, AccountVM } from "./types";

export const PRIVACY =
  "We keep your Hugging Face id, name, username and avatar, and your cloud saves. No email, no tracking, no selling. Delete your account and it's all gone.";

/** The session and the account windows, for whichever skin is showing. */
export function useAccount(): { vm: AccountVM; actions: AccountActions } {
  const [vm, setVm] = useState<AccountVM>({ status: "loading", player: null, open: null, busy: false, notice: null, privacy: PRIVACY });
  const patch = useCallback((next: Partial<AccountVM>) => setVm((v) => ({ ...v, ...next })), []);

  useEffect(() => {
    // Coming back from Hugging Face: welcome the player in (their own window), or say it didn't work.
    const back = takeReturn();
    void getPlayer().then((player) => {
      const member = player !== null;
      patch({
        status: member ? "member" : "guest",
        player,
        open: back === "ok" && member ? "member" : back ? "logon" : null,
        notice: back === "failed" || (back === "ok" && !member) ? "Hugging Face didn't log you on. Nothing was saved; try again?" : null,
      });
    });
  }, [patch]);

  const actions = useMemo<AccountActions>(
    () => ({
      open: (which) => patch({ open: which, notice: null }),
      close: () => patch({ open: null, notice: null, busy: false }),
      logOn: () => {
        patch({ busy: true, notice: null });
        void logOn().then((notice) => notice && patch({ busy: false, notice }));
      },
      logOff: () => {
        patch({ busy: true, notice: null });
        void logOff().then((ok) =>
          patch(ok ? { busy: false, status: "guest", player: null, open: null } : { busy: false, notice: "Couldn't log off. Try again?" }),
        );
      },
      deleteAccount: () => {
        patch({ busy: true, notice: null });
        void deleteAccount().then((result) =>
          patch(
            result === "deleted"
              ? { busy: false, status: "guest", player: null, open: null }
              : {
                  busy: false,
                  open: "member",
                  notice:
                    result === "stale"
                      ? "For safety, deleting needs a fresh log-on. Log off, log on again, then delete."
                      : "Couldn't delete the account. Nothing was removed; try again?",
                },
          ),
        );
      },
    }),
    [patch],
  );

  return { vm, actions };
}
