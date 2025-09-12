// Placeholder de pull incremental.
// Mantém a assinatura básica esperada e não faz nenhuma operação de rede.
// Retorna uma função de "unsubscribe" para compatibilidade.

export function startIncrementalPull(options = {}) {
	console.warn('[pullIncremental] Placeholder ativo. Nenhum pull remoto será executado.', options)
	// Função de parada (compatível com padrões de subscribe)
	const unsubscribe = () => {
		console.warn('[pullIncremental] Placeholder unsubscribe chamado.')
	}
	return unsubscribe
}

// Caso alguém importe default por engano, ainda expomos algo útil.
export default { startIncrementalPull }
