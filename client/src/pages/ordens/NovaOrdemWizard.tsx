import { LancamentoWizard } from '../lancamento/LancamentoWizard.js';

// Unificação: a emissão de Ordem de Fornecimento e Novo Lançamento agora compartilham
// o mesmo assistente completo e unificado, garantindo assinatura automática do Jonatha,
// baixa imediata de estoque do contrato e fluxo em 2 tempos (emissão avulsa ou com NF).
export { LancamentoWizard as NovaOrdemWizard };
export default LancamentoWizard;
