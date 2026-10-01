// ?wait= wall-clock ms per scroll event; ?work= iterations per scroll event.
const scrollWait = param('wait', 0);
const scrollWork = param('work', 0);

const list = document.getElementById('list');
for (let i = 0; i < 600; i++) {
  const li = document.createElement('li');
  li.textContent = 'Article ' + i;
  list.appendChild(li);
}

window.addEventListener('scroll', function onWindowScroll() {
  if (scrollWait) busyWait(scrollWait);
  if (scrollWork) doWork(scrollWork);
});

// ?smooth=1: a "smooth scroll" script, like the ones in smooth-scrolling libraries. It takes over
// the wheel, keeps its own position, and sets the page's on every frame, starting from wherever
// the page was when it loaded.
if (param('smooth', 0)) {
  let target = window.scrollY;
  let current = window.scrollY;
  addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      target = Math.max(
        0,
        Math.min(document.documentElement.scrollHeight - window.innerHeight, target + e.deltaY),
      );
    },
    { passive: false },
  );
  requestAnimationFrame(function smoothScroll() {
    current += (target - current) * 0.3;
    if (Math.abs(target - current) < 0.5) current = target;
    window.scrollTo(0, current);
    requestAnimationFrame(smoothScroll);
  });
}
