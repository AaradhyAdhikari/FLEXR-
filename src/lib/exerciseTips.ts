/**
 * Flexr's own coaching notes for the most common gym lifts: short cues to think
 * about during a set, and the mistakes people most often make.
 * Keyed by free-exercise-db id. General guidance, not medical advice.
 */
export type Tips = { cues: string[]; mistakes: string[] };

export const TIPS: Record<string, Tips> = {
  "Barbell_Bench_Press_-_Medium_Grip": {
    cues: ["Squeeze shoulder blades together and down before unracking", "Feet planted, slight arch, glutes on the bench", "Lower the bar to mid/lower chest with control", "Elbows about 45–70° from your body, not flared straight out", "Press up and slightly back toward your face"],
    mistakes: ["Bouncing the bar off the chest", "Elbows flared to 90°, which stresses the shoulders", "Butt lifting off the bench", "Wrists bent far back instead of stacked over the elbows"],
  },
  "Barbell_Incline_Bench_Press_-_Medium_Grip": {
    cues: ["Bench at about 30°, not steeper", "Shoulder blades pinned back", "Touch just below the collarbone", "Keep forearms vertical at the bottom"],
    mistakes: ["Bench so steep it becomes a shoulder press", "Losing upper-back tightness", "Cutting the range short"],
  },
  Dumbbell_Bench_Press: {
    cues: ["Kick the dumbbells up with your knees to get in position", "Lower until dumbbells are level with your chest", "Palms forward or slightly angled in", "Press up and slightly together, without clanking"],
    mistakes: ["Dropping the dumbbells too deep and straining the shoulder", "Uneven arms (one side pressing faster)", "Letting shoulders roll forward at the top"],
  },
  Incline_Dumbbell_Press: {
    cues: ["Bench around 30°", "Shoulder blades back and down", "Lower with control to upper-chest level", "Press in a slight arc so the dumbbells meet above the chin"],
    mistakes: ["Too steep an incline", "Short, choppy reps", "Flaring elbows straight out to the sides"],
  },
  Pushups: {
    cues: ["Hands just wider than shoulders", "Body in one straight line from head to heels", "Brace abs and squeeze glutes", "Chest (not chin) goes to the floor"],
    mistakes: ["Hips sagging or piking up", "Elbows flared at 90°", "Half reps", "Head poking forward"],
  },
  "Dips_-_Triceps_Version": {
    cues: ["Stay upright to keep the focus on triceps", "Shoulders down, away from your ears", "Lower until elbows are about 90°", "Lock out fully at the top"],
    mistakes: ["Dropping too deep, which strains the front of the shoulder", "Shrugging shoulders up", "Swinging the legs for momentum"],
  },
  Barbell_Full_Squat: {
    cues: ["Bar on upper back, not on the neck", "Big breath and brace your core before each rep", "Knees track in line with your toes", "Sit down between your hips, chest up", "Drive through the whole foot"],
    mistakes: ["Knees caving inward", "Heels lifting off the floor", "Back rounding at the bottom", "Cutting depth short as the weight goes up"],
  },
  Barbell_Deadlift: {
    cues: ["Bar over mid-foot, shins close to the bar", "Hips higher than knees, shoulders over the bar", "Pull the slack out of the bar before lifting", "Push the floor away; keep the bar dragging up your legs", "Stand tall and squeeze glutes at the top"],
    mistakes: ["Rounding the lower back", "Bar drifting away from the legs", "Jerking the bar off the floor", "Leaning back too far at lockout"],
  },
  Romanian_Deadlift: {
    cues: ["Soft knees that stay in place", "Push hips back like closing a door with your butt", "Bar slides down the thighs", "Stop when you feel a strong hamstring stretch, usually mid-shin", "Neutral spine the whole time"],
    mistakes: ["Turning it into a squat by bending the knees more", "Rounding the back to reach lower", "Bar floating away from the legs"],
  },
  Leg_Press: {
    cues: ["Feet shoulder-width, mid-platform", "Lower until knees are near 90° or as deep as your lower back stays flat", "Press through heels and mid-foot"],
    mistakes: ["Lower back peeling off the seat at the bottom", "Locking the knees hard at the top", "Knees caving in"],
  },
  Barbell_Lunge: {
    cues: ["Take a long enough step that the front shin stays fairly vertical", "Drop the back knee straight down", "Keep your torso upright", "Push through the front heel"],
    mistakes: ["Front knee caving in", "Steps too short", "Leaning far forward"],
  },
  Dumbbell_Lunges: {
    cues: ["Dumbbells hang at your sides", "Step out, drop the back knee toward the floor", "Front knee tracks over toes", "Drive back up through the front foot"],
    mistakes: ["Wobbly, narrow stance (feet on a tightrope)", "Banging the back knee on the floor", "Rushing reps"],
  },
  Barbell_Hip_Thrust: {
    cues: ["Upper back on the bench edge, bar padded over hips", "Feet flat, shins vertical at the top", "Tuck the chin, ribs down", "Squeeze glutes hard and pause at the top"],
    mistakes: ["Arching the lower back instead of using glutes", "Feet too far or too close", "Not reaching full hip extension"],
  },
  Standing_Military_Press: {
    cues: ["Grip just outside shoulders, forearms vertical", "Squeeze glutes and brace abs", "Move your head back slightly so the bar travels in a straight line", "Head through at the top, bar over mid-foot"],
    mistakes: ["Leaning back and turning it into an incline press", "Pressing the bar out in front", "Flaring the ribs"],
  },
  Dumbbell_Shoulder_Press: {
    cues: ["Start with dumbbells at ear height", "Brace your core, back against the pad if seated", "Press up and slightly in"],
    mistakes: ["Arching the lower back", "Lowering only halfway", "Clanking dumbbells at the top"],
  },
  Side_Lateral_Raise: {
    cues: ["Slight bend in the elbows", "Lead with the elbows, raise to shoulder height", "Pinkies slightly up is fine; avoid pain", "Lower slowly"],
    mistakes: ["Swinging the body to lift heavy weights", "Shrugging with the traps", "Raising far above shoulder height"],
  },
  Pullups: {
    cues: ["Start from a full hang", "Pull shoulder blades down first", "Drive elbows down toward your ribs", "Chin clears the bar"],
    mistakes: ["Kipping or swinging", "Half reps", "Shrugging shoulders to the ears"],
  },
  "Chin-Up": {
    cues: ["Palms facing you, shoulder-width grip", "Full hang at the bottom", "Pull your chest to the bar"],
    mistakes: ["Only doing the top half", "Swinging legs", "Neck straining to reach the bar"],
  },
  "Wide-Grip_Lat_Pulldown": {
    cues: ["Thighs locked under the pad", "Slight lean back, chest up", "Pull the bar to the upper chest", "Think elbows down and back"],
    mistakes: ["Leaning way back and rowing it", "Pulling behind the neck", "Using body momentum"],
  },
  Bent_Over_Barbell_Row: {
    cues: ["Hinge forward to about 45° or lower, back flat", "Pull the bar to the lower chest / belly", "Squeeze shoulder blades together", "Control the way down"],
    mistakes: ["Standing more upright each rep", "Rounded back", "Jerking the weight with the hips"],
  },
  "One-Arm_Dumbbell_Row": {
    cues: ["Hand and knee on the bench, back flat", "Pull the dumbbell toward your hip", "Keep shoulders square to the floor"],
    mistakes: ["Twisting the torso to lift", "Pulling to the chest with the biceps", "Short range"],
  },
  Seated_Cable_Rows: {
    cues: ["Sit tall, knees slightly bent", "Pull the handle to your stomach", "Squeeze shoulder blades, then let them stretch forward"],
    mistakes: ["Rocking back and forth", "Rounding the lower back", "Shrugging"],
  },
  Barbell_Curl: {
    cues: ["Elbows stay pinned at your sides", "Curl up without swinging", "Squeeze at the top, lower slowly"],
    mistakes: ["Swinging the hips", "Elbows drifting forward", "Dropping the bar fast"],
  },
  Dumbbell_Bicep_Curl: {
    cues: ["Palms forward, elbows at your sides", "Turn the pinky up slightly at the top", "Lower with control"],
    mistakes: ["Using momentum", "Partial reps", "Moving the shoulders"],
  },
  Hammer_Curls: {
    cues: ["Palms face each other the whole rep", "Elbows fixed at your sides", "Slow lowering"],
    mistakes: ["Swinging", "Letting wrists bend"],
  },
  Triceps_Pushdown: {
    cues: ["Elbows tucked at your sides and still", "Push down until arms are straight", "Let the bar rise only to elbow height"],
    mistakes: ["Elbows flaring or moving forward", "Leaning over to push with body weight", "Short range"],
  },
  "EZ-Bar_Skullcrusher": {
    cues: ["Upper arms angled slightly back toward your head", "Only the elbows bend", "Lower to the forehead or just behind the head", "Straighten fully"],
    mistakes: ["Elbows flaring out wide", "Turning it into a press", "Going too heavy and hurting the elbows"],
  },
  "Close-Grip_Barbell_Bench_Press": {
    cues: ["Hands about shoulder-width, not touching", "Elbows tucked close to the body", "Touch the lower chest"],
    mistakes: ["Grip so narrow it hurts the wrists", "Elbows flaring out", "Bouncing"],
  },
  Seated_Triceps_Press: {
    cues: ["Hold one dumbbell overhead with both hands", "Elbows point up, close to your head", "Lower behind the head, then straighten"],
    mistakes: ["Elbows flaring wide", "Arching the lower back"],
  },
  Plank: {
    cues: ["Elbows under shoulders", "Straight line from head to heels", "Brace abs, squeeze glutes", "Breathe normally"],
    mistakes: ["Hips sagging", "Hips too high", "Holding your breath"],
  },
  Crunches: {
    cues: ["Curl the ribcage toward the hips", "Lift shoulder blades off the floor", "Exhale as you come up"],
    mistakes: ["Pulling on the neck", "Using momentum to sit all the way up"],
  },
  Hanging_Leg_Raise: {
    cues: ["Start from a still hang", "Tilt the pelvis up at the top, not just the legs", "Lower slowly"],
    mistakes: ["Swinging", "Only lifting with the hip flexors"],
  },
  Standing_Calf_Raises: {
    cues: ["Full stretch at the bottom", "Rise onto the balls of your feet", "Pause at the top"],
    mistakes: ["Bouncing", "Bending the knees to help"],
  },
  Face_Pull: {
    cues: ["Rope at upper-chest to face height", "Pull toward your eyes, elbows high", "Pull the rope apart and rotate hands back"],
    mistakes: ["Too heavy, leaning back", "Elbows dropping into a row"],
  },
  Leg_Extensions: {
    cues: ["Knee lined up with the machine's pivot", "Straighten fully and squeeze", "Lower slowly"],
    mistakes: ["Kicking the weight up", "Lifting the hips off the seat"],
  },
  Lying_Leg_Curls: {
    cues: ["Hips pressed into the pad", "Curl heels toward your glutes", "Control the way down"],
    mistakes: ["Hips lifting", "Partial reps", "Dropping the weight"],
  },
  Goblet_Squat: {
    cues: ["Hold the weight at your chest, elbows down", "Sit between your heels", "Elbows brush the inside of the knees at the bottom"],
    mistakes: ["Rounding forward", "Heels lifting"],
  },
  Cable_Crossover: {
    cues: ["Slight forward lean, soft elbows", "Bring hands together in a hugging arc", "Squeeze the chest, then stretch back"],
    mistakes: ["Bending elbows and pressing", "Too heavy, losing the arc"],
  },
  Dumbbell_Flyes: {
    cues: ["Slight bend in the elbows, fixed", "Open wide until you feel a chest stretch", "Bring the dumbbells up in a hugging arc"],
    mistakes: ["Going too deep and straining the shoulder", "Straightening and bending the arms (turning it into a press)"],
  },
};

export const GENERAL_SAFETY =
  "Warm up with lighter sets first. Stop if you feel sharp pain, and use a spotter or safety pins for heavy pressing and squats. This is general guidance, not medical advice.";
