import { describe, expect, it } from "vitest";
import { captureCanUseResult, fingerprintCapturePayload, prepareCaptureSubmission } from "./captureSubmission";

describe("capture submission identity", () => {
  const original = fingerprintCapturePayload("task", { title: "Call mom", scheduledLocalDate: null });
  const changed = fingerprintCapturePayload("task", { title: "Call mom", scheduledLocalDate: "2026-10-03" });

  it("reuses an operation ID only for an identical retry", () => {
    const initial = { requestId: "request-1", lastSubmittedFingerprint: null, confirmedChangedFingerprint: null };
    const first = prepareCaptureSubmission(initial, original);
    expect(first.needsConfirmation).toBe(false);
    expect(first.identity.requestId).toBe("request-1");
    const retry = prepareCaptureSubmission(first.identity, original);
    expect(retry.needsConfirmation).toBe(false);
    expect(retry.identity.requestId).toBe("request-1");
  });

  it("requires explicit second action and a new ID when the submitted payload changed", () => {
    const prior = { requestId: "request-1", lastSubmittedFingerprint: original, confirmedChangedFingerprint: null };
    const warning = prepareCaptureSubmission(prior, changed);
    expect(warning.needsConfirmation).toBe(true);
    expect(warning.identity.requestId).toBe("request-1");
    const separate = prepareCaptureSubmission(warning.identity, changed);
    expect(separate.needsConfirmation).toBe(false);
    expect(separate.identity.requestId).not.toBe("request-1");
    expect(separate.identity.lastSubmittedFingerprint).toBe(changed);
    expect(prepareCaptureSubmission(warning.identity, original).identity.requestId).toBe("request-1");
  });

  it("includes capture kind and planning choice in payload identity", () => {
    expect(fingerprintCapturePayload("goal", { title: "Move" })).not.toBe(fingerprintCapturePayload("task", { title: "Move" }));
    expect(original).not.toBe(changed);
  });

  it("rejects late feedback from another account, superseded request, or unmounted capture", () => {
    expect(captureCanUseResult(true, 7, 7, "account-a:workspace", "account-a:workspace")).toBe(true);
    expect(captureCanUseResult(true, 7, 7, "account-b:workspace", "account-a:workspace")).toBe(false);
    expect(captureCanUseResult(true, 8, 7, "account-a:workspace", "account-a:workspace")).toBe(false);
    expect(captureCanUseResult(false, 7, 7, "account-a:workspace", "account-a:workspace")).toBe(false);
  });
});
