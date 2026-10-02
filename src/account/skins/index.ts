import type { ComponentType } from "react";
import type { AccountSkinProps } from "../types";
import { BaseAccount } from "./base";
import { Frontier95Account } from "./frontier-95";

/** Each skin's sign-in, by skin id; a skin without one gets the base chip. Add a skin's own here. */
export const ACCOUNT_SKINS: Record<string, ComponentType<AccountSkinProps>> = {
  "frontier-95": Frontier95Account,
};

export const accountSkin = (skin: string | undefined): ComponentType<AccountSkinProps> => (skin && ACCOUNT_SKINS[skin]) || BaseAccount;
