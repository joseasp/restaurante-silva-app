// Utilidades de datas em timezone local

// Normaliza para um Date ajustado ao timezone local
function toLocal(dateInput = new Date()) {
	const d = dateInput instanceof Date ? new Date(dateInput) : new Date(dateInput)
	if (isNaN(d)) return null
	// Ajusta minutos para preservar a data local quando gerar ISO
	d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
	return d
}

// Retorna "YYYY-MM-DD" (chave do dia) em horário local
export function dayKey(dateInput = new Date()) {
	const d = toLocal(dateInput)
	return d ? d.toISOString().slice(0, 10) : ''
}

// Compara se duas datas caem no mesmo dia local
export function isSameDay(a, b) {
	if (!a || !b) return false
	return dayKey(a) === dayKey(b)
}

// Início do dia em ISO (local)
export function startOfDayISO(dateInput = new Date()) {
	const d = new Date(dateInput)
	d.setHours(0, 0, 0, 0)
	d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
	return d.toISOString()
}

// Fim do dia em ISO (local)
export function endOfDayISO(dateInput = new Date()) {
	const d = new Date(dateInput)
	d.setHours(23, 59, 59, 999)
	d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
	return d.toISOString()
}
