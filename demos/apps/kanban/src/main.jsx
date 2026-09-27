// ?v=bad: every card formats its description (a fake markdown pass) on every render, with no
// memoization, so sorting re-renders 400 cards at full cost. ?v=good: formatted once, memoized.
import { createRoot } from 'react-dom/client';
import { memo, useMemo, useState } from 'react';

const bad = new URLSearchParams(location.search).get('v') === 'bad';
// A bakery's production board for one morning: each card is an order, with its pickup time.
const bakes = [
  'Sourdough loaves',
  'Rye tin loaves',
  'Croissants',
  'Cinnamon buns',
  'Baguettes',
  'Seeded rolls',
  'Focaccia',
  'Brioche',
];
const customers = [
  'Harbour Cafe',
  'Ivy Lane Deli',
  'the market stall',
  'Calder Hotel',
  "St Anne's School",
  'walk-in orders',
];
const words = 'fold shape proof score bake cool pack label check crumb crust steam'.split(' ');
const pickups = ['5:30', '6:00', '6:30', '7:00', '7:30'];
const cards = Array.from({ length: 400 }, (_, i) => ({
  id: i,
  title: `${6 + ((i * 7) % 43)} ${bakes[i % bakes.length].toLowerCase()}`,
  customer: customers[(i * 5) % customers.length],
  priority: (i * 37) % 5,
  column: ['To bake', 'In the oven', 'Ready'][i % 3],
  description: Array.from({ length: 60 }, (_, j) => words[(i + j) % words.length]).join(' '),
}));

function formatDescription(text) {
  // Simulates a markdown renderer: tokenizes and rebuilds the text many times over.
  let out = text;
  for (let pass = 0; pass < 40; pass++) {
    out = out
      .split(' ')
      .map((w, i) => (i % 7 === 0 ? w.toUpperCase() : w.toLowerCase()))
      .join(' ');
  }
  return out.slice(0, 80) + '…';
}

function CardBody({ card, summary }) {
  return (
    <li className="card" data-steps={summary}>
      <div className="order">
        <strong>{card.title}</strong>
        <time>{pickups[card.priority]}</time>
      </div>
      <p>For {card.customer}</p>
    </li>
  );
}

function SlowCard({ card }) {
  const summary = formatDescription(card.description);
  return <CardBody card={card} summary={summary} />;
}

const FastCard = memo(function FastCard({ card }) {
  const summary = useMemo(() => formatDescription(card.description), [card.description]);
  return <CardBody card={card} summary={summary} />;
});

const Card = bad ? SlowCard : FastCard;

function Board() {
  const [byPriority, setByPriority] = useState(false);
  const sorted = useMemo(
    () => (byPriority ? [...cards].sort((a, b) => a.priority - b.priority) : cards),
    [byPriority],
  );
  function onSortClick() {
    setByPriority((p) => !p);
  }
  return (
    <main>
      <header>
        <div>
          <h1>Saturday bake</h1>
          <p>400 orders, first pickup at 5:30</p>
        </div>
        <button id="sort" onClick={onSortClick} aria-pressed={byPriority}>
          <span className="label">{byPriority ? 'Sorted by pickup time' : 'Sort by pickup time'}</span>
        </button>
      </header>
      <div className="columns">
        {['To bake', 'In the oven', 'Ready'].map((col) => (
          <section key={col} className={col === 'In the oven' ? 'oven' : col === 'Ready' ? 'ready' : ''}>
            <h2>
              {col} <span>{cards.filter((c) => c.column === col).length}</span>
            </h2>
            <ul>
              {sorted
                .filter((c) => c.column === col)
                .map((c) => (
                  <Card key={c.id} card={c} />
                ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<Board />);
