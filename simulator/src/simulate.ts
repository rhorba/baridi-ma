export interface SimulatorConfig {
  baseTempC: number;
  baseHumidityPct: number;
  excursionProbability: number; // 0-1 chance per tick of starting a new excursion
  excursionMagnitudeC: number; // how far temperature drifts during an excursion
}

export interface SimulatorState {
  temperatureC: number;
  humidityPct: number;
  excursionReadingsLeft: number;
}

const EXCURSION_DURATION_READINGS = 3;

export function initialState(config: SimulatorConfig): SimulatorState {
  return { temperatureC: config.baseTempC, humidityPct: config.baseHumidityPct, excursionReadingsLeft: 0 };
}

// `random` is injectable so the excursion/jitter behavior is deterministically testable.
export function nextReading(
  state: SimulatorState,
  config: SimulatorConfig,
  random: () => number = Math.random,
): SimulatorState {
  let excursionReadingsLeft = state.excursionReadingsLeft;
  let target = config.baseTempC;

  if (excursionReadingsLeft > 0) {
    target = config.baseTempC + config.excursionMagnitudeC;
    excursionReadingsLeft -= 1;
  } else if (random() < config.excursionProbability) {
    target = config.baseTempC + config.excursionMagnitudeC;
    excursionReadingsLeft = EXCURSION_DURATION_READINGS;
  }

  const tempJitter = (random() - 0.5) * 0.6;
  const humidityJitter = (random() - 0.5) * 4;

  return {
    temperatureC: Math.round((target + tempJitter) * 10) / 10,
    humidityPct: Math.round((config.baseHumidityPct + humidityJitter) * 10) / 10,
    excursionReadingsLeft,
  };
}
