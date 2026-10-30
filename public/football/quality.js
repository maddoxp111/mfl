// The supplied HTML5 resize helper caps application_surface at 480x270.
// Keep its camera/GUI coordinates and sprite filtering, but render geometry at
// the actual canvas size instead of magnifying a small intermediate image.
(function () {
  const resize = window._RX;
  window._RX = function (surface, width, height) {
    if (surface >= 0 && surface === _ft._SX && canvas.width > 0 && canvas.height > 0) {
      width = canvas.width;
      height = canvas.height;
    }
    return resize(surface, width, height);
  };
})();
