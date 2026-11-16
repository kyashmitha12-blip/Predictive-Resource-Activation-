import { describe, expect, it } from "vitest";
import { label, money, moneyPlain, pct } from "@/lib/format";

describe("format helpers", () => {
  it("shows free items as Free and others in rupees", () => { expect(money(0)).toBe("Free"); expect(money(1500)).toBe("₹1,500"); expect(moneyPlain(0)).toBe("₹0"); });
  it("formats percentages and missing values", () => { expect(pct(0.256)).toBe("26%"); expect(pct(null)).toBe("-"); });
  it("humanises status names", () => { expect(label("demo_paid")).toBe("Demo paid"); });
});
