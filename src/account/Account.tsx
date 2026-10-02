import { useEffect, useState } from "react";
import { accountSkin } from "./skins";
import { useAccount } from "./useAccount";
import { useCloud } from "./useCloud";

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

/** Accounts (FLT-67): the session, the cloud saves, and the showing skin's way of offering them. */
export function Account() {
  const { vm, actions } = useAccount();
  const { cloud, cloudActions } = useCloud(vm.status === "member");
  // Back from Hugging Face with a newer lab in the cloud: that question is the welcome, not the account window.
  const offered = cloud.offerIn !== null;
  useEffect(() => {
    if (offered && vm.open === "member") actions.close();
  }, [offered, vm.open, actions]);
  const Skin = accountSkin(useSkinId());
  return <Skin vm={vm} actions={actions} cloud={cloud} cloudActions={cloudActions} />;
}
