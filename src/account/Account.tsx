import { useEffect, useState } from "react";
import { accountSkin } from "./skins";
import { useAccount } from "./useAccount";

/** The showing skin's id (`data-skin` on <html>, set by the skin registry), following a switch in Display settings. */
function useSkinId(): string | undefined {
  const [skin, setSkin] = useState(() => document.documentElement.dataset.skin);
  useEffect(() => {
    const watch = new MutationObserver(() => setSkin(document.documentElement.dataset.skin));
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-skin"] });
    return () => watch.disconnect();
  }, []);
  return skin;
}

/** Accounts (FLT-67): the session, and the showing skin's way of offering it. */
export function Account() {
  const { vm, actions } = useAccount();
  const Skin = accountSkin(useSkinId());
  return <Skin vm={vm} actions={actions} />;
}
