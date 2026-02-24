import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { useRequiredSessionPrincipalV1 } from "../../app/router";
import { toUserFacingErrorMessage } from "../../lib/http/api-client";
import {
  type CreateInviteResponseV1,
  createMagicLinkInviteV1,
} from "../../lib/http/auth-api";

async function copyTextV1(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function InvitePage() {
  const principal = useRequiredSessionPrincipalV1();
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [inviteeRole, setInviteeRole] = useState<"Admin" | "Editor">("Editor");
  const [copied, setCopied] = useState(false);

  const inviteMutation = useMutation({
    mutationFn: async () =>
      createMagicLinkInviteV1({
        tenantId: principal.tenantId,
        inviteeEmail,
        inviteeRole,
      }),
    onSuccess: () => {
      setCopied(false);
    },
  });

  if (principal.role !== "Admin") {
    return (
      <section className="card">
        <h1>Invite users</h1>
        <p className="error-text">
          Only Admin users can generate invite links.
        </p>
      </section>
    );
  }

  const inviteResult = inviteMutation.data as
    | CreateInviteResponseV1
    | undefined;

  return (
    <section className="panel-stack">
      <div className="card">
        <h1>Invite a teammate</h1>
        <p>Create a one-time magic link for this tenant.</p>

        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            inviteMutation.mutate();
          }}
        >
          <label>
            Invitee email
            <input
              type="email"
              value={inviteeEmail}
              onChange={(event) => setInviteeEmail(event.target.value)}
              required
              placeholder="name@firm.se"
            />
          </label>

          <label>
            Role
            <select
              value={inviteeRole}
              onChange={(event) =>
                setInviteeRole(event.target.value as "Admin" | "Editor")
              }
            >
              <option value="Editor">Editor</option>
              <option value="Admin">Admin</option>
            </select>
          </label>

          <button
            type="submit"
            className="primary"
            disabled={
              inviteMutation.isPending || inviteeEmail.trim().length === 0
            }
          >
            {inviteMutation.isPending
              ? "Generating..."
              : "Generate invite link"}
          </button>
        </form>
      </div>

      {inviteMutation.isError ? (
        <p className="error-text" role="alert">
          {toUserFacingErrorMessage(inviteMutation.error)}
        </p>
      ) : null}

      {inviteResult ? (
        <div className="card">
          <h2>Invite link ready</h2>
          <p>
            Expires at:{" "}
            {new Date(inviteResult.magicLinkExpiresAt).toLocaleString()}
          </p>
          <div className="link-row">
            <input type="text" readOnly value={inviteResult.magicLinkUrl} />
            <button
              type="button"
              className="secondary"
              onClick={async () => {
                const didCopy = await copyTextV1(inviteResult.magicLinkUrl);
                setCopied(didCopy);
              }}
            >
              Copy link
            </button>
          </div>
          {copied ? <p className="success-text">Copied to clipboard.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
