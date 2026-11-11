# Documento de Design — Municípios em OF/NF/Relatórios, Retenção Tributária (IRRF 1,2%) e Simples Nacional

**Data:** 11 de Novembro de 2026  
**Status:** Aprovado para Planejamento e Execução  
**Autor:** Antigravity AI & Gestão COZAM  

---

## 1. Contexto e Motivação (Intent & The Why)

Durante o processo de homologação operacional e uso prático do **COZAM — Sistema Integrado de Compras e Pagamentos**, foram identificadas duas necessidades contábeis e administrativas críticas para a rotina do Consórcio Intermunicipal da Zona da Mata Alagoana:

1. **Gestão e Visibilidade de Municípios em Toda a Cadeia Documental:**
   - A informação do município consorciado precisa estar vinculada não apenas à Nota Fiscal, mas também à **Ordem de Fornecimento (OF)**.
   - O município precisa ser visível de forma padronizada em **todas as telas com tabelas** (Processos, Ordens de Fornecimento, Notas Fiscais, Fila e Histórico de Pagamentos).
   - Ao exportar dados e relatórios para **Excel** e **PDF**, a coluna de Município deve estar presente para permitir filtragem, conferência e prestação de contas por prefeitura.

2. **Retenção Tributária de Imposto de Renda (IRRF - 1,2%) na Liquidação:**
   - Notas fiscais emitidas por fornecedores **não optantes pelo Simples Nacional** sofrem retenção legal de imposto (alíquota padrão de **1,2%**).
   - No momento da liquidação (seja pagamento total ou parcelado), o operador do setor de Pagamentos deve visualizar com clareza a separação entre:
     - **Valor Bruto Liquidado / Abatimento da NF** (valor que deduz do saldo da nota fiscal);
     - **Alíquota aplicada** (1,2%);
     - **Valor Líquido** (valor real a ser creditado ao fornecedor);
     - **Imposto Retido (IRRF)** (valor descontado a ser recolhido).
   - Em pagamentos parciais, o imposto incide proporcionalmente sobre cada parcela.
   - Deve existir uma opção com checkbox **"Pagamento sem imposto"** no modal de liquidação, que zera a retenção caso o pagamento seja isento.
   - No cadastro de fornecedores, deve haver a flag **"Optante pelo Simples Nacional"**: caso o fornecedor seja do Simples, a opção "Pagamento sem imposto" já virá pré-marcada por padrão no momento do pagamento, mantendo-se editável pelo operador.

---

## 2. Objetivos, Não-Objetivos e Anti-Objetivos

### Objetivos:
- Adicionar a coluna `municipality` na tabela `supply_orders` e atualizar a view `v_supply_orders`.
- Permitir a seleção de município no cadastro e edição de Ordens de Fornecimento (`LancamentoWizard` e componentes de OF).
- Exibir badge e coluna de município nas listagens de Processos, Ordens de Fornecimento, Notas Fiscais e Pagamentos.
- Incluir a coluna de Município nas exportações para Excel (`excel.ts`) e nos demonstrativos analíticos (`reports.ts`).
- Adicionar a coluna `is_simples_nacional` na tabela `suppliers` e no cadastro/edição de fornecedores.
- Adicionar colunas de retenção tributária na tabela `payments` (`gross_amount`, `tax_rate`, `tax_amount`, `net_amount`, `is_tax_exempt`).
- Implementar no modal de pagamento (`NotaFiscalDetail` e `PainelPagamentos`) o cálculo automático em tempo real da alíquota de 1,2%, valor líquido e imposto retido, com checkbox "Pagamento sem imposto".
- No histórico de pagamentos e recibos, detalhar o valor bruto, o imposto retido e o valor líquido pago.

### Não-Objetivos:
- Não construir um motor genérico de parametrização fiscal complexa com dezenas de tributos federativos simultâneos (foco objetivo na alíquota padrão de 1,2% de IRRF para fornecedores fora do Simples Nacional).
- Não alterar as regras de validação de saldo devedor existente (o abatimento da nota fiscal continua sendo pelo valor bruto liquidado).

### Anti-Objetivos (O que não pode acontecer):
- **Perda de Dados:** Preservação de 100% dos dados já gravados em produção no Supabase. Nenhuma migração destrutiva.
- **Divergência Financeira:** O valor que abate a nota fiscal não pode divergir da soma `net_amount + tax_amount = gross_amount`.

---

## 3. Arquitetura e Modelo de Dados

### 3.1. Migração Aditiva no Banco de Dados (`supabase/migrations/`)
```sql
-- 1. Município nas Ordens de Fornecimento
ALTER TABLE public.supply_orders ADD COLUMN IF NOT EXISTS municipality text;

-- 2. Fornecedores: flag de Simples Nacional
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_simples_nacional boolean NOT NULL DEFAULT false;

-- 3. Pagamentos: discriminação tributária
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS gross_amount numeric(14,2);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS tax_rate numeric(5,4) DEFAULT 0.0120;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS tax_amount numeric(14,2) DEFAULT 0.00;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS net_amount numeric(14,2);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS is_tax_exempt boolean DEFAULT false;

-- Atualizar registros legados de pagamentos: gross_amount = amount, net_amount = amount
UPDATE public.payments 
SET gross_amount = amount, net_amount = amount, tax_amount = 0.00, is_tax_exempt = true 
WHERE gross_amount IS NULL;
```

### 3.2. Regras de Cálculo
```typescript
export function calculatePaymentTaxes(grossAmount: number, isTaxExempt: boolean, taxRate: number = 0.012) {
  if (isTaxExempt || grossAmount <= 0) {
    return {
      grossAmount,
      taxRate: 0,
      taxAmount: 0,
      netAmount: grossAmount,
      isTaxExempt: true,
    };
  }
  const taxAmount = Math.round(grossAmount * taxRate * 100) / 100;
  const netAmount = Math.round((grossAmount - taxAmount) * 100) / 100;
  return {
    grossAmount,
    taxRate,
    taxAmount,
    netAmount,
    isTaxExempt: false,
  };
}
```

---

## 4. Interfaces e Telas Afetadas

1. **`client/src/pages/lancamento/LancamentoWizard.tsx`:** Adicionar `MunicipalitySelect` na etapa de OF.
2. **`client/src/pages/ordens/`:** Coluna de município na lista e cabeçalho nos detalhes.
3. **`client/src/pages/fornecedores/`:** Checkbox "Optante pelo Simples Nacional" no cadastro/edição de fornecedor.
4. **`client/src/pages/notas/NotaFiscalDetail.tsx` & `PainelPagamentos.tsx`:**
   - Modal de Pagamento: Cards visuais de resumo tributário com valor líquido e imposto destacados.
   - Checkbox "Pagamento sem imposto".
   - Tabela de histórico de pagamentos exibindo Bruto, Retenção (IRRF) e Líquido Pago.
5. **`client/src/lib/export/excel.ts` & `server/src/routes/reports.ts`:**
   - Colunas de Município em relatórios e planilhas geradas.
   - Discriminação de impostos retidos nos relatórios de pagamentos.
