import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("dependency boundaries", () => {
  it("passes the repository dependency boundary check", () => {
    const output = execFileSync("node", ["tools/check-dependencies.mjs"], {
      encoding: "utf8"
    });

    expect(output).toContain("passed");
  });
});
