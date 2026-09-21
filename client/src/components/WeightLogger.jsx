import { todayString } from '../dates.js';
import WeightEntry from './WeightEntry.jsx';

export default function WeightLogger({ disabled = false }) {
  return (
    <section className="card weight-logger">
      <WeightEntry
        date={todayString()}
        label={<h3>Today's weight</h3>}
        disabled={disabled}
        blockedMessage="Session is past day 90 — close it to log weight."
      />
    </section>
  );
}
