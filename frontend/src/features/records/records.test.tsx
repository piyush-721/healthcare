import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { authenticatedState, makeProfile, mockApi, renderWithStore } from "@/test/utils";

import { titleFromFilename, validateUploadFile } from "./constants";
import { DocumentUploadDialog } from "./DocumentUploadDialog";

const empty = { count: 0, next: null, previous: null, results: [] };

function bigFile(name: string, type: string, bytes: number): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

function renderDialog() {
  const calls = mockApi([
    { path: "/api/v1/profiles/", body: [makeProfile()] },
    { path: "/api/v1/records/", body: empty },
  ]);
  renderWithStore(<DocumentUploadDialog open onClose={() => {}} />, {
    preloadedState: authenticatedState(),
  });
  return calls;
}

describe("validateUploadFile", () => {
  it("accepts supported files and derives a title from the filename", () => {
    expect(
      validateUploadFile(new File(["%PDF"], "lab_report-march.pdf", { type: "application/pdf" })),
    ).toBeNull();
    expect(titleFromFilename("lab_report-march.pdf")).toBe("lab report march");
  });
});

describe("DocumentUploadDialog", () => {
  it("rejects an unsupported file type before uploading", async () => {
    const calls = renderDialog();
    const input = screen.getByLabelText(/^File/);
    fireEvent.change(input, {
      target: { files: [new File(["hi"], "notes.docx", { type: "application/msword" })] },
    });
    expect(await screen.findByText(/file type isn't supported/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(await screen.findByText(/file type isn't supported/i)).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("rejects a file larger than 15 MB", async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/^File/), {
      target: { files: [bigFile("scan.pdf", "application/pdf", 16 * 1024 * 1024)] },
    });
    expect(
      await screen.findByText("This file is 16.0 MB. The maximum size is 15 MB."),
    ).toBeInTheDocument();
  });

  it("fills the title from a valid file name", async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/^File/), {
      target: { files: [new File(["%PDF"], "blood_test.pdf", { type: "application/pdf" })] },
    });
    expect(await screen.findByDisplayValue("blood test")).toBeInTheDocument();
  });
});
