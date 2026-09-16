// Copies the MiracleGame ABI out of the Foundry build into packages/shared,
// as plain JSON and as an `as const` TypeScript module so viem can infer types.
// Run via `pnpm --filter @miracle/contracts abi` (which builds first).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const artifact = resolve(here, "../out/MiracleGame.sol/MiracleGame.json");
const target = resolve(here, "../../shared/src/abi");

const { abi } = JSON.parse(readFileSync(artifact, "utf8"));
const json = JSON.stringify(abi, null, 2);

mkdirSync(target, { recursive: true });
writeFileSync(resolve(target, "MiracleGame.json"), `${json}\n`);
writeFileSync(
  resolve(target, "MiracleGame.ts"),
  `// Generated from packages/contracts by scripts/export-abi.mjs — do not edit.\n` +
    `export const miracleGameAbi = ${json} as const;\n`,
);

console.log(`Wrote ${abi.length} ABI entries to ${target}`);
