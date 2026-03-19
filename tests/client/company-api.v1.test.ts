import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCompanyV1,
  updateCompanyV1,
} from "../../src/client/lib/http/company-api";

function mockJsonResponse(input: { body: unknown; status: number }): Response {
  return new Response(JSON.stringify(input.body), {
    status: input.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("company API client v1", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends update company requests with PUT and parses the response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();

        if (url === "/v1/companies" && method === "POST") {
          return mockJsonResponse({
            status: 201,
            body: {
              ok: true,
              company: {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                tenantId: "11111111-1111-4111-8111-111111111111",
                legalName: "Original AB",
                organizationNumber: "5561231234",
                defaultFiscalYearStart: "2025-01-01",
                defaultFiscalYearEnd: "2025-12-31",
                createdAt: "2026-03-05T10:00:00.000Z",
                updatedAt: "2026-03-05T10:00:00.000Z",
              },
            },
          });
        }

        if (
          url === "/v1/companies/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" &&
          method === "PUT"
        ) {
          return mockJsonResponse({
            status: 200,
            body: {
              ok: true,
              company: {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                tenantId: "11111111-1111-4111-8111-111111111111",
                legalName: "Updated AB",
                organizationNumber: "5569999999",
                defaultFiscalYearStart: "2025-01-01",
                defaultFiscalYearEnd: "2025-12-31",
                createdAt: "2026-03-05T10:00:00.000Z",
                updatedAt: "2026-03-05T10:05:00.000Z",
              },
            },
          });
        }

        return mockJsonResponse({
          status: 500,
          body: {
            ok: false,
            error: {
              code: "UNEXPECTED",
              message: "Unexpected call",
              user_message: "Unexpected call",
              context: {},
            },
          },
        });
      },
    );

    const created = await createCompanyV1({
      tenantId: "11111111-1111-4111-8111-111111111111",
      legalName: "Original AB",
      organizationNumber: "5561231234",
      defaultFiscalYearStart: "2025-01-01",
      defaultFiscalYearEnd: "2025-12-31",
    });
    expect(created.company.legalName).toBe("Original AB");

    const updated = await updateCompanyV1({
      tenantId: "11111111-1111-4111-8111-111111111111",
      companyId: created.company.id,
      legalName: "Updated AB",
      organizationNumber: "556999-9999",
    });

    expect(updated.company.legalName).toBe("Updated AB");
    expect(updated.company.organizationNumber).toBe("5569999999");
    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/companies/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      expect.objectContaining({
        method: "PUT",
      }),
    );
  });
});
