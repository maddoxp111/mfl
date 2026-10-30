// Adapt the supplied renderer without changing its animation or physics code.
(function () {
  MFLFootballLooks.install = function (players, home, away) {
    const looks = MFLFootballLooks;
    function appearance(self) {
      if (!self || self._851 === undefined) return null;
      if (players.has(self._7j)) return { look: players.get(self._7j), team: home };
      if (!self._lT && away.players?.length) {
        const p = away.players[(Math.max(1, self._851) - 1) % away.players.length];
        return { look: p.look || {}, team: away };
      }
      return null;
    }
    // Source atlas colors distinguish helmet, skin, sleeves and shoes. Preserve
    // the original palette shader and add arm/visor options for player draws.
    const shader = _Y._X1[0];
    shader._Z1 = shader._Z1.replace('void main()', 'uniform vec2 mflOptions;\nuniform vec4 mflHead;\nvoid main()')
      .replace('gl_FragColor = pixel;', `
        vec4 sourcePixel = texture2D(gm_BaseTexture, v_vTexcoord);
        bool head = v_vTexcoord.x >= mflHead.x && v_vTexcoord.y >= mflHead.y
          && v_vTexcoord.x < mflHead.z && v_vTexcoord.y < mflHead.w;
        if (mflOptions.x > 0.5 && !head && sourcePixel.a == 1.0
          && distance(sourcePixel.rgb, vec3(0.0,0.0,1.0)) < 0.009)
          pixel = vec4(replaceShirt, 1.0);
        if (mflOptions.y > 0.5 && sourcePixel.a == 1.0
          && distance(sourcePixel.rgb, vec3(158.0/255.0)) < 0.009)
          pixel = vec4(27.0/255.0,29.0/255.0,43.0/255.0,1.0);
        gl_FragColor = pixel;`);
    let options, head;
    const nativeUniforms = window._SQ;
    window._SQ = function (self, other) {
      nativeUniforms(self, other);
      if (options === undefined) { options = _uQ(0, 'mflOptions'); head = _uQ(0, 'mflHead'); }
      _UQ(options, 0, 0); // no appearance settings may leak into the next object
      const a = appearance(self);
      if (a) {
        _UQ(self._OQ, ...looks.normalized(looks.skin(a.look)));
        _UQ(self._PQ, ...looks.normalized(looks.cleats(a.team, a.look)));
      }
    };
    const nativeDraw = window._mh1;
    window._mh1 = function (...args) {
      const [self, sprite, frame] = args;
      const a = appearance(self);
      if (a && sprite === self.__T && (sprite >= 26 && sprite <= 60 || sprite === 195)) {
        const entries = _Y._e1[sprite]._l1;
        const index = Math.floor(frame < 0 ? self._K11 : frame) % entries.length;
        _UQ(options, a.look.sleeves ? 1 : 0, a.look.visor ? 1 : 0);
        _UQ(head, ...(looks.HEADS[entries[index]] || [0,0,0,0]));
        args[6] *= looks.HEIGHT[a.look.height] || 1;
      }
      return nativeDraw(...args);
    };
  };
})();
