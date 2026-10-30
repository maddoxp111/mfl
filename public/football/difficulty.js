// Apply Arcade difficulty to effective on-field AI attributes after the native
// engine has assigned roles. Raw MFL player/card ratings remain unchanged.
(function () {
  const profiles = [
    { native: 2, defense: 5, rush: .045, linebacker: .075, secondary: .105, lineStrength: 4, strength: 1.6, coverage: .45 },
    { native: 3, defense: 7, rush: .055, linebacker: .090, secondary: .118, lineStrength: 5.3, strength: 2.3, coverage: .60 },
    { native: 4, defense: 9, rush: .065, linebacker: .103, secondary: .131, lineStrength: 6.6, strength: 3.05, coverage: .75 },
    // Legend is 80% of the previous All-Pro acceleration and strength, with
    // its .90 coverage commitment: measured pass-closing movement is also 80%.
    { native: 4, defense: 10, rush: .076, linebacker: .116, secondary: .144, lineStrength: 8, strength: 3.8, coverage: .90 },
  ];
  function install(level) {
    const profile = profiles[Math.max(0, Math.min(3, Math.floor(Number(level) || 0)))];
    const skills = window._Y41;
    window._Y41 = function (self, other) {
      skills(self, other);
      if (self._lT) return;
      const line = self._O01 === 6, linebacker = self._O01 === 7;
      // Set effective attributes, rather than floors: native Extreme values
      // would otherwise override the reduced settings and keep defense too fast.
      self._j51 = line ? profile.rush : linebacker ? profile.linebacker : profile.secondary;
      self._i51 = line ? profile.lineStrength : profile.strength;
    };
    // Keep native targets and stopping decisions, with a bounded movement
    // commitment per level so native sprint decisions cannot exceed the tuning.
    const cover = window._381;
    window._381 = function (self, other) {
      cover(self, other);
      if (!self._lT && self._O01 !== 6 && self._o71 > 0) {
        self._o71 = profile.coverage;
      }
    };
    return profile;
  }
  window.MFLFootballDifficulty = { profiles, install };
})();
