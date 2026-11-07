import { track } from "./analytics.ts";

const MILESTONES = [5, 15, 30, 60, 120];
const TICK_MS = 60000;

let started = false;
let minutes = 0;
let sent = 0;
let lastInput = 0;
let lastTick = 0;

export function markInput() {
  lastInput = Date.now();
}

function tick() {
  const now = Date.now();
  if (document.visibilityState === "visible" && lastInput > lastTick) minutes++;
  lastTick = now;
  while (sent < MILESTONES.length && minutes >= MILESTONES[sent]) {
    track("play_milestone", { minutes: MILESTONES[sent] });
    sent++;
  }
}

export function startPlayTime() {
  if (started) return;
  started = true;
  lastTick = Date.now();
  setInterval(tick, TICK_MS);
}
