/**
 * Unit tests for MainCompanyService
 * Tests main_companies CRUD and company_branches management.
 * All DB interactions are mocked — no real DB required.
 */

jest.mock("../../src/db/client");

import * as MainCompanyService from "../../src/services/main-company.service";
import { getPool } from "../../src/db/client";

const mockGetPool = getPool as jest.MockedFunction<typeof getPool>;

// ─── Mock Factories ───────────────────────────────────────────────────────────

function makeMockPool(
  rows: Record<string, unknown>[] = [],
  secondRows?: Record<string, unknown>[],
) {
  let callCount = 0;
  return {
    query: jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ rows });
      return Promise.resolve({ rows: secondRows ?? rows });
    }),
    connect: jest.fn(),
  } as unknown as ReturnType<typeof getPool>;
}

function makeMockClient(responses: { rows: Record<string, unknown>[] }[]) {
  let callCount = 0;
  const client = {
    query: jest.fn().mockImplementation(() => {
      const resp = responses[callCount] ?? { rows: [] };
      callCount++;
      return Promise.resolve(resp);
    }),
    release: jest.fn(),
  };
  return client;
}

function makeMainCompany(overrides = {}) {
  return {
    id: "mc-uuid-1",
    name: "FitSense Jakarta",
    slug: "fitsense-jakarta",
    address: null,
    phone: null,
    status: "active",
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeBranchCompany(overrides = {}) {
  return {
    id: "company-branch-uuid",
    name: "Cabang Sudirman",
    slug: "sudirman",
    address: null,
    phone: null,
    status: "active",
    ...overrides,
  };
}

function makeBranchMeta(overrides = {}) {
  return {
    display_name: null,
    contact_person: null,
    contact_email: null,
    notes: null,
    created_at: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── createMainCompany ────────────────────────────────────────────────────────

describe("MainCompanyService.createMainCompany", () => {
  it("returns mainCompany with id, name, slug, status on success", async () => {
    const fakeMainCompany = makeMainCompany();
    // First query: slug uniqueness check → empty
    // Second query: INSERT RETURNING
    mockGetPool.mockReturnValue(makeMockPool([], [fakeMainCompany]));

    const result = await MainCompanyService.createMainCompany({
      name: "FitSense Jakarta",
      slug: "fitsense-jakarta",
    });

    expect(result.id).toBe("mc-uuid-1");
    expect(result.name).toBe("FitSense Jakarta");
    expect(result.slug).toBe("fitsense-jakarta");
    expect(result.status).toBe("active");
  });

  it("throws 400 VALIDATION_ERROR for missing name", async () => {
    await expect(
      MainCompanyService.createMainCompany({ name: "", slug: "valid-slug" }),
    ).rejects.toMatchObject({ statusCode: 400, field: "name" });
  });

  it("throws 400 VALIDATION_ERROR for invalid slug format", async () => {
    await expect(
      MainCompanyService.createMainCompany({
        name: "FitSense",
        slug: "INVALID SLUG!",
      }),
    ).rejects.toMatchObject({ statusCode: 400, field: "slug" });
  });

  it("throws 409 SLUG_CONFLICT when slug already exists", async () => {
    const existingRow = [{ id: "existing-uuid" }];
    mockGetPool.mockReturnValue(makeMockPool(existingRow));

    await expect(
      MainCompanyService.createMainCompany({
        name: "FitSense",
        slug: "fitsense-jakarta",
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "SLUG_CONFLICT" });
  });

  it("trims and lowercases slug before validation and DB insert", async () => {
    const fakeMainCompany = makeMainCompany({ slug: "fitsense-jakarta" });
    // Query 1: slug uniqueness check → no conflict
    // Query 2: INSERT RETURNING
    mockGetPool.mockReturnValue(makeMockPool([], [fakeMainCompany]));

    const result = await MainCompanyService.createMainCompany({
      name: "FitSense",
      slug: "  FitSense-Jakarta  ", // uppercase + surrounding spaces
    });

    // Normalized slug must reach DB and be returned correctly
    expect(result.slug).toBe("fitsense-jakarta");
  });
});

// ─── listMainCompanies ────────────────────────────────────────────────────────

describe("MainCompanyService.listMainCompanies", () => {
  it("returns array of main companies", async () => {
    const fakeList = [makeMainCompany(), makeMainCompany({ id: "mc-uuid-2", slug: "fitsense-bandung" })];
    mockGetPool.mockReturnValue(makeMockPool(fakeList));

    const result = await MainCompanyService.listMainCompanies();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("mc-uuid-1");
  });

  it("excludes rows where deleted_at IS NOT NULL (verifies query)", async () => {
    const mockPool = makeMockPool([]);
    mockGetPool.mockReturnValue(mockPool);

    await MainCompanyService.listMainCompanies();

    const queryCall = (mockPool.query as jest.Mock).mock.calls[0][0] as string;
    expect(queryCall).toMatch(/deleted_at IS NULL/i);
  });
});

// ─── getMainCompany ───────────────────────────────────────────────────────────

describe("MainCompanyService.getMainCompany", () => {
  it("returns mainCompany for valid id", async () => {
    const fakeMainCompany = makeMainCompany();
    mockGetPool.mockReturnValue(makeMockPool([fakeMainCompany]));

    const result = await MainCompanyService.getMainCompany("mc-uuid-1");
    expect(result.id).toBe("mc-uuid-1");
  });

  it("throws 404 for non-existent id", async () => {
    mockGetPool.mockReturnValue(makeMockPool([]));

    await expect(
      MainCompanyService.getMainCompany("non-existent-uuid"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── updateMainCompany ────────────────────────────────────────────────────────

describe("MainCompanyService.updateMainCompany", () => {
  it("updates name and returns updated mainCompany", async () => {
    const existingRow = [{ id: "mc-uuid-1" }];
    const updatedRow = makeMainCompany({ name: "FitSense Baru" });
    // Query 1: existsCheck, Query 2: UPDATE RETURNING
    mockGetPool.mockReturnValue(makeMockPool(existingRow, [updatedRow]));

    const result = await MainCompanyService.updateMainCompany("mc-uuid-1", {
      name: "FitSense Baru",
    });
    expect(result.name).toBe("FitSense Baru");
  });

  it("throws 400 for invalid slug format", async () => {
    await expect(
      MainCompanyService.updateMainCompany("mc-uuid-1", { slug: "BAD SLUG!" }),
    ).rejects.toMatchObject({ statusCode: 400, field: "slug" });
  });

  it("throws 404 for non-existent mainCompanyId", async () => {
    mockGetPool.mockReturnValue(makeMockPool([]));

    await expect(
      MainCompanyService.updateMainCompany("non-existent", { name: "New Name" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 409 SLUG_CONFLICT on duplicate slug excluding own id", async () => {
    // Query 1: existsCheck → found
    // Query 2: slugCheck → slug taken by another
    const existingRow = [{ id: "mc-uuid-1" }];
    const slugConflict = [{ id: "mc-uuid-other" }];
    let callCount = 0;
    const mockPool = {
      query: jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve({ rows: existingRow });
        return Promise.resolve({ rows: slugConflict });
      }),
      connect: jest.fn(),
    } as unknown as ReturnType<typeof getPool>;
    mockGetPool.mockReturnValue(mockPool);

    await expect(
      MainCompanyService.updateMainCompany("mc-uuid-1", { slug: "taken-slug" }),
    ).rejects.toMatchObject({ statusCode: 409, code: "SLUG_CONFLICT" });
  });

  it("throws 400 if no fields provided", async () => {
    const existingRow = [{ id: "mc-uuid-1" }];
    mockGetPool.mockReturnValue(makeMockPool(existingRow));

    await expect(
      MainCompanyService.updateMainCompany("mc-uuid-1", {}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("trims and lowercases slug before validation and DB update", async () => {
    const existingRow = [{ id: "mc-uuid-1" }];
    const updatedRow = makeMainCompany({ slug: "new-slug" });
    let callCount = 0;
    const mockPool = {
      query: jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve({ rows: existingRow }); // existsCheck
        if (callCount === 2) return Promise.resolve({ rows: [] });          // slugCheck → no conflict
        return Promise.resolve({ rows: [updatedRow] });                     // UPDATE RETURNING
      }),
      connect: jest.fn(),
    } as unknown as ReturnType<typeof getPool>;
    mockGetPool.mockReturnValue(mockPool);

    const result = await MainCompanyService.updateMainCompany("mc-uuid-1", {
      slug: "  NEW-SLUG  ", // uppercase + surrounding spaces
    });

    expect(result.slug).toBe("new-slug");
  });
});

// ─── suspendMainCompany ───────────────────────────────────────────────────────

describe("MainCompanyService.suspendMainCompany", () => {
  it("resolves without error on valid mainCompanyId", async () => {
    mockGetPool.mockReturnValue(makeMockPool([{ id: "mc-uuid-1" }]));

    await expect(
      MainCompanyService.suspendMainCompany("mc-uuid-1"),
    ).resolves.toBeUndefined();
  });

  it("SQL sets status=suspended AND deleted_at on suspend", async () => {
    const mockPool = makeMockPool([{ id: "mc-uuid-1" }]);
    mockGetPool.mockReturnValue(mockPool);

    await MainCompanyService.suspendMainCompany("mc-uuid-1");

    const queryCall = (mockPool.query as jest.Mock).mock.calls[0][0] as string;
    expect(queryCall).toMatch(/status.*=.*'suspended'/i);
    expect(queryCall).toMatch(/deleted_at.*=.*NOW/i);
  });
});

// ─── createBranch ─────────────────────────────────────────────────────────────

describe("MainCompanyService.createBranch", () => {
  it("returns branch with companyId = companies.id on success", async () => {
    const branchCompany = makeBranchCompany();
    const branchMeta = makeBranchMeta();

    const mockClient = makeMockClient([
      { rows: [] },             // BEGIN
      { rows: [{ id: "mc-uuid-1" }] }, // main_company exists
      { rows: [] },             // slug check → no conflict
      { rows: [branchCompany] }, // INSERT companies
      { rows: [branchMeta] },   // INSERT company_branches
      { rows: [] },             // COMMIT
    ]);
    const mockPool = makeMockPool();
    (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
    mockGetPool.mockReturnValue(mockPool);

    const result = await MainCompanyService.createBranch("mc-uuid-1", {
      name: "Cabang Sudirman",
      slug: "sudirman",
    });

    expect(result.companyId).toBe("company-branch-uuid"); // companies.id
    expect(result.mainCompanyId).toBe("mc-uuid-1");
    expect(result.name).toBe("Cabang Sudirman");
    expect(result.slug).toBe("sudirman");
  });

  it("throws 400 for missing name", async () => {
    await expect(
      MainCompanyService.createBranch("mc-uuid-1", {
        name: "",
        slug: "sudirman",
      }),
    ).rejects.toMatchObject({ statusCode: 400, field: "name" });
  });

  it("throws 400 for invalid slug format", async () => {
    await expect(
      MainCompanyService.createBranch("mc-uuid-1", {
        name: "Branch",
        slug: "BAD SLUG",
      }),
    ).rejects.toMatchObject({ statusCode: 400, field: "slug" });
  });

  it("throws 404 if mainCompanyId does not exist", async () => {
    const mockClient = makeMockClient([
      { rows: [] }, // BEGIN
      { rows: [] }, // main_company check → empty = not found
    ]);
    const mockPool = makeMockPool();
    (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
    mockGetPool.mockReturnValue(mockPool);

    await expect(
      MainCompanyService.createBranch("non-existent", {
        name: "Branch",
        slug: "sudirman",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    // ROLLBACK must be called
    expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mockClient.release).toHaveBeenCalled();
  });

  it("throws 409 SLUG_CONFLICT if slug already exists in companies", async () => {
    const mockClient = makeMockClient([
      { rows: [] },                    // BEGIN
      { rows: [{ id: "mc-uuid-1" }] }, // main_company exists
      { rows: [{ id: "existing" }] },  // slug taken
    ]);
    const mockPool = makeMockPool();
    (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
    mockGetPool.mockReturnValue(mockPool);

    await expect(
      MainCompanyService.createBranch("mc-uuid-1", {
        name: "Branch",
        slug: "sudirman",
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "SLUG_CONFLICT" });

    expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mockClient.release).toHaveBeenCalled();
  });

  it("companyId in response is companies.id, never company_branches id", async () => {
    const EXPECTED_COMPANY_ID = "companies-uuid-abc";
    const branchCompany = makeBranchCompany({ id: EXPECTED_COMPANY_ID });
    const branchMeta = makeBranchMeta();

    const mockClient = makeMockClient([
      { rows: [] },
      { rows: [{ id: "mc-uuid-1" }] },
      { rows: [] },
      { rows: [branchCompany] },
      { rows: [branchMeta] },
      { rows: [] },
    ]);
    const mockPool = makeMockPool();
    (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
    mockGetPool.mockReturnValue(mockPool);

    const result = await MainCompanyService.createBranch("mc-uuid-1", {
      name: "Branch",
      slug: "sudirman",
    });

    expect(result.companyId).toBe(EXPECTED_COMPANY_ID);
    // Ensure no 'id' field leaks through as branch identity
    expect((result as unknown as Record<string, unknown>)["id"]).toBeUndefined();

  });
  it("rollbacks when company_branches INSERT fails", async () => {
    const branchCompany = makeBranchCompany();
    const mockClient = makeMockClient([
      { rows: [] },                    // BEGIN
      { rows: [{ id: "mc-uuid-1" }] }, // main_company exists
      { rows: [] },                    // slug ok
      { rows: [branchCompany] },       // INSERT companies succeeds
      // company_branches insert throws:
    ]);
    // Override 5th call to throw
    let callCount = 0;
    mockClient.query = jest.fn().mockImplementation((sql: string) => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ rows: [] });  // BEGIN
      if (callCount === 2) return Promise.resolve({ rows: [{ id: "mc-uuid-1" }] }); // mc check
      if (callCount === 3) return Promise.resolve({ rows: [] }); // slug ok
      if (callCount === 4) return Promise.resolve({ rows: [branchCompany] }); // INSERT companies
      if (callCount === 5) return Promise.reject(new Error("DB error: company_branches insert failed")); // INSERT branches fails
      if (sql === "ROLLBACK") return Promise.resolve({ rows: [] }); // ROLLBACK must succeed
      return Promise.resolve({ rows: [] });
    });

    const mockPool = makeMockPool();
    (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
    mockGetPool.mockReturnValue(mockPool);

    await expect(
      MainCompanyService.createBranch("mc-uuid-1", {
        name: "Branch",
        slug: "sudirman",
      }),
    ).rejects.toThrow("DB error: company_branches insert failed");

    // ROLLBACK and release must be called even on failure
    expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mockClient.release).toHaveBeenCalled();
  });

  it("trims and lowercases slug before validation and DB insert", async () => {
    const branchCompany = makeBranchCompany({ slug: "sudirman" });
    const branchMeta = makeBranchMeta();

    const mockClient = makeMockClient([
      { rows: [] },                    // BEGIN
      { rows: [{ id: "mc-uuid-1" }] }, // main_company exists
      { rows: [] },                    // slug check → no conflict
      { rows: [branchCompany] },       // INSERT companies
      { rows: [branchMeta] },          // INSERT company_branches
      { rows: [] },                    // COMMIT
    ]);
    const mockPool = makeMockPool();
    (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
    mockGetPool.mockReturnValue(mockPool);

    const result = await MainCompanyService.createBranch("mc-uuid-1", {
      name: "Cabang Sudirman",
      slug: "  SUDIRMAN  ", // uppercase + surrounding spaces
    });

    // Normalized slug reaches DB — slug uniqueness query must use lowercase
    const queries = (mockClient.query as jest.Mock).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    );
    const slugQueryArgs = (mockClient.query as jest.Mock).mock.calls
      .filter((c: unknown[]) => typeof c[0] === "string" && (c[0] as string).includes("WHERE slug"))
      .map((c: unknown[]) => c[1]);
    // Slug passed to the uniqueness check must be normalized
    expect(slugQueryArgs[0]).toContain("sudirman");
    expect(result.slug).toBe("sudirman");
    // Not uppercase in any query
    queries.forEach((q) => expect(q).not.toContain("SUDIRMAN"));
  });
});

describe("MainCompanyService.listBranches", () => {
  it("returns branches for valid mainCompanyId", async () => {
    const fakeBranches = [
      {
        companyId: "company-uuid-1",
        mainCompanyId: "mc-uuid-1",
        name: "Cabang Sudirman",
        slug: "sudirman",
        address: null,
        phone: null,
        status: "active",
        display_name: null,
        contact_person: null,
        contact_email: null,
        notes: null,
        created_at: new Date(),
      },
    ];
    // Query 1: mainCheck, Query 2: SELECT branches
    mockGetPool.mockReturnValue(makeMockPool([{ id: "mc-uuid-1" }], fakeBranches));

    const result = await MainCompanyService.listBranches("mc-uuid-1");
    expect(result).toHaveLength(1);
    expect(result[0].companyId).toBe("company-uuid-1");
  });

  it("throws 404 if mainCompanyId not found", async () => {
    mockGetPool.mockReturnValue(makeMockPool([]));

    await expect(
      MainCompanyService.listBranches("non-existent"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("returns empty array when parent has no branches", async () => {
    mockGetPool.mockReturnValue(makeMockPool([{ id: "mc-uuid-1" }], []));

    const result = await MainCompanyService.listBranches("mc-uuid-1");
    expect(result).toEqual([]);
  });
});

// ─── unlinkBranch ─────────────────────────────────────────────────────────────

describe("MainCompanyService.unlinkBranch", () => {
  it("resolves without error when branch link exists", async () => {
    mockGetPool.mockReturnValue(
      makeMockPool([{ company_id: "company-uuid-1" }]),
    );

    await expect(
      MainCompanyService.unlinkBranch("mc-uuid-1", "company-uuid-1"),
    ).resolves.toBeUndefined();
  });

  it("throws 404 if company_branches row does not exist for given ids", async () => {
    mockGetPool.mockReturnValue(makeMockPool([]));

    await expect(
      MainCompanyService.unlinkBranch("mc-uuid-1", "non-existent-company"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("does NOT delete the companies row — only company_branches row", async () => {
    const mockPool = makeMockPool([{ company_id: "company-uuid-1" }]);
    mockGetPool.mockReturnValue(mockPool);

    await MainCompanyService.unlinkBranch("mc-uuid-1", "company-uuid-1");

    const queryCall = (mockPool.query as jest.Mock).mock.calls[0][0] as string;
    // Must DELETE from company_branches, NOT from companies
    expect(queryCall).toMatch(/DELETE FROM company_branches/i);
    expect(queryCall).not.toMatch(/DELETE FROM companies/i);
  });
});
