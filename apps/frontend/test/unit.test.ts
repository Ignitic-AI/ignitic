import { describe, it, expect } from "vitest";
import { z } from "zod";
import { cn } from "@/lib/utils";

describe("unit smoke tests", () => {
  it("checks string length", () => {
    expect("hello".length).toBe(5);
  });

  it("checks boolean literal", () => {
    expect(true).toBe(true);
  });

  it("checks basic arithmetic", () => {
    expect(1 + 1).toBe(2);
  });

  it("merges class names with cn", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops undefined in cn", () => {
    expect(cn("base", undefined, "extra")).toBe("base extra");
  });

  it("compares arrays with toEqual", () => {
    expect([1, 2, 3]).toEqual([1, 2, 3]);
  });

  it("uses toContain on arrays", () => {
    expect(["x", "y", "z"]).toContain("y");
  });

  it("round-trips JSON", () => {
    const obj = { ok: true, n: 1 };
    expect(JSON.parse(JSON.stringify(obj))).toEqual(obj);
  });

  it("trims whitespace", () => {
    expect("  hi  ".trim()).toBe("hi");
  });

  it("builds a template string", () => {
    const n = 3;
    expect(`count=${n}`).toBe("count=3");
  });
});

describe("unit cases with more depth", () => {
  it("lets cn resolve conflicting Tailwind utilities (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-600")).toBe("text-blue-600");
  });

  it("combines unrelated utilities and still resolves conflicts", () => {
    expect(cn("flex gap-2", "gap-6", "items-center")).toBe("flex gap-6 items-center");
  });

  it("aggregates occurrences with reduce", () => {
    const letters = ["a", "b", "a", "c", "a", "b"];
    const counts = letters.reduce<Record<string, number>>((acc, ch) => {
      acc[ch] = (acc[ch] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ a: 3, b: 2, c: 1 });
  });

  it("extracts structured data via regex", () => {
    const line = "release app-2.4.19 built on 2026-01-15";
    const m = line.match(/app-(\d+)\.(\d+)\.(\d+)/);
    expect(m?.slice(1).map(Number)).toEqual([2, 4, 19]);
  });

  it("computes Fibonacci iteratively for a fixed term", () => {
    const fib = (n: number): number => {
      let a = 0;
      let b = 1;
      for (let i = 0; i < n; i++) {
        const next = a + b;
        a = b;
        b = next;
      }
      return a;
    };
    expect(fib(0)).toBe(0);
    expect(fib(10)).toBe(55);
  });

  it("deep-clones nested structures with structuredClone", () => {
    const original = { user: { id: 1, tags: ["x", "y"] } };
    const copy = structuredClone(original);
    copy.user.tags.push("z");
    expect(original.user.tags).toEqual(["x", "y"]);
    expect(copy.user.tags).toEqual(["x", "y", "z"]);
  });

  it("sorts unique values with a custom comparator", () => {
    const raw = [5, 2, 5, -1, 2, 10];
    const sortedUnique = [...new Set(raw)].sort((a, b) => b - a);
    expect(sortedUnique).toEqual([10, 5, 2, -1]);
  });

  it("reads query pairs from a URL", () => {
    const url = new URL("https://example.com/path?org=acme&page=2");
    expect(url.pathname).toBe("/path");
    expect(url.searchParams.get("org")).toBe("acme");
    expect(Number(url.searchParams.get("page"))).toBe(2);
  });

  it("rejects invalid JSON with a thrown SyntaxError", () => {
    expect(() => JSON.parse("{not-json")).toThrow(SyntaxError);
  });

  it("parses and narrows a nested zod schema", () => {
    const Row = z.object({
      id: z.string(),
      meta: z.object({ score: z.number().min(0).max(100) }),
    });
    const parsed = Row.parse({ id: "row-1", meta: { score: 42 } });
    expect(parsed.meta.score).toBe(42);
    expect(Row.safeParse({ id: "x", meta: { score: 101 } }).success).toBe(false);
  });
});
