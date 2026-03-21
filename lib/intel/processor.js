import { parseSportmonksResponse } from './sportmonks-mapping.js';
import { generateProse } from './templates.js';
import { INTEL_CONFIG } from '../../config/intel.js';

const { THRESHOLDS } = INTEL_CONFIG;

/**
 * Build internal data sections (benchWatch, managerTendencies)
 * from our own DB tables.
 */
export function buildInternalSections(
  homeBenchStats,
  awayBenchStats,
  homeCoachPatterns,
  awayCoachPatterns,
  homeTopSupersubs,
  awayTopSupersubs,
  homeStandings,
  awayStandings
) {
  const sections = {};

  // ── Form Guide ────────────────────────────────────────────────────────────────
  const hasStandingsData = homeStandings || awayStandings;
  sections.formGuide = {
    source: 'internal',
    available: !!hasStandingsData,
    data: hasStandingsData ? {
      home: homeStandings ? {
        position: homeStandings.position,
        played: homeStandings.played,
        points: homeStandings.points,
        form: homeStandings.form,
      } : null,
      away: awayStandings ? {
        position: awayStandings.position,
        played: awayStandings.played,
        points: awayStandings.points,
        form: awayStandings.form,
      } : null,
    } : null,
    insight: null,
  };

  // ── Bench Watch ──────────────────────────────────────────────────────────────
  const hasBenchData = homeBenchStats || awayBenchStats ||
                       homeTopSupersubs?.length || awayTopSupersubs?.length;

  sections.benchWatch = {
    source: 'internal',
    available: !!hasBenchData,
    data: hasBenchData ? {
      home: homeBenchStats ? {
        benchGoalsPerMatch: homeBenchStats.total_bench_goals / Math.max(homeBenchStats.matches_played, 1),
        benchGoalPct: homeBenchStats.matches_played > 0
          ? (homeBenchStats.matches_with_bench_goal / homeBenchStats.matches_played) * 100
          : 0,
        topSupersub: homeTopSupersubs?.[0] ? {
          playerId: homeTopSupersubs[0].player_id,
          name: homeTopSupersubs[0].player_name,
          goalsAsSub: homeTopSupersubs[0].goals_as_sub,
          goalsPer90AsSub: homeTopSupersubs[0].minutes_as_sub > 0
            ? (homeTopSupersubs[0].goals_as_sub / homeTopSupersubs[0].minutes_as_sub) * 90
            : 0,
        } : null,
      } : null,
      away: awayBenchStats ? {
        benchGoalsPerMatch: awayBenchStats.total_bench_goals / Math.max(awayBenchStats.matches_played, 1),
        benchGoalPct: awayBenchStats.matches_played > 0
          ? (awayBenchStats.matches_with_bench_goal / awayBenchStats.matches_played) * 100
          : 0,
        topSupersub: awayTopSupersubs?.[0] ? {
          playerId: awayTopSupersubs[0].player_id,
          name: awayTopSupersubs[0].player_name,
          goalsAsSub: awayTopSupersubs[0].goals_as_sub,
          goalsPer90AsSub: awayTopSupersubs[0].minutes_as_sub > 0
            ? (awayTopSupersubs[0].goals_as_sub / awayTopSupersubs[0].minutes_as_sub) * 90
            : 0,
        } : null,
      } : null,
    } : null,
    insight: null,
  };

  // Determine bench insight
  if (sections.benchWatch.available && sections.benchWatch.data) {
    const homeGPM = sections.benchWatch.data.home?.benchGoalsPerMatch || 0;
    const awayGPM = sections.benchWatch.data.away?.benchGoalsPerMatch || 0;

    if (homeGPM >= THRESHOLDS.DANGEROUS_BENCH && awayGPM >= THRESHOLDS.DANGEROUS_BENCH) {
      sections.benchWatch.insight = 'both_benches_dangerous';
    } else if (homeGPM >= THRESHOLDS.DANGEROUS_BENCH) {
      sections.benchWatch.insight = 'home_bench_dangerous';
    } else if (awayGPM >= THRESHOLDS.DANGEROUS_BENCH) {
      sections.benchWatch.insight = 'away_bench_dangerous';
    } else {
      sections.benchWatch.insight = 'benches_quiet';
    }
  }

  // ── Manager Tendencies ───────────────────────────────────────────────────────
  const hasCoachData = homeCoachPatterns || awayCoachPatterns;

  sections.managerTendencies = {
    source: 'internal',
    available: !!hasCoachData,
    data: hasCoachData ? {
      home: homeCoachPatterns ? {
        coachId: homeCoachPatterns.coach_id,
        coachName: homeCoachPatterns.coach_name || null,
        avgFirstSubMinute: homeCoachPatterns.avg_first_sub_minute,
        subTimingStyle: homeCoachPatterns.avg_first_sub_minute < THRESHOLDS.EARLY_SUB_MINUTE ? 'early' :
                        homeCoachPatterns.avg_first_sub_minute > THRESHOLDS.LATE_SUB_MINUTE ? 'late' : 'standard',
        benchGoalPct: homeCoachPatterns.matches_managed > 0
          ? (homeCoachPatterns.matches_with_bench_goal / homeCoachPatterns.matches_managed) * 100
          : 0,
      } : null,
      away: awayCoachPatterns ? {
        coachId: awayCoachPatterns.coach_id,
        coachName: awayCoachPatterns.coach_name || null,
        avgFirstSubMinute: awayCoachPatterns.avg_first_sub_minute,
        subTimingStyle: awayCoachPatterns.avg_first_sub_minute < THRESHOLDS.EARLY_SUB_MINUTE ? 'early' :
                        awayCoachPatterns.avg_first_sub_minute > THRESHOLDS.LATE_SUB_MINUTE ? 'late' : 'standard',
        benchGoalPct: awayCoachPatterns.matches_managed > 0
          ? (awayCoachPatterns.matches_with_bench_goal / awayCoachPatterns.matches_managed) * 100
          : 0,
      } : null,
    } : null,
    insight: null,
  };

  // Determine manager insight
  if (sections.managerTendencies.available && sections.managerTendencies.data) {
    const homeStyle = sections.managerTendencies.data.home?.subTimingStyle;
    const awayStyle = sections.managerTendencies.data.away?.subTimingStyle;

    if (homeStyle === 'early') {
      sections.managerTendencies.insight = 'home_coach_proactive';
    } else if (awayStyle === 'early') {
      sections.managerTendencies.insight = 'away_coach_proactive';
    } else {
      sections.managerTendencies.insight = 'standard_patterns';
    }
  }

  return sections;
}

/**
 * Merge Sportmonks sections with internal sections.
 */
export function mergeSections(sportmonksSections, internalSections) {
  return {
    ...sportmonksSections,
    ...internalSections,
  };
}

/**
 * Full processing pipeline: parse Sportmonks, build internal data,
 * merge, and generate editorial prose.
 */
export function processMatchIntel({
  sportmonksRaw,
  homeBenchStats,
  awayBenchStats,
  homeCoachPatterns,
  awayCoachPatterns,
  homeTopSupersubs,
  awayTopSupersubs,
  homeStandings,
  awayStandings,
  homeTeam,
  awayTeam,
}) {
  // Parse Sportmonks predictions
  const sportmonksSections = parseSportmonksResponse(sportmonksRaw);
  const sportmonksAvailable = Object.values(sportmonksSections).some(s => s.available);

  // Build internal sections
  const internalSections = buildInternalSections(
    homeBenchStats,
    awayBenchStats,
    homeCoachPatterns,
    awayCoachPatterns,
    homeTopSupersubs,
    awayTopSupersubs,
    homeStandings,
    awayStandings
  );

  // Merge all sections
  const sections = mergeSections(sportmonksSections, internalSections);

  // Generate prose
  const prose = generateProse(sections, homeTeam, awayTeam);

  return {
    sportmonksAvailable,
    sections,
    prose,
  };
}
