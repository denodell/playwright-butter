// ?slow=N makes opening the filters panel block the main thread for N ms: the example's
// stand-in for a regression.
const slow = Number(new URLSearchParams(location.search).get('slow') || 0);

const titles = [
  'How the night bus network was redrawn',
  'A field guide to urban foxes',
  'Why your sourdough starter smells of nail varnish',
  'The last lighthouse keepers',
  'Repairing a bike wheel at the roadside',
  'What the tide tables leave out',
  'Learning to read contour lines',
];
const sources = ['The Weekend Review', 'Field Notes', 'Kitchen Letters', 'Coastal Quarterly'];
const list = document.getElementById('articles');
for (let i = 0; i < 1500; i++) {
  const li = document.createElement('li');
  li.innerHTML = `<span class="thumb" style="background:hsl(${(i * 47) % 360} 40% 74%)"></span><span>${titles[i % titles.length]}<small>${sources[i % sources.length]}, ${4 + (i % 17)} min read</small></span>`;
  list.appendChild(li);
}

document.getElementById('filters').addEventListener('click', function toggleFilters(event) {
  const panel = document.getElementById('panel');
  const start = performance.now();
  while (performance.now() - start < slow) {
    // simulated expensive work
  }
  panel.hidden = !panel.hidden;
  event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
});
