export function createClock({ demoToday } = {}) {
  return {
    now() { return demoToday ? new Date(`${demoToday}T12:00:00.000Z`) : new Date(); },
    today() { return this.now().toISOString().slice(0, 10); }
  };
}
