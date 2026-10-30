// Run the supplied football engine in its own document: its input handlers,
// canvas, audio and globals must not take over the Arcade page.
(function () {
  MFLArcade.register('bowl', {
    start(ctx) {
      const token = crypto.randomUUID();
      ctx.root.innerHTML = `<div class="bowl-runtime"><p role="status">Loading Modern Bowl…</p><iframe title="Modern Bowl football game" allow="autoplay; fullscreen" style="display:block;width:100%;height:auto;aspect-ratio:16/9;max-height:80vh;border:0;background:#000" allowfullscreen></iframe><button type="button" class="btn ghost sm">Full screen</button></div>`;
      const frame = ctx.root.querySelector('iframe');
      const runtimeOrigin = new URL(window.MFL_API_ORIGIN || location.origin).origin;
      frame.src = runtimeOrigin + '/play/football';
      const status = ctx.root.querySelector('[role=status]');
      let finished = false;
      function receive(e) {
        if (e.source !== frame.contentWindow || e.origin !== runtimeOrigin) return;
        const msg = e.data || {};
        if (msg.type === 'mfl-football-ready') {
          frame.contentWindow.postMessage({ type: 'mfl-football-start', token, data: ctx.data, level: ctx.level, seed: ctx.seed }, runtimeOrigin);
        } else if (msg.token === token && msg.type === 'mfl-football-playing') {
          status.hidden = true;
          frame.focus();
        } else if (msg.token === token && msg.type === 'mfl-football-error') {
          status.hidden = false;
          status.textContent = 'Football could not load. Refresh to try again.';
        } else if (msg.token === token && msg.type === 'mfl-football-finish' && !finished) {
          finished = true;
          window.removeEventListener('message', receive);
          frame.remove(); // release the engine's audio and animation loop
          // The harness renders detail as HTML. Team labels remain plain text.
          const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
          ctx.finish({ ...msg.result, detail: `${esc(ctx.data.home.name)} ${msg.result.score} – ${msg.result.opp} ${esc(ctx.data.away.name)}` });
        }
      }
      window.addEventListener('message', receive);
      ctx.root.querySelector('button').addEventListener('click', () => {
        const request = frame.requestFullscreen || frame.webkitRequestFullscreen;
        if (request) Promise.resolve(request.call(frame)).catch(() => {});
      });
    },
  });
})();
