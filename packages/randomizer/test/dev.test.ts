import { spawn } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acquireLock,
  releaseLock,
  cleanupNextDir,
  buildPackage,
  FIXTURE_DIR,
  CLASS_MAP_FILE,
  NEXT_DIR,
} from "./utils";

describe("Dev Server Obfuscation", () => {
  let devProcess: ReturnType<typeof spawn> | null = null;
  const PORT = 3000;
  const BASE_URL = `http://localhost:${PORT}`;

  beforeAll(async () => {
    await buildPackage();
    await acquireLock();

    await cleanupNextDir();

    devProcess = spawn("pnpm", ["dev"], {
      cwd: FIXTURE_DIR,
      stdio: "pipe",
      env: {
        ...process.env,
        PORT: PORT.toString(),
      },
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        devProcess?.kill("SIGTERM");
        reject(new Error("Dev server failed to start within 60 seconds"));
      }, 60000);

      let serverReady = false;

      const checkServer = async () => {
        try {
          const response = await fetch(BASE_URL);
          if (response.ok) {
            serverReady = true;
            clearTimeout(timeout);
            setTimeout(resolve, 5000);
          }
        } catch {}
      };

      devProcess!.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();
        if (
          (output.includes("Ready") ||
            output.includes("started server") ||
            output.includes(`localhost:${PORT}`)) &&
          !serverReady
        ) {
          const interval = setInterval(async () => {
            if (serverReady) {
              clearInterval(interval);
              return;
            }
            await checkServer();
          }, 1000);
        }
      });

      devProcess!.stderr?.on("data", (data: Buffer) => {
        const output = data.toString();
        console.error(output);
      });

      devProcess!.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 120000);

  afterAll(async () => {
    try {
      if (devProcess) {
        await new Promise<void>((resolve) => {
          let resolved = false;
          const timeout = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              try {
                if (devProcess && !devProcess.killed) {
                  devProcess.kill("SIGKILL");
                }
              } catch (error) {}
              resolve();
            }
          }, 10000);

          const exitHandler = () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve();
            }
          };

          if (
            (devProcess as any).exitCode !== null ||
            (devProcess as any).signalCode !== null
          ) {
            exitHandler();
          } else {
            devProcess?.once("exit", exitHandler);
            try {
              devProcess?.kill("SIGTERM");
            } catch (error) {
              exitHandler();
            }
          }
        });
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      await cleanupNextDir();
    } finally {
      await releaseLock();
    }
  });

  it("should generate class-map.json file", async () => {
    expect(existsSync(CLASS_MAP_FILE)).toBe(true);
  });

  it("should obfuscate class names in class-map.json", () => {
    expect(existsSync(CLASS_MAP_FILE)).toBe(true);

    const classMapContent = readFileSync(CLASS_MAP_FILE, "utf-8");
    const classMap: { [key: string]: string } = JSON.parse(classMapContent);

    expect(Object.keys(classMap).length).toBeGreaterThan(0);

    for (const [original, obfuscated] of Object.entries(classMap)) {
      expect(original).not.toBe(obfuscated);
      expect(typeof obfuscated).toBe("string");
      expect(obfuscated.length).toBeGreaterThan(0);
      expect(obfuscated).toMatch(/^[a-zA-Z]+$/);
    }

    const expectedClasses = [
      "flex",
      "min-h-screen",
      "items-center",
      "justify-center",
      "bg-zinc-50",
    ];

    const hasExpectedClass = expectedClasses.some((cls) =>
      Object.keys(classMap).includes(cls),
    );
    expect(hasExpectedClass).toBe(true);
  });

  it("should serve obfuscated HTML", async () => {
    const response = await fetch(BASE_URL);
    expect(response.ok).toBe(true);

    const html = await response.text();

    if (existsSync(CLASS_MAP_FILE)) {
      const classMapContent = readFileSync(CLASS_MAP_FILE, "utf-8");
      const classMap = JSON.parse(classMapContent);

      const obfuscatedClasses = Object.values(classMap) as string[];
      const hasObfuscatedClass = obfuscatedClasses.some((obfClass) =>
        html.includes(obfClass),
      );

      expect(hasObfuscatedClass).toBe(true);

      const originalClasses = Object.keys(classMap);
      originalClasses.some((origClass) =>
        html.includes(`className="${origClass}"`),
      );
    }
  });

  it("should obfuscate CSS selectors in generated CSS", () => {
    if (!existsSync(CLASS_MAP_FILE)) {
      throw new Error("class-map.json not found");
    }

    const classMapContent = readFileSync(CLASS_MAP_FILE, "utf-8");
    const classMap = JSON.parse(classMapContent);
    const obfuscatedClasses = Object.values(classMap) as string[];

    const staticCssDir = path.join(NEXT_DIR, "/dev/static/css/app");
    if (existsSync(staticCssDir)) {
      const cssFiles = readdirSync(staticCssDir).filter((file) =>
        file.endsWith(".css"),
      );

      if (cssFiles.length > 0) {
        const cssFile = path.join(staticCssDir, cssFiles[0]);
        const cssContent = readFileSync(cssFile, "utf-8");

        const hasObfuscatedSelector = obfuscatedClasses.some((obfClass) =>
          cssContent.includes(`.${obfClass}`),
        );

        expect(hasObfuscatedSelector).toBe(true);

        const originalClasses = Object.keys(classMap);
        const sampleOriginalClasses = originalClasses.slice(0, 5);

        for (const origClass of sampleOriginalClasses) {
          const twSelector = `.${origClass
            .split("")
            .map((ch) => (/^[a-zA-Z0-9_-]$/.test(ch) ? ch : "\\" + ch))
            .join("")}`;
          const obfClass = classMap[origClass];

          if (cssContent.includes(`.${obfClass}`)) {
            expect(cssContent).not.toContain(twSelector);
          }
        }
      }
    }
  });
});
