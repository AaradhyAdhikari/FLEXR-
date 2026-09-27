import { Food, Plan } from "./types";

// A starter food list covering common gym / Indian-diet staples.
// Macros are per the `per` amount, in `unit`.
export const SEED_FOODS: Food[] = [
  { id: "egg", name: "Egg (whole)", unit: "piece", per: 1, step: 1, kcal: 78, p: 6.3, c: 0.6, f: 5.3 },
  { id: "egg-white", name: "Egg white", unit: "piece", per: 1, step: 1, kcal: 17, p: 3.6, c: 0.2, f: 0.1 },
  { id: "chicken-breast", name: "Chicken breast, cooked", unit: "g", per: 100, step: 10, kcal: 165, p: 31, c: 0, f: 3.6 },
  { id: "rice-cooked", name: "Rice, cooked", unit: "g", per: 100, step: 10, kcal: 130, p: 2.7, c: 28, f: 0.3 },
  { id: "roti", name: "Roti (whole wheat)", unit: "piece", per: 1, step: 1, kcal: 104, p: 3, c: 18, f: 2.5 },
  { id: "paneer", name: "Paneer", unit: "g", per: 100, step: 10, kcal: 265, p: 18, c: 3.4, f: 20.8 },
  { id: "dal", name: "Dal, cooked", unit: "g", per: 100, step: 25, kcal: 116, p: 9, c: 20, f: 0.4 },
  { id: "oats", name: "Oats, dry", unit: "g", per: 100, step: 10, kcal: 389, p: 16.9, c: 66, f: 6.9 },
  { id: "banana", name: "Banana", unit: "piece", per: 1, step: 1, kcal: 105, p: 1.3, c: 27, f: 0.4 },
  { id: "whey", name: "Whey protein", unit: "scoop", per: 1, step: 1, kcal: 120, p: 24, c: 3, f: 1.5 },
  { id: "milk", name: "Milk, toned", unit: "ml", per: 100, step: 50, kcal: 58, p: 3.2, c: 4.7, f: 3 },
  { id: "peanut-butter", name: "Peanut butter", unit: "g", per: 100, step: 10, kcal: 588, p: 25, c: 20, f: 50 },
  { id: "curd", name: "Curd / yogurt", unit: "g", per: 100, step: 25, kcal: 60, p: 3.5, c: 4.7, f: 3.3 },
  { id: "almonds", name: "Almonds", unit: "g", per: 10, step: 10, kcal: 58, p: 2.1, c: 2.2, f: 5 },
];

export const SEED_PLAN: Plan = {
  id: "default",
  name: "Default plan",
  targets: { protein: 150, carbs: 300, fat: 75, water: 3, steps: 10000 },
  meals: [
    {
      id: "breakfast",
      name: "Breakfast",
      items: [
        { foodId: "oats", qty: 60 },
        { foodId: "egg", qty: 3 },
        { foodId: "banana", qty: 1 },
      ],
    },
    {
      id: "lunch",
      name: "Lunch",
      items: [
        { foodId: "rice-cooked", qty: 150 },
        { foodId: "dal", qty: 150 },
        { foodId: "chicken-breast", qty: 150 },
      ],
    },
    {
      id: "post-workout",
      name: "Post-workout",
      items: [{ foodId: "whey", qty: 1 }, { foodId: "banana", qty: 1 }],
    },
    {
      id: "dinner",
      name: "Dinner",
      items: [
        { foodId: "roti", qty: 3 },
        { foodId: "paneer", qty: 100 },
        { foodId: "curd", qty: 100 },
      ],
    },
  ],
};
