// ?v=bad: every keystroke rebuilds the whole table and reads each row's height back
// (a forced layout per row). ?v=good: rows are built once and filtered by toggling a class.
const bad = new URLSearchParams(location.search).get('v') === 'bad';
// Four of the ten customers have an "a" in their name, so the first keystroke of "acme" matches
// about 40% of invoices.
const names = [
  'Acme Hardware',
  'Bristow Print',
  'Calder Wines',
  'Dimbleby Florist',
  'Elmwood Trust',
  'Fox & Owl',
  'Greeves Joinery',
  'Harbour Theatre',
  'Juniper Bottle Co',
  'Ivy Lane Cafe',
];
const jobs = ['Letterheads', 'Wedding invitations', 'Business cards', 'Menus', 'Posters'];
const invoices = Array.from({ length: 2500 }, (_, i) => ({
  id: 10000 + i,
  customer: names[i % names.length],
  job: jobs[Math.floor(i / 10) % jobs.length],
  amount: (((i * 7919) % 100000) + 1500) / 100,
  due: new Date(2026, i % 12, (i % 28) + 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
}));
const tbody = document.getElementById('rows');
const count = document.getElementById('count');
const rowHtml = (inv) =>
  `<tr><td>FH-${inv.id}</td><td>${inv.customer}</td><td>${inv.job}</td><td>$${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td><td>${inv.due}</td></tr>`;

function renderAll(query) {
  const q = query.toLowerCase();
  const matches = invoices.filter((inv) => inv.customer.toLowerCase().includes(q));
  tbody.innerHTML = matches.map(rowHtml).join('');
  let tallest = 0;
  for (const tr of tbody.children) {
    tr.style.minHeight = tallest + 'px'; // write
    tallest = Math.max(tallest, tr.offsetHeight); // read: forces layout every row
  }
  count.textContent = `${matches.length.toLocaleString('en-US')} invoices`;
}

let rows = [];
function buildOnce() {
  tbody.innerHTML = invoices.map(rowHtml).join('');
  rows = [...tbody.children];
}
function filter(query) {
  const q = query.toLowerCase();
  let shown = 0;
  invoices.forEach((inv, i) => {
    const hit = inv.customer.toLowerCase().includes(q);
    rows[i].classList.toggle('hidden', !hit);
    if (hit) shown++;
  });
  count.textContent = `${shown.toLocaleString('en-US')} invoices`;
}

const search = document.getElementById('search');
if (bad) {
  renderAll('');
  search.addEventListener('input', function onSearchInput() {
    renderAll(search.value);
  });
} else {
  buildOnce();
  count.textContent = `${invoices.length.toLocaleString('en-US')} invoices`;
  search.addEventListener('input', function onSearchInput() {
    filter(search.value);
  });
}
