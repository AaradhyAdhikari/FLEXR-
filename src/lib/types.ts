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

export type Plan = {
  id: string;
  name: string;
  targets: Targets;
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
