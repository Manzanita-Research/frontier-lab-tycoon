import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
writeFileSync("dist/deployment.json", `${JSON.stringify({ revision })}\n`);
