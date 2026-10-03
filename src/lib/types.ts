export type Profile = {
  id: string; // normalized email or phone — one account per contact
  name: string;
  age: number;
  contact: string;
  contactType: "email" | "phone";
  createdAt: string;
};

/** One ingredient inside a recipe, with the macros for the amount used. */
export type RecipeItem = {
  name: string;
  qty: number;
  unit: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  foodId?: string; // when it came from your food list
};

/** A dish built from ingredients. Macros on the food are per serving. */
export type Recipe = {
  servings: number;
  items: RecipeItem[];
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
  source?: "INDB" | "USDA" | "OFF" | "Mine"; // where the numbers came from, if added from a database
  sourceId?: string; // e.g. "indb:ASC152"
  gramsPerUnit?: number; // e.g. 1 bowl = 296 g
  price?: number; // what `per` of this costs, in your currency. Unset = not priced yet.
  recipe?: Recipe; // set when this food is a dish built from ingredients
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

/** What you're willing to spend on food. */
export type Budget = {
  amount: number;
  per: "day" | "week" | "month";
};

export type Plan = {
  id: string;
  name: string;
  targets: Targets;
  budget?: Budget; // unset = no budget set
  meals: Meal[];
  smart?: import("./targets").SmartSettings; // set when targets come from Smart targets
};

export type ExtraItem = {
  name: string;
  unit: string;
  qty: number;
  kcal: number;
  p: number;
  c: number;
  f: number;
  cost?: number; // what it cost you, if it cost anything
};

/**
 * One supplement, with what a single dose provides.
 *
 * Macros and micronutrients are both **per dose**, exactly as the tub prints
 * them — "per 30 g scoop: 24 g protein" is typed as 24. Nothing is converted
 * between the label and the app, so there is no arithmetic to get wrong.
 */
export type Supplement = {
  id: string;
  name: string;
  /** What one dose is called: "scoop", "tablet", "capsule", "ml". */
  dose: string;
  /** Doses a normal day calls for. 1 unless you split them. */
  perDay: number;
  kcal: number;
  p: number;
  c: number;
  f: number;
  /** "with breakfast", "post-workout" — yours, not the app's. */
  note?: string;
  /** Micronutrients in one dose, each in the unit micros.ts stores it in. */
  micros?: import("./micros").MicroDose;
  /** When to be reminded. Unset = no reminder for this one. */
  at?: { time: string; days: number[] }; // "HH:MM"; days 0 = Sunday, empty = daily
};

export type DayLog = {
  date: string; // yyyy-mm-dd
  planId: string;
  plan?: Plan; // snapshot, so editing a plan later doesn't rewrite past days
  eaten: Record<string, number>; // `${mealId}:${foodId}` -> quantity eaten
  extras: ExtraItem[];
  /** Supplement doses taken today, keyed by supplement id. Absent or 0 = none. */
  doses?: Record<string, number>;
  water: number | null;
  steps: number | null;
  sleep?: number | null; // hours slept the night before, 1 dp
  weight: number | null;
  measures?: Record<string, number>; // tape measurements in cm, by key
  workout: boolean;
  notes: string;
};

export type Macro = { kcal: number; p: number; c: number; f: number };

export type WorkoutSet = {
  weight: number | null; // kg
  reps: number | null;
  secs?: number | null; // for holds and carries, instead of reps
  rpe?: number | null; // how hard it felt, 6–10
  done: boolean;
};

export type WorkoutExercise = {
  id: string; // unique within the workout
  exerciseId: string | null; // free-exercise-db id, or null for a custom exercise
  name: string;
  muscles: string[]; // primary muscles, for display
  sets: WorkoutSet[];
  mode?: "reps" | "time"; // "time" for planks, hangs and carries
  group?: string | null; // exercises sharing a group are a superset
};

/** One line of a saved routine: the exercise, and what you aim to do. */
export type RoutineExercise = {
  id: string;
  exerciseId: string | null;
  name: string;
  muscles: string[];
  sets: number;
  reps: string; // free text, e.g. "8-12" or "5"
};

/** A saved training day — Push day, Legs — you can start a session from. */
export type Routine = {
  id: string;
  name: string;
  exercises: RoutineExercise[];
  createdAt: string;
};

export type Workout = {
  id: string;
  date: string; // yyyy-mm-dd
  name: string; // e.g. "Push day"
  startedAt: string; // ISO time
  finishedAt: string | null; // null while in progress
  exercises: WorkoutExercise[];
  notes: string;
};
