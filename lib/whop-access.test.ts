import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { persistWhopUserIdOnAccount } from "./whop-access";

describe("persistWhopUserIdOnAccount", () => {
  it("does not write when the account or Whop id is blank", async () => {
    assert.equal(await persistWhopUserIdOnAccount("", "user_whop"), false);
    assert.equal(await persistWhopUserIdOnAccount("user_local", "  "), false);
  });
});
