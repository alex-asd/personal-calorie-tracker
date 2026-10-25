// Nutrition fields accept small arithmetic expressions, so a slice of bread
// can be entered as "0.4 * 240" instead of being worked out beforehand.

const OPERATORS = {
  '+': '+',
  '-': '-',
  '*': '*',
  x: '*',
  '×': '*',
  '/': '/',
  '÷': '/',
  '(': '(',
  ')': ')',
};

function tokenize(text) {
  const src = text.trim();
  const token = /\s*(?:(\d+\.?\d*|\.\d+)|([-+*/x×÷()]))/iy;
  const tokens = [];
  while (token.lastIndex < src.length) {
    const m = token.exec(src);
    if (!m) return null;
    tokens.push(m[1] !== undefined ? Number(m[1]) : OPERATORS[m[2].toLowerCase()]);
  }
  return tokens;
}

// Evaluates + - * / (x and × also multiply, ÷ divides), parentheses, unary
// signs and decimals, rounded to 2 decimal places so 0.4 * 240 is 96 rather
// than 96.00000000000001. Returns null for empty or malformed input, and for
// division by zero. Hand-rolled parser — never eval().
export function evaluateExpression(text) {
  const tokens = tokenize(String(text ?? ''));
  if (!tokens || tokens.length === 0) return null;
  let pos = 0;

  function sum() {
    let value = product();
    while (tokens[pos] === '+' || tokens[pos] === '-') {
      const op = tokens[pos++];
      const rhs = product();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  function product() {
    let value = factor();
    while (tokens[pos] === '*' || tokens[pos] === '/') {
      const op = tokens[pos++];
      const rhs = factor();
      value = op === '*' ? value * rhs : value / rhs;
    }
    return value;
  }

  function factor() {
    const tok = tokens[pos++];
    if (typeof tok === 'number') return tok;
    if (tok === '-') return -factor();
    if (tok === '+') return factor();
    if (tok === '(') {
      const value = sum();
      if (tokens[pos++] !== ')') throw new SyntaxError('unclosed parenthesis');
      return value;
    }
    throw new SyntaxError('unexpected token');
  }

  try {
    const value = sum();
    if (pos !== tokens.length || !Number.isFinite(value)) return null;
    // `|| 0` folds -0 into 0.
    return Math.round(value * 100) / 100 || 0;
  } catch {
    return null;
  }
}

// A single field's value is usable when it evaluates to a non-negative number.
export function isValidMacro(value) {
  return value != null && value >= 0;
}

// Turns the meal forms' four text fields into API payload values, or null
// when calories/protein are missing or any field doesn't evaluate to a
// non-negative number. Carbs and fat may be left empty → null.
export function parseMacros({ calories, protein, carbs, fat }) {
  const macros = { calories, protein, carbs, fat };
  for (const [key, text] of Object.entries(macros)) {
    const optional = key === 'carbs' || key === 'fat';
    if (optional && text.trim() === '') {
      macros[key] = null;
      continue;
    }
    const value = evaluateExpression(text);
    if (!isValidMacro(value)) return null;
    macros[key] = value;
  }
  return macros;
}
