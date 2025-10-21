// web/src/config/tiers.ts
export type Tier = {
  id: "cruiser" | "power" | "pro";
  name: string;
  price: number;      // USD
  tokens: number;     // monthly allocation (Token Formula v2.1)
  blurb?: string;
};

export const TIERS: Tier[] = [
  { id: "cruiser", name: "Cruiser",      price: 5.50,  tokens: 178_000, blurb: "Great value. Transparent fuel." },
  { id: "power",   name: "Power Driver", price: 8.50,  tokens: 356_000, blurb: "Best value. More runtime." },
  { id: "pro",     name: "Pro Driver",   price: 14.99, tokens: 711_000, blurb: "Max fuel. Priority boosts later." },
];
