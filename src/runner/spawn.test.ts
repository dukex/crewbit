import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quoteCmdArg } from "./spawn.js";

describe("quoteCmdArg", () => {
  it("quotes the empty string", () => {
    assert.equal(quoteCmdArg(""), '""');
  });

  it("leaves simple alphanumeric args untouched", () => {
    assert.equal(quoteCmdArg("/develop"), "/develop");
    assert.equal(quoteCmdArg("JIR-123"), "JIR-123");
    assert.equal(quoteCmdArg("--print"), "--print");
  });

  it("wraps args containing whitespace in double quotes", () => {
    assert.equal(quoteCmdArg("/develop JIR-1"), '"/develop JIR-1"');
    assert.equal(quoteCmdArg("hello\tworld"), '"hello\tworld"');
  });

  it("escapes embedded double quotes by doubling them", () => {
    assert.equal(quoteCmdArg('say "hi"'), '"say ""hi"""');
  });

  it("quotes args containing cmd.exe metacharacters", () => {
    assert.equal(quoteCmdArg("a&b"), '"a&b"');
    assert.equal(quoteCmdArg("a|b"), '"a|b"');
    assert.equal(quoteCmdArg("a>b"), '"a>b"');
    assert.equal(quoteCmdArg("a<b"), '"a<b"');
    assert.equal(quoteCmdArg("a^b"), '"a^b"');
    assert.equal(quoteCmdArg("(group)"), '"(group)"');
    assert.equal(quoteCmdArg("100%done"), '"100%done"');
    assert.equal(quoteCmdArg("hi!"), '"hi!"');
  });
});
