import type { Pt } from "../types";

export interface Viewport {
  cx: number;
  cy: number;
  scale: number;
}

export const DEFAULT_VIEW: Viewport = { cx: 0, cy: 0, scale: 0.05 };

export function toCanvas(p: Pt, v: Viewport, w: number, h: number): Pt {
  return {
    x: w / 2 + (p.x - v.cx) / v.scale,
    y: h / 2 - (p.y - v.cy) / v.scale,
  };
}

export function toWorld(p: Pt, v: Viewport, w: number, h: number): Pt {
  return {
    x: v.cx + (p.x - w / 2) * v.scale,
    y: v.cy - (p.y - h / 2) * v.scale,
  };
}

export function niceStep(scale: number): number {
  const target = 70 * scale;
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  const norm = target / pow;
  const mult = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return mult * pow;
}

/** Парсер виразів: числа, x, + - * / ^, дужки, sin cos tan tg sqrt abs ln log pi e. */
export function evalExpr(expr: string, x: number): number {
  const clean = expr.replace(/\s+/g, "").replace(/,/g, ".");
  let i = 0;

  function peek(): string {
    return clean[i];
  }

  function eat(ch: string): boolean {
    if (clean[i] === ch) {
      i++;
      return true;
    }
    return false;
  }

  function parseExpr(): number {
    let val = parseTerm();
    for (;;) {
      if (eat("+")) val += parseTerm();
      else if (eat("-")) val -= parseTerm();
      else return val;
    }
  }

  function parseTerm(): number {
    let val = parseUnary();
    for (;;) {
      if (eat("*")) val *= parseUnary();
      else if (eat("/")) val /= parseUnary();
      else if (peek() === "(" || /[x0-9]/.test(peek() ?? "")) val *= parseUnary();
      else return val;
    }
  }

  function parseUnary(): number {
    if (eat("-")) return -parseUnary();
    if (eat("+")) return parseUnary();
    return parsePower();
  }

  function parsePower(): number {
    const base = parseAtom();
    if (eat("^")) return Math.pow(base, parseUnary());
    return base;
  }

  function parseAtom(): number {
    if (eat("(")) {
      const val = parseExpr();
      eat(")");
      return val;
    }
    const fn = clean.slice(i).match(/^(sin|cos|tan|tg|sqrt|abs|ln|log)/);
    if (fn) {
      i += fn[0].length;
      const arg = parseAtom();
      switch (fn[0]) {
        case "sin": return Math.sin(arg);
        case "cos": return Math.cos(arg);
        case "tan":
        case "tg": return Math.tan(arg);
        case "sqrt": return Math.sqrt(arg);
        case "abs": return Math.abs(arg);
        case "ln": return Math.log(arg);
        case "log": return Math.log10(arg);
      }
    }
    if (eat("x")) return x;
    if (clean.slice(i).startsWith("pi")) {
      i += 2;
      return Math.PI;
    }
    if (clean.slice(i).startsWith("e") && !/\d/.test(clean.slice(i + 1, i + 2) ?? "")) {
      i += 1;
      return Math.E;
    }
    const num = clean.slice(i).match(/^\d+(\.\d+)?/);
    if (num) {
      i += num[0].length;
      return parseFloat(num[0]);
    }
    throw new Error(`символ «${peek() ?? "кінець"}»`);
  }

  const result = parseExpr();
  if (i !== clean.length) throw new Error(`зайвий символ «${clean[i]}»`);
  if (!isFinite(result)) throw new Error("число занадто велике");
  return result;
}

export function fmt(n: number, digits = 2): string {
  if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-4 && n !== 0)) return n.toExponential(1);
  return parseFloat(n.toFixed(digits)).toString();
}

/** Легкий «олівцевий» шум: зміщує координату на долю пікселя. */
export function jitter(n: number, amp: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return (s - Math.floor(s) - 0.5) * amp;
}
