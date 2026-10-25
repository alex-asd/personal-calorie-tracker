import { useState } from 'react';
import { evaluateExpression, isValidMacro } from '../macros.js';

// Text input for a meal's calories/macros that also takes arithmetic
// ("0.4 * 240"). The result shows beside the label while typing and replaces
// the expression on blur, so the field ends up holding what will be saved.
export default function MacroInput({ label, value, onChange, required = false }) {
  const [focused, setFocused] = useState(false);
  const trimmed = value.trim();
  const result = evaluateExpression(value);
  const ok = isValidMacro(result);
  const showResult = ok && String(result) !== trimmed;
  const showError = !focused && trimmed !== '' && !ok;

  return (
    <label>
      <span className="macro-label">
        <span>{label}</span>
        {showResult && <span className="macro-result">= {result}</span>}
        {showError && <span className="macro-error">{result < 0 ? 'negative' : 'invalid'}</span>}
      </span>
      <input
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (showResult) onChange(String(result));
        }}
        aria-invalid={showError || undefined}
        required={required}
      />
    </label>
  );
}
