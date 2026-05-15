import { execFile as execFileCb } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFile = promisify(execFileCb);
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("package bin", () => {
  it.skipIf(process.platform === "win32")(
    "resolves dist from the real package root when invoked through a symlink",
    async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "risoluto-package-bin-"));
      tempDirs.push(tempDir);

      const packageRoot = path.join(tempDir, "package");
      const packageBinDir = path.join(packageRoot, "bin");
      const packageDistDir = path.join(packageRoot, "dist", "cli");
      const symlinkBinDir = path.join(tempDir, ".bin");
      await mkdir(packageBinDir, { recursive: true });
      await mkdir(packageDistDir, { recursive: true });
      await mkdir(symlinkBinDir, { recursive: true });

      const wrapper = await readFile(path.resolve(import.meta.dirname, "../../bin/risoluto"), "utf8");
      const wrapperPath = path.join(packageBinDir, "risoluto");
      await writeFile(wrapperPath, wrapper, "utf8");
      await chmod(wrapperPath, 0o755);

      const outputPath = path.join(tempDir, "output.json");
      await writeFile(path.join(packageDistDir, "index.js"), makeFixtureEntrypoint(), "utf8");

      const symlinkPath = path.join(symlinkBinDir, "risoluto");
      await symlink("../package/bin/risoluto", symlinkPath);

      await execFile(symlinkPath, ["--sample", "value"], {
        cwd: tempDir,
        encoding: "utf8",
        env: { ...process.env, RISOLUTO_BIN_TEST_OUTPUT: outputPath },
      });

      const output = JSON.parse(await readFile(outputPath, "utf8"));
      expect(output).toEqual({
        argv: ["--sample", "value"],
        entrypoint: path.join(packageDistDir, "index.js"),
      });
    },
  );
});

function makeFixtureEntrypoint(): string {
  return [
    'const { writeFileSync } = require("node:fs");',
    "writeFileSync(",
    "  process.env.RISOLUTO_BIN_TEST_OUTPUT,",
    "  JSON.stringify({ argv: process.argv.slice(2), entrypoint: process.argv[1] }),",
    ");",
    "",
  ].join("\n");
}
