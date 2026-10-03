# Security

Found a security problem in Frontier Lab Tycoon (the game, its Worker, the deploy, or this repo)? Please report it privately, not in a public issue or PR.

## How to report

Use GitHub's private vulnerability reporting: on this repo, open **Security → Report a vulnerability**. Only the maintainers see the report, and we can talk it through and fix it there before anything is public.

Please include:

- what you found and where (a URL, file or workflow);
- how to reproduce it;
- what an attacker could do with it.

We'll acknowledge it as soon as we can and keep you posted on the fix. Please give us a reasonable chance to ship that fix before you talk about it publicly.

## Scope

- **In scope:** the deployed game and its Worker (`worker/`), the infrastructure code (`infra/`), the GitHub Actions workflows (`.github/`), and mod loading (`?mod=` links, `src/mods/`).
- **Not security issues:** balance bugs, exploits that only affect your own save, and jokes that land badly. Open a normal issue for those.
