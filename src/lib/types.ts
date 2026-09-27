export type Profile = {
  id: string; // normalized email or phone — one account per contact
  name: string;
  age: number;
  contact: string;
  contactType: "email" | "phone";
  createdAt: string;
};

export type Food = {
  id: string;
  name: string;
  unit: string; // e.g. "g", "ml", "piece"
  per: number; // amount the macros below refer to
  step: number; // increment for quantity buttons
  kcal: number;
  p: number; // protein g
  c: number; // carbs g
  f: number; // fat g
};

export type MealItem = {
  foodId: string;
  qty: number; // planned quantity, in the food's unit
};

export type Meal = {
  id: string;
  name: string;
  items: MealItem[];
};

export type Targets = {
  kcal: number | null; // null = use the total of the plan's meals
  protein: number;
  carbs: number;
  fat: number;
  water: number; // litres
  steps: number;
};

export type Plan = {
  id: string;
  name: string;
  targets: Targets;
  meals: Meal[];
};

export type ExtraItem = {
  name: string;
  unit: string;
  qty: number;
  kcal: number;
  p: number;
  c: number;
  f: number;
};

export type DayLog = {
  date: string; // yyyy-mm-dd
  planId: string;
  plan?: Plan; // snapshot, so editing a plan later doesn't rewrite past days
  eaten: Record<string, number>; // `${mealId}:${foodId}` -> quantity eaten
  extras: ExtraItem[];
  water: number | null;
  steps: number | null;
  weight: number | null;
  workout: boolean;
  notes: string;
};

export type Macro = { kcal: number; p: number; c: number; f: number };
