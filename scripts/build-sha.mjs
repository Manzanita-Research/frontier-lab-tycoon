// The build's commit, for the recovery toast's Copy details (FLT-84): git if there is one, else CI's, else "dev".
import { execSync } from "node:child_process";

export function buildSha() {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return process.env.GITHUB_SHA?.slice(0, 7) ?? "dev";
  }
}
