// Apply Arcade difficulty to effective on-field AI attributes after the native
// engine has assigned roles. Raw MFL player/card ratings remain unchanged.
(function () {
  const profiles = [
    { native: 2, defense: 5, rush: .065, linebacker: .105, secondary: .140, lineStrength: 6, strength: 2.5, coverage: .60 },
    { native: 3, defense: 7, rush: .080, linebacker: .125, secondary: .160, lineStrength: 8, strength: 3.5, coverage: .75 },
    { native: 4, defense: 9, rush: .095, linebacker: .145, secondary: .180, lineStrength: 10, strength: 4.75, coverage: .90 },
    { native: 4, defense: 10, rush: .110, linebacker: .165, secondary: .200, lineStrength: 12, strength: 6, coverage: 1 },
  ];
  function install(level) {
    const profile = profiles[Math.max(0, Math.min(3, Math.floor(Number(level) || 0)))];
    const skills = window._Y41;
    window._Y41 = function (self, other) {
      skills(self, other);
      if (self._lT) return;
      const line = self._O01 === 6, linebacker = self._O01 === 7;
      self._j51 = Math.max(self._j51, line ? profile.rush : linebacker ? profile.linebacker : profile.secondary);
      self._i51 = Math.max(self._i51, line ? profile.lineStrength : profile.strength);
    };
    // The native coverage brain often selects a 0.25–0.5 movement factor even
    // on Extreme. Give each level a distinct minimum commitment to its target.
    const cover = window._381;
    window._381 = function (self, other) {
      cover(self, other);
      if (!self._lT && self._O01 !== 6 && self._o71 > 0) {
        self._o71 = Math.max(self._o71, profile.coverage);
      }
    };
    return profile;
  }
  window.MFLFootballDifficulty = { profiles, install };
})();
