import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./Badge";

describe("Badge", () => {
  it("always renders its text label (status never relies on colour alone)", () => {
    render(<Badge tone="danger">Revoked</Badge>);
    expect(screen.getByText("Revoked")).toBeInTheDocument();
  });
});
