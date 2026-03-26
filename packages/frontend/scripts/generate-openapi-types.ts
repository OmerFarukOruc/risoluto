import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import openapiTS, { astToString } from "openapi-typescript";

const outputPath = path.resolve(import.meta.dirname, "../src/generated/openapi.ts");
const source = process.env.SYMPHONY_OPENAPI_URL ?? "http://127.0.0.1:4000/openapi.json";

async function main(): Promise<void> {
  const ast = await openapiTS(new URL(source), {
    alphabetize: true,
  });
  const generated = astToString(ast);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, generated, "utf8");
}

await main();
