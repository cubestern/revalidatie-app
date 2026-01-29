// recommender.js
// Minimal, dependency-free content-based recommender for exercises.json
// Usage:
//   import { loadExercises, recommend } from './recommender.js';
//   const exercises = await loadExercises('./exercises.json');
//   const picks = recommend(profile, exercises);

export async function loadExercises(url = './exercises.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return await res.json();
}

// Helper: set intersection size
function overlap(a = [], b = []) {
  const setB = new Set(b);
  let n = 0;
  for (const x of a) if (setB.has(x)) n++;
  return n;
}

function hasAny(a = [], b = []) {
  const setB = new Set(b);
  for (const x of a) if (setB.has(x)) return true;
  return false;
}

/**
 * profile shape (suggestion)
 * {
 *   goals: ['mobility','rehab'...],
 *   areas: ['shoulder','knee'...],      // up to 2
 *   feels: ['stiff_tight'...],         // 1-2
 *   intensity: 'low'|'medium'|'high',
 *   timeMinutes: 5|10|20,
 *   equipment: ['none','wall','band'...],
 *   avoid: ['kneeling','wrists_load'...] // constraints
 * }
 */
export function recommend(profile, exercises, opts = {}) {
  const {
    maxResults = autoMax(profile?.timeMinutes),
    maxPerPattern = 2,
    allowTrendOverlay = true,
  } = opts;

  const intensityRank = { low: 1, medium: 2, high: 3 };
  const userIntensity = intensityRank[profile?.intensity || 'medium'] ?? 2;

  // Hard filters
  const filtered = exercises.filter(ex => {
    // equipment: if user listed equipment, exercise must be doable with subset of that
    if (profile?.equipment?.length) {
      // if exercise requires equipment tags not in user equipment, exclude
      // We treat 'none' as always possible.
      const req = ex.tag_equipment || [];
      const userEq = new Set(profile.equipment);
      for (const r of req) {
        if (r === 'none') continue;
        if (!userEq.has(r)) return false;
      }
    }
    // avoid constraints
    if (profile?.avoid?.length && hasAny(ex.tag_contra || [], profile.avoid)) return false;
    // intensity: don't recommend higher than user, unless explicitly allowed
    const exI = intensityRank[ex.tag_intensity || 'medium'] ?? 2;
    if (exI > userIntensity) return false;
    return true;
  });

  // Scoring
  const scored = filtered.map(ex => {
    let score = 0;

    // goals are most important
    if (profile?.goals?.length) score += 3 * overlap(ex.tag_goal, profile.goals);

    // areas matter a lot (esp. rehab/stretches)
    if (profile?.areas?.length) score += 2 * overlap(ex.tag_area, profile.areas);

    // "feel" helps distinguish: stiff vs unstable vs sensitive
    if (profile?.feels?.length) score += 2 * overlap(ex.tag_feel, profile.feels);

    // mild preference for time cost
    if (profile?.timeMinutes != null) {
      const desired = profile.timeMinutes <= 5 ? 'short' : profile.timeMinutes <= 12 ? 'short' : 'medium';
      if (ex.tag_time_cost === desired) score += 1;
    }

    // soft preference: matching equipment tags (if provided)
    if (profile?.equipment?.length) score += 1 * overlap(ex.tag_equipment, profile.equipment);

    // tiny bump for posture/stability when user chose strength but also wants shoulder/back
    if (profile?.goals?.includes('strength') && hasAny(profile?.areas || [], ['shoulder','thoracic','lowback_core'])) {
      if ((ex.tag_goal || []).includes('stability') || (ex.tag_goal || []).includes('posture')) score += 0.5;
    }

    // discourage duplicates: later handled via pattern cap, but give small bump for variety
    score += 0.1 * (ex.tag_pattern?.length ? 1 : 0);

    return { ex, score };
  }).sort((a, b) => b.score - a.score);

  // Diversity: cap per movement pattern
  const picks = [];
  const patternCounts = new Map();
  for (const { ex, score } of scored) {
    const patterns = ex.tag_pattern?.length ? ex.tag_pattern : ['general'];
    const key = patterns[0]; // primary pattern
    const c = patternCounts.get(key) || 0;
    if (c >= maxPerPattern) continue;
    if (score <= 0 && picks.length >= Math.min(3, maxResults)) break;

    picks.push(ex);
    patternCounts.set(key, c + 1);
    if (picks.length >= maxResults) break;
  }

  // Trend overlay: add max 1 "trend" item that matches goals/areas, if not already present
  if (allowTrendOverlay && profile?.intensity !== 'low') {
    const alreadyTrend = picks.some(p => (p.tag_goal || []).includes('trend'));
    if (!alreadyTrend) {
      const trendCandidate = scored
        .map(s => s.ex)
        .filter(ex => (ex.tag_goal || []).includes('trend'))
        .find(ex => {
          const goalOk = profile?.goals?.length ? overlap(ex.tag_goal, profile.goals) > 0 : true;
          const areaOk = profile?.areas?.length ? overlap(ex.tag_area, profile.areas) > 0 : true;
          return goalOk || areaOk;
        });
      if (trendCandidate) picks.push(trendCandidate);
    }
  }

  return picks;
}

function autoMax(timeMinutes) {
  if (!timeMinutes) return 5;
  if (timeMinutes <= 5) return 3;
  if (timeMinutes <= 10) return 5;
  if (timeMinutes <= 20) return 7;
  return 9;
}
