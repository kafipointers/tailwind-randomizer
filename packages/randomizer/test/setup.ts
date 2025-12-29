import { ensureCleanup } from "./utils";

(async () => {
  try {
    await ensureCleanup();
  } catch (error) {}
})();
