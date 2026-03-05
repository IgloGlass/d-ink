import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";

import { useRequiredSessionPrincipalV1 } from "../../app/session-context";
import { ButtonV1 } from "../../components/button-v1";
import { CardV1 } from "../../components/card-v1";
import { EmptyStateV1 } from "../../components/empty-state-v1";
import { InputV1 } from "../../components/input-v1";
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
  const inviteeEmailInputId = useId();
  const inviteeRoleSelectId = useId();

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
      <EmptyStateV1
        title="Invite users"
        description="Only Admin users can generate invite links."
        tone="error"
        role="alert"
      />
    );
  }

  const inviteResult = inviteMutation.data as
    | CreateInviteResponseV1
    | undefined;

  return (
    <section className="panel-stack">
      <CardV1>
        <h1>Invite a teammate</h1>
        <p>Create a one-time magic link for this tenant.</p>

        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            inviteMutation.mutate();
          }}
        >
          <label htmlFor={inviteeEmailInputId}>Invitee email</label>
          <InputV1
            id={inviteeEmailInputId}
            type="email"
            value={inviteeEmail}
            onChange={(event) => setInviteeEmail(event.target.value)}
            required
            placeholder="name@firm.se"
          />

          <label htmlFor={inviteeRoleSelectId}>Role</label>
          <select
            id={inviteeRoleSelectId}
            value={inviteeRole}
            onChange={(event) =>
              setInviteeRole(event.target.value as "Admin" | "Editor")
            }
          >
            <option value="Editor">Editor</option>
            <option value="Admin">Admin</option>
          </select>

          <ButtonV1
            type="submit"
            variant="primary"
            disabled={
              inviteMutation.isPending || inviteeEmail.trim().length === 0
            }
          >
            {inviteMutation.isPending
              ? "Generating..."
              : "Generate invite link"}
          </ButtonV1>
        </form>
      </CardV1>

      {inviteMutation.isError ? (
        <EmptyStateV1
          title="Invite generation failed"
          description={toUserFacingErrorMessage(inviteMutation.error)}
          tone="error"
          role="alert"
          action={
            <ButtonV1 onClick={() => inviteMutation.mutate()}>Retry</ButtonV1>
          }
        />
      ) : null}

      {inviteResult ? (
        <CardV1>
          <h2>Invite link ready</h2>
          <p>
            Expires at:{" "}
            {new Date(inviteResult.magicLinkExpiresAt).toLocaleString()}
          </p>
          <div className="link-row">
            <InputV1 type="text" readOnly value={inviteResult.magicLinkUrl} />
            <ButtonV1
              type="button"
              onClick={async () => {
                const didCopy = await copyTextV1(inviteResult.magicLinkUrl);
                setCopied(didCopy);
              }}
            >
              Copy link
            </ButtonV1>
          </div>
          {copied ? <p className="success-text">Copied to clipboard.</p> : null}
        </CardV1>
      ) : null}
    </section>
  );
}
