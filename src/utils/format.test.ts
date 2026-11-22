import { describe, expect, it } from "vitest";
import { formatINR } from "./format";

describe("formatINR", () => {
  it("uses Indian digit grouping for lakhs and crores", () => {
    expect(formatINR(125000)).toBe("₹1,25,000");
    expect(formatINR(1250000)).toBe("₹12,50,000");
    expect(formatINR(10000000)).toBe("₹1,00,00,000");
  });

  it("does not group amounts under 1,000", () => {
    expect(formatINR(999)).toBe("₹999");
    expect(formatINR(1000)).toBe("₹1,000");
  });

  it("formats zero", () => {
    expect(formatINR(0)).toBe("₹0");
  });

  it("formats negative values with the sign before the symbol", () => {
    expect(formatINR(-4500)).toBe("-₹4,500");
    expect(formatINR(-125000)).toBe("-₹1,25,000");
  });

  it("rounds to whole rupees", () => {
    expect(formatINR(1249.6)).toBe("₹1,250");
  });
});
