import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("manifest", () => {
  it("declara la app como instalable en modo standalone con el acento ember", () => {
    const result = manifest();

    expect(result.name).toBe("Fitness Coach");
    expect(result.start_url).toBe("/");
    expect(result.display).toBe("standalone");
    expect(result.theme_color).toBe("#d9622b");
    expect(result.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "512x512", type: "image/png" }),
      ]),
    );
  });
});
