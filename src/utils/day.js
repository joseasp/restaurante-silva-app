// src/utils/day.js

// Retorna 'YYYY-MM-DD' para qualquer Date, string ou objeto com formato ISO
export function dayKey(x) {
  if (!x) return ''
  if (typeof x === 'string') return x.slice(0, 10)
  if (x instanceof Date) return x.toISOString().slice(0, 10)
  if (x && x.toISOString) return x.toISOString().slice(0, 10)
  return ''
}

// Compara se dois valores representam o mesmo dia (ignorando hora/timezone)
export function isSameDay(a, b) {
  return dayKey(a) === dayKey(b)
}
