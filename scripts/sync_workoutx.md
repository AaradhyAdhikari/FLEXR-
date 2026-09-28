# Refreshing the WorkoutX animation map

`public/data/exercise-gifs.json` maps our exercise ids (free-exercise-db) to
WorkoutX exercise ids. The app never calls the WorkoutX search API at runtime —
it only asks our own `/api/exercises/gif/<workoutx id>` route for the animation
file, which is cached for a year at the edge. Rebuild the map only when the
exercise catalogue changes.

WorkoutX free plan: 500 requests a month, 30 a minute, 10 exercises per page,
so a full rebuild costs ~133 requests. The GIF files need the key too, which is
why they are proxied rather than linked directly.

Run this in a browser console (any page), with your own key:

```js
const KEY = 'YOUR_WORKOUTX_KEY';
const wx = [];
while (true) {
  const r = await fetch(`https://api.workoutxapp.com/v1/exercises?limit=10&offset=${wx.length}`, { headers: { 'X-WorkoutX-Key': KEY } });
  if (r.status === 429) { await new Promise(s => setTimeout(s, 15000)); continue; }
  if (!r.ok) break;
  const j = await r.json();
  wx.push(...j.data.map(e => ({ id: e.id, name: e.name, equipment: e.equipment, target: e.target })));
  if (j.data.length < 10 || wx.length >= j.total) break;
  await new Promise(s => setTimeout(s, 2200));
}
```

Then match `wx` against `/data/exercises.json` on name tokens, with a bonus for
matching equipment and target muscle (see the notes in `src/lib/exercises.ts`),
keep pairs scoring 0.62 or better, and hand-check the lifts listed in
`src/lib/exerciseTips.ts` — those are the ones people look at most.

Environment variable (server only, never `NEXT_PUBLIC_`):

    WORKOUTX_API_KEY=...
