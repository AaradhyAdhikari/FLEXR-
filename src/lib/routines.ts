import { uid } from "./format";
import { Routine, RoutineExercise, Workout, WorkoutExercise, WorkoutSet } from "./types";
import { exerciseKey, previousSets } from "./workouts";

/** A starting point for someone who has never saved one. */
export const ROUTINE_IDEAS: { name: string; exercises: { name: string; exerciseId: string | null; muscles: string[]; sets: number; reps: string }[] }[] = [
  {
    name: "Push day",
    exercises: [
      { name: "Barbell Bench Press - Medium Grip", exerciseId: "Barbell_Bench_Press_-_Medium_Grip", muscles: ["chest"], sets: 4, reps: "6-8" },
      { name: "Standing Military Press", exerciseId: "Standing_Military_Press", muscles: ["shoulders"], sets: 3, reps: "8-10" },
      { name: "Incline Dumbbell Press", exerciseId: "Incline_Dumbbell_Press", muscles: ["chest"], sets: 3, reps: "8-12" },
      { name: "Side Lateral Raise", exerciseId: "Side_Lateral_Raise", muscles: ["shoulders"], sets: 3, reps: "12-15" },
      { name: "Triceps Pushdown", exerciseId: "Triceps_Pushdown", muscles: ["triceps"], sets: 3, reps: "10-12" },
    ],
  },
  {
    name: "Pull day",
    exercises: [
      { name: "Pullups", exerciseId: "Pullups", muscles: ["lats"], sets: 4, reps: "6-10" },
      { name: "Bent Over Barbell Row", exerciseId: "Bent_Over_Barbell_Row", muscles: ["middle back"], sets: 4, reps: "6-8" },
      { name: "Seated Cable Rows", exerciseId: "Seated_Cable_Rows", muscles: ["middle back"], sets: 3, reps: "10-12" },
      { name: "Face Pull", exerciseId: "Face_Pull", muscles: ["shoulders"], sets: 3, reps: "12-15" },
      { name: "Barbell Curl", exerciseId: "Barbell_Curl", muscles: ["biceps"], sets: 3, reps: "8-12" },
    ],
  },
  {
    name: "Leg day",
    exercises: [
      { name: "Barbell Full Squat", exerciseId: "Barbell_Full_Squat", muscles: ["quadriceps"], sets: 4, reps: "5-8" },
      { name: "Romanian Deadlift", exerciseId: "Romanian_Deadlift", muscles: ["hamstrings"], sets: 3, reps: "8-10" },
      { name: "Leg Press", exerciseId: "Leg_Press", muscles: ["quadriceps"], sets: 3, reps: "10-12" },
      { name: "Lying Leg Curls", exerciseId: "Lying_Leg_Curls", muscles: ["hamstrings"], sets: 3, reps: "10-12" },
      { name: "Standing Calf Raises", exerciseId: "Standing_Calf_Raises", muscles: ["calves"], sets: 4, reps: "12-15" },
    ],
  },
];

export const newRoutineExercise = (e: Partial<RoutineExercise> = {}): RoutineExercise => ({
  id: "re-" + uid(),
  exerciseId: e.exerciseId ?? null,
  name: e.name ?? "",
  muscles: e.muscles ?? [],
  sets: e.sets ?? 3,
  reps: e.reps ?? "8-12",
});

export function routineFrom(name: string, exercises: RoutineExercise[]): Routine {
  return { id: "rt-" + uid(), name: name.trim() || "Routine", exercises, createdAt: new Date().toISOString() };
}

/** Turn a finished or in-progress workout into a routine you can repeat. */
export function routineFromWorkout(w: Workout): Routine {
  return routineFrom(
    w.name,
    w.exercises.map((ex) =>
      newRoutineExercise({
        exerciseId: ex.exerciseId,
        name: ex.name,
        muscles: ex.muscles,
        sets: Math.max(1, ex.sets.filter((s) => s.done).length || ex.sets.length),
        reps: repRange(ex.sets),
      })
    )
  );
}

/** "8-10" from the reps actually done, or "8" when they were all the same. */
function repRange(sets: WorkoutSet[]): string {
  const reps = sets.map((s) => s.reps).filter((r): r is number => !!r && r > 0);
  if (!reps.length) return "8-12";
  const lo = Math.min(...reps), hi = Math.max(...reps);
  return lo === hi ? String(lo) : `${lo}-${hi}`;
}

/**
 * Start a session from a routine: the exercises are laid out with the right
 * number of empty sets, and last time's numbers show as you go.
 */
export function workoutFromRoutine(r: Routine, date: string, all: Record<string, Workout>): Workout {
  const workout: Workout = {
    id: "w-" + uid(),
    date,
    name: r.name,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    notes: "",
    exercises: [],
  };
  workout.exercises = r.exercises.map((re) => {
    const ex: WorkoutExercise = {
      id: "x-" + uid(),
      exerciseId: re.exerciseId,
      name: re.name,
      muscles: re.muscles,
      sets: [],
    };
    const prev = previousSets(all, workout, exerciseKey(ex));
    const count = Math.max(1, Math.min(10, Math.round(re.sets) || 3));
    ex.sets = Array.from({ length: count }, (): WorkoutSet => ({ weight: null, reps: null, done: false }));
    // Nothing is pre-filled: the "last time" column already shows what to beat.
    void prev;
    return ex;
  });
  return workout;
}

export const routineSummary = (r: Routine): string =>
  r.exercises.length ? r.exercises.map((e) => e.name).slice(0, 3).join(", ") + (r.exercises.length > 3 ? ` +${r.exercises.length - 3}` : "") : "No exercises yet";

export const totalSets = (r: Routine): number => r.exercises.reduce((a, e) => a + (e.sets || 0), 0);
