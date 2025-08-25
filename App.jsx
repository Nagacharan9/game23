import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimation } from "framer-motion";

// Simple cricket timing game
// Controls: Space / Tap to SWING when the ball reaches the batter.
// Goal: Score as many runs as you can before you run out of balls or wickets!

export default function CricketTimingGame() {
  // Game settings
  const [totalOvers, setTotalOvers] = useState(2); // quick game: 2 overs (12 balls)
  const [maxWickets, setMaxWickets] = useState(3);
  const ballsPerOver = 6;

  // Game state
  const [score, setScore] = useState(0);
  const [wickets, setWickets] = useState(0);
  const [ballsBowled, setBallsBowled] = useState(0);
  const [lastOutcome, setLastOutcome] = useState<string | null>(null);
  const [isOver, setIsOver] = useState(false);

  // Ball state
  const controls = useAnimation();
  const [isBallInFlight, setIsBallInFlight] = useState(false);
  const pitchTimeRef = useRef<number | null>(null);
  const travelMsRef = useRef<number>(1800);
  const swingUsedRef = useRef(false);

  const totalBalls = useMemo(() => totalOvers * ballsPerOver, [totalOvers]);

  const ballsLeft = totalBalls - ballsBowled;
  const currentOver = Math.floor(ballsBowled / ballsPerOver);
  const ballNumber = (ballsBowled % ballsPerOver) + 1;

  const canPlay = !isOver && wickets < maxWickets && ballsBowled < totalBalls;

  const outcomeTextColor = useMemo(() => {
    if (!lastOutcome) return "text-slate-400";
    if (lastOutcome.includes("WICKET")) return "text-red-500";
    if (["6", "SIX!"].some((v) => lastOutcome.includes(v))) return "text-emerald-500";
    if (["FOUR", "4"].some((v) => lastOutcome.includes(v))) return "text-emerald-500";
    if (["2", "1"].some((v) => lastOutcome.includes(v))) return "text-blue-500";
    if (lastOutcome.includes("DOT")) return "text-slate-500";
    return "text-slate-400";
  }, [lastOutcome]);

  const resetGame = useCallback(() => {
    setScore(0);
    setWickets(0);
    setBallsBowled(0);
    setLastOutcome(null);
    setIsOver(false);
    swingUsedRef.current = false;
    pitchTimeRef.current = null;
    setIsBallInFlight(false);
    controls.stop();
  }, [controls]);

  // Core: bowl a ball
  const bowl = useCallback(async () => {
    if (!canPlay || isBallInFlight) return;
    setLastOutcome("Bowling…");

    // Randomize speed & slight line/length for variety
    const travel = Math.floor(1350 + Math.random() * 900); // 1.35s–2.25s
    travelMsRef.current = travel;
    swingUsedRef.current = false;

    // Start animation left→right
    setIsBallInFlight(true);
    pitchTimeRef.current = performance.now() + travel; // expected time at bat
    await controls.start({ x: [ -340, 320 ], y: [ 0, Math.random() * 16 - 8 ], transition: { duration: travel / 1000, ease: "linear" } });

    // If player hasn't swung yet when ball passes, resolve as late/miss
    if (!swingUsedRef.current) {
      resolveShot(Infinity); // super late
    }
  }, [canPlay, isBallInFlight, controls]);

  // Shot resolution logic
  const resolveShot = useCallback((timingDiffMs: number) => {
    if (!canPlay || !isBallInFlight) return;

    // Scoring bands based on timing accuracy
    // diff = | swingMoment - pitchTime |
    let outcome = "DOT";
    let runs = 0;

    if (timingDiffMs <= 45) { outcome = "SIX! Timed to perfection"; runs = 6; }
    else if (timingDiffMs <= 95) { outcome = "FOUR! Crunched through the gap"; runs = 4; }
    else if (timingDiffMs <= 160) { outcome = "2 runs – well placed"; runs = 2; }
    else if (timingDiffMs <= 230) { outcome = "Single taken"; runs = 1; }
    else {
      // Big mistime → chance of wicket (70%), else dot
      const isOut = Math.random() < 0.7;
      if (isOut) {
        outcome = "WICKET! Big edge, taken";
      } else {
        outcome = "DOT ball – beaten!";
      }
      runs = isOut ? -1 : 0; // -1 encodes wicket
    }

    setLastOutcome(outcome);

    setScore((s) => (runs > 0 ? s + runs : s));
    setWickets((w) => (runs === -1 ? w + 1 : w));
    setBallsBowled((b) => b + 1);

    // End-of-ball cleanup
    controls.stop();
    setIsBallInFlight(false);
    pitchTimeRef.current = null;

  }, [canPlay, controls, isBallInFlight]);

  // Swing handler
  const swing = useCallback(() => {
    if (!canPlay || !isBallInFlight || swingUsedRef.current) return;
    swingUsedRef.current = true;
    const now = performance.now();
    const expected = pitchTimeRef.current ?? now + 9999; // if null, treat as late
    const diff = Math.abs(now - expected);
    resolveShot(diff);
  }, [canPlay, isBallInFlight, resolveShot]);

  // Start next delivery automatically after a short delay
  useEffect(() => {
    if (isOver) return;
    if (!canPlay) return; // already ended by wickets/balls

    // After each ball resolution, auto-bowl next after delay
    if (!isBallInFlight && ballsBowled > 0 && ballsBowled < totalBalls && wickets < maxWickets) {
      const t = setTimeout(() => bowl(), 800);
      return () => clearTimeout(t);
    }
  }, [ballsBowled, totalBalls, wickets, maxWickets, isBallInFlight, canPlay, bowl, isOver]);

  // End conditions watcher
  useEffect(() => {
    const over = wickets >= maxWickets || ballsBowled >= totalBalls;
    setIsOver(over);
  }, [wickets, maxWickets, ballsBowled, totalBalls]);

  // Key controls: Space/Enter to swing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        swing();
      }
      if (e.code === "KeyB") {
        e.preventDefault();
        bowl();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [swing, bowl]);

  // Bowl first ball automatically at mount
  useEffect(() => {
    const t = setTimeout(() => {
      if (canPlay && !isBallInFlight && ballsBowled === 0) bowl();
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const oversDisplay = `${Math.floor(ballsBowled / 6)}.${ballsBowled % 6}`;

  return (
    <div className="min-h-[80vh] w-full bg-gradient-to-b from-slate-900 to-slate-800 text-slate-100 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-4xl">
        {/* Header / Scoreboard */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Cricket Timing Game</h1>
            <p className="text-slate-300">Press <kbd className="px-1 py-0.5 rounded bg-slate-700">Space</kbd> or tap/click to SWING. Time it as the ball reaches the batter!</p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Score" value={String(score)} />
            <Stat label="Wkts" value={`${wickets}/${maxWickets}`} />
            <Stat label="Over" value={`${oversDisplay} / ${totalOvers}`} />
          </div>
        </div>

        {/* Settings */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-700/40 rounded-2xl px-3 py-2">
            <label className="text-sm text-slate-300">Overs</label>
            <select
              className="bg-transparent rounded-lg border border-slate-600 px-2 py-1"
              value={totalOvers}
              onChange={(e) => setTotalOvers(parseInt(e.target.value) || 1)}
              disabled={ballsBowled > 0}
            >
              {[1,2,3,4,5].map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-700/40 rounded-2xl px-3 py-2">
            <label className="text-sm text-slate-300">Wickets</label>
            <select
              className="bg-transparent rounded-lg border border-slate-600 px-2 py-1"
              value={maxWickets}
              onChange={(e) => setMaxWickets(parseInt(e.target.value) || 1)}
              disabled={ballsBowled > 0}
            >
              {[1,2,3,5,10].map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          <button
            onClick={resetGame}
            className="ml-auto bg-emerald-500 hover:bg-emerald-600 text-emerald-950 font-semibold px-4 py-2 rounded-2xl shadow-md"
          >
            Reset
          </button>
        </div>

        {/* Ground / Play Area */}
        <div
          className="relative mt-5 md:mt-6 h-[320px] md:h-[360px] rounded-3xl bg-gradient-to-b from-green-700 to-green-800 shadow-inner overflow-hidden"
          onMouseDown={swing}
          onTouchStart={(e) => { e.preventDefault(); swing(); }}
        >
          {/* Pitch */}
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-full w-24 bg-lime-200/40 rounded-3xl border-x border-white/20" />

          {/* Creases */}
          <div className="absolute left-1/2 -translate-x-1/2 top-12 w-40 h-0.5 bg-white/40" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-12 w-40 h-0.5 bg-white/40" />

          {/* Batter */}
          <div className="absolute right-6 bottom-8 md:bottom-10">
            <Bat swing={swingUsedRef.current && isBallInFlight} />
          </div>

          {/* Ball */}
          <motion.div
            animate={controls}
            initial={{ x: -340, y: 0 }}
            className="absolute top-1/2 -mt-2 left-1/2 -ml-2 w-4 h-4 rounded-full bg-orange-200 shadow"
          />

          {/* Outcome toast */}
          <div className={`absolute left-1/2 -translate-x-1/2 top-3 text-sm md:text-base font-semibold ${outcomeTextColor}`}>
            {lastOutcome ?? "Tap/click or press Space to SWING"}
          </div>

          {/* Helper markers */}
          <TimingMarker travelMsRef={travelMsRef} isBallInFlight={isBallInFlight} />
        </div>

        {/* Controls */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={bowl}
            disabled={!canPlay || isBallInFlight}
            className="bg-sky-500 disabled:bg-slate-600 hover:bg-sky-600 text-sky-950 font-semibold px-4 py-2 rounded-2xl shadow-md"
          >
            {isBallInFlight ? "Ball in flight…" : "Bowl (B)"}
          </button>
          <button
            onClick={swing}
            disabled={!canPlay || !isBallInFlight}
            className="bg-amber-400 disabled:bg-slate-600 hover:bg-amber-500 text-amber-950 font-semibold px-4 py-2 rounded-2xl shadow-md"
          >
            Swing (Space/Enter)
          </button>

          {!canPlay && (
            <div className="ml-auto text-right">
              <div className="text-lg font-bold">Innings Complete</div>
              <div className="text-slate-300">Final: <span className="font-semibold text-white">{score}</span>/{wickets} in {totalOvers} ov</div>
            </div>
          )}
        </div>

        {/* Tips */}
        <ul className="mt-4 text-slate-300 text-sm list-disc pl-5 space-y-1">
          <li>Perfect timing window is tight — try to swing exactly as the ball reaches the batter.</li>
          <li>Late/early big mistimes have a high chance of <span className="text-red-400 font-semibold">WICKET</span>.</li>
          <li>Use the <span className="font-semibold">Overs</span> and <span className="font-semibold">Wickets</span> selectors before the first ball to change difficulty.</li>
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/70 rounded-2xl px-4 py-3 shadow">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function Bat({ swing }: { swing: boolean }) {
  return (
    <motion.div
      animate={swing ? { rotate: [0, -25, 12, 0] } : { rotate: 0 }}
      transition={{ duration: 0.3 }}
      className="w-16 h-16 origin-bottom-right"
    >
      <div className="w-12 h-3 bg-yellow-300 rounded-full shadow mb-1" />
      <div className="w-3 h-12 bg-yellow-400 rounded-b-2xl shadow" />
    </motion.div>
  );
}

function TimingMarker({ travelMsRef, isBallInFlight }: { travelMsRef: React.MutableRefObject<number>; isBallInFlight: boolean; }) {
  const [hint, setHint] = useState("");

  useEffect(() => {
    if (!isBallInFlight) { setHint(""); return; }
    // Provide a dynamic cue for new players: shows approximate swing timing
    const perfect = travelMsRef.current;
    setHint(`Hint: swing at ~${Math.round(perfect)}ms after the ball starts`);
  }, [isBallInFlight, travelMsRef]);

  return (
    <div className="absolute bottom-3 left-3 text-xs text-white/60">{hint}</div>
  );
}
