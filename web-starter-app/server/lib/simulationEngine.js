function round(value) {
  return Number(value.toFixed(1));
}

function riskFromMagnitude(type, value) {
  if (type === 'discount') {
    if (value <= 8) return 'low';
    if (value <= 18) return 'medium';
    return 'high';
  }

  if (value <= 5) return 'low';
  if (value <= 10) return 'medium';
  return 'high';
}

export function simulateScenario(scenario) {
  if (!scenario || typeof scenario !== 'object') {
    throw new Error('A valid scenario is required for simulation.');
  }

  const value = Number(scenario.value);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Scenario percentage must be a positive number.');
  }

  let demandChange;
  let revenueChange;
  let profitChange;

  if (scenario.type === 'discount') {
    demandChange = value * 1.6 - Math.max(0, value - 12) * 0.35;
    revenueChange = demandChange - value * 0.75;
    profitChange = demandChange * 0.4 - value * 1.25;
  } else if (scenario.type === 'price_increase') {
    demandChange = -(value * 1.15 + Math.max(0, value - 8) * 0.4);
    revenueChange = value + demandChange * 0.55;
    profitChange = value * 0.95 + demandChange * 0.35;
  } else {
    throw new Error('Scenario type must be "discount" or "price_increase".');
  }

  const risk = riskFromMagnitude(scenario.type, value);

  return {
    scenario,
    metrics: {
      demandChangePct: round(demandChange),
      revenueChangePct: round(revenueChange),
      profitChangePct: round(profitChange),
      risk,
    },
    narrative:
      scenario.type === 'discount'
        ? `The discount is expected to lift demand by about ${round(demandChange)}%, but margin pressure leaves profit ${profitChange >= 0 ? 'up' : 'down'} ${Math.abs(round(profitChange))}%.`
        : `The price increase should improve monetization, but a demand drop of about ${Math.abs(round(demandChange))}% keeps the overall risk ${risk}.`,
  };
}
