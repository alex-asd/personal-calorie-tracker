import ProgressBar from './ProgressBar.jsx';

function sum(meals, key) {
  return meals.reduce((acc, m) => acc + (Number(m[key]) || 0), 0);
}

export default function TodayTotals({ meals, session }) {
  const calories = sum(meals, 'calories');
  const protein = sum(meals, 'protein');
  const carbs = sum(meals, 'carbs');
  const fat = sum(meals, 'fat');

  return (
    <section className="card">
      <h2>Today</h2>
      <div className="totals-grid">
        <div className="total">
          <div className="muted small">Calories</div>
          <div className="value">
            {Math.round(calories)}
            <span className="muted small"> / {session.calorie_target}</span>
          </div>
        </div>
        <div className="total">
          <div className="muted small">Protein</div>
          <div className="value">
            {Math.round(protein)}g<span className="muted small"> / {session.protein_target}g</span>
          </div>
        </div>
        <div className="total">
          <div className="muted small">Carbs</div>
          <div className="value">{Math.round(carbs)}g</div>
        </div>
        <div className="total">
          <div className="muted small">Fat</div>
          <div className="value">{Math.round(fat)}g</div>
        </div>
      </div>
      <div className="day-bars">
        <div className="bar-row">
          <ProgressBar
            value={calories}
            target={session.calorie_target}
            variant="calories"
            phase={session.phase}
          />
          <div className="bar-numeric">
            {Math.round(calories)}
            <span className="muted"> / {session.calorie_target}</span>
          </div>
        </div>
        <div className="bar-row">
          <ProgressBar value={protein} target={session.protein_target} variant="protein" />
          <div className="bar-numeric">
            {Math.round(protein)}g
            <span className="muted"> / {session.protein_target}g</span>
          </div>
        </div>
      </div>
    </section>
  );
}
