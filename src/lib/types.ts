export type Food = {
  id: string;
  name: string;
  unit: string; // e.g. "g", "ml", "piece"
  per: number; // amount that the macros below refer to
  step: number; // increment for +/- buttons
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
  kcal?: number;
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
  eaten: Record<string, number>; // key = `${mealId}:${foodId}` -> quantity actually eaten
  extras: ExtraItem[];
  water: number | null;
  steps: number | null;
  weight: number | null;
  workout: boolean;
  notes: string;
};

export type Macro = { kcal: number; p: number; c: number; f: number };
