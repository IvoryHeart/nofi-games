import { describe, expect, it } from "vitest";
import { collectSecretValues, redactString, redactUnknown } from "../src/redaction.js";

describe("secret redaction", () => {
  it("collects only secret-bearing configured values", () => {
    expect(
      collectSecretValues({ OPENAI_API_KEY: "sk-canary", NODE_ENV: "test", SHORT_TOKEN: "abc" }),
    ).toEqual(["sk-canary"]);
  });

  it("redacts raw, encoded, base64, multiline, and substring values", () => {
    const secret = "line one\nline/two";
    const value = `before-${secret}-url=${encodeURIComponent(secret)}-b64=${Buffer.from(secret).toString("base64")}`;
    const redacted = redactString(value, [secret]);
    expect(redacted).not.toContain("line one");
    expect(redacted.match(/\[REDACTED\]/g)).toHaveLength(3);
  });

  it("redacts nested errors and objects", () => {
    const nested = new Error("outer token-value", { cause: new Error("inner token-value") });
    const redacted = JSON.stringify(
      redactUnknown({ nested, values: ["x-token-value-y"] }, ["token-value"]),
    );
    expect(redacted).not.toContain("token-value");
    expect(redacted).toContain("[REDACTED]");
  });
});
