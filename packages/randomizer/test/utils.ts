import { existsSync } from "fs";
import { promises as fs } from "fs";
import path from "path";

const FIXTURE_DIR = path.join(process.cwd(), "test/fixtures/next-webpack");
const NEXT_DIR = path.join(FIXTURE_DIR, ".next");
const CLASS_MAP_FILE = path.join(FIXTURE_DIR, ".next/class-map.json");
const LOCK_FILE = path.join(FIXTURE_DIR, ".test-lock");

/**
 * Check if a process with the given PID is still running
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: any) {
    return error.code !== "ESRCH";
  }
}

/**
 * Check if lock file exists and if it's from a dead process (stale lock)
 */
async function checkStaleLock(): Promise<boolean> {
  if (!existsSync(LOCK_FILE)) {
    return false; // No lock file, not stale
  }

  try {
    const lockContent = await fs.readFile(LOCK_FILE, "utf-8");
    const lockPid = parseInt(lockContent.trim(), 10);

    if (isNaN(lockPid)) {
      return true;
    }

    if (!isProcessAlive(lockPid)) {
      return true;
    }

    return false;
  } catch (error) {
    return true;
  }
}

/**
 * Remove stale lock file if it exists
 */
async function removeStaleLock(): Promise<void> {
  if (await checkStaleLock()) {
    try {
      await fs.unlink(LOCK_FILE);
      console.log("Removed stale lock file");
    } catch (error) {}
  }
}

/**
 * Acquire a test lock to prevent concurrent test execution
 */
export async function acquireLock(): Promise<void> {
  await removeStaleLock();

  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    await removeStaleLock();

    try {
      await fs.writeFile(LOCK_FILE, process.pid.toString(), { flag: "wx" });
      return;
    } catch (error: any) {
      if (error.code === "EEXIST") {
        if (await checkStaleLock()) {
          await removeStaleLock();
          continue;
        }
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        throw error;
      }
    }
  }

  throw new Error(
    `Failed to acquire test lock after ${maxAttempts} seconds. Another test may still be running.`,
  );
}

/**
 * Release the test lock
 */
export async function releaseLock(): Promise<void> {
  try {
    if (existsSync(LOCK_FILE)) {
      await fs.unlink(LOCK_FILE);
    }
  } catch (error) {
    console.warn("Failed to release lock:", error);
  }
}

/**
 * Wait for the lock to be released (for tests that need to wait for previous test)
 */
export async function waitForLockRelease(maxWaitSeconds = 60): Promise<void> {
  await removeStaleLock();

  let attempts = 0;
  const maxAttempts = maxWaitSeconds;

  while (attempts < maxAttempts) {
    if (!existsSync(LOCK_FILE)) {
      return;
    }

    if (await checkStaleLock()) {
      await removeStaleLock();
      return;
    }

    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (await checkStaleLock()) {
    await removeStaleLock();
    return;
  }

  throw new Error(
    `Lock not released after ${maxWaitSeconds} seconds. Previous test may have failed to clean up.`,
  );
}

/**
 * Clean up the .next directory with retries
 */
export async function cleanupNextDir(maxRetries = 10): Promise<void> {
  if (!existsSync(NEXT_DIR)) {
    return;
  }

  for (let i = 0; i < maxRetries; i++) {
    try {
      await fs.rm(NEXT_DIR, { recursive: true, force: true });
      if (!existsSync(NEXT_DIR)) {
        return; // Success
      }
    } catch (error: any) {
      if (i === maxRetries - 1) {
        console.warn(
          `Failed to clean up .next directory after ${maxRetries} attempts:`,
          error,
        );
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

/**
 * Clean up class-map.json file with retries
 */
export async function cleanupClassMap(maxRetries = 10): Promise<void> {
  if (!existsSync(CLASS_MAP_FILE)) {
    return;
  }

  for (let i = 0; i < maxRetries; i++) {
    try {
      await fs.unlink(CLASS_MAP_FILE);
      if (!existsSync(CLASS_MAP_FILE)) {
        return;
      }
    } catch (error: any) {
      if (i === maxRetries - 1) {
        console.warn(
          `Failed to clean up class-map.json after ${maxRetries} attempts:`,
          error,
        );
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

/**
 * Ensure all cleanup is complete - removes both .next and lock file
 */
export async function ensureCleanup(): Promise<void> {
  try {
    await cleanupNextDir();
    await cleanupClassMap();
    await releaseLock();
    await removeStaleLock();
  } catch (error) {
    console.warn("Cleanup warning:", error);
  }
}

export { FIXTURE_DIR, NEXT_DIR, CLASS_MAP_FILE };
