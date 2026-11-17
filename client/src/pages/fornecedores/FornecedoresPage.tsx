import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Plus, Receipt, DollarSign, ArrowRight, Mail, Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '../../lib/api.js';
import type { Supplier } from '@cozam/shared';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Modal } from '../../components/ui/Modal.js';
import { Input } from '../../components/ui/Input.js';

export function FornecedoresPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [displayOrder, setDisplayOrder] = useState(100);
  const [isSimplesNacional, setIsSimplesNacional] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: suppliers, isLoading, refetch } = useQuery({
    queryKey: ['suppliers-admin'],
    queryFn: () => api.get<Supplier[]>('/suppliers?all=1'),
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        legal_name: legalName.trim() || null,
        cnpj: cnpj.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        contact_person: contactPerson.trim() || null,
        display_order: displayOrder,
        is_simples_nacional: isSimplesNacional,
      };
      if (selectedSupplier) {
        await api.patch(`/suppliers/${selectedSupplier.id}`, payload);
        toast.success('Fornecedor atualizado com sucesso!');
      } else {
        await api.post('/suppliers', payload);
        toast.success('Fornecedor cadastrado com sucesso!');
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setSelectedSupplier(null);
    setName('');
    setLegalName('');
    setCnpj('');
    setEmail('');
    setPhone('');
    setContactPerson('');
    setDisplayOrder(100);
    setIsSimplesNacional(false);
    setModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setSelectedSupplier(s);
    setName(s.name);
    setLegalName(s.legal_name || '');
    setCnpj(s.cnpj || '');
    setEmail(s.email || '');
    setPhone(s.phone || '');
    setContactPerson(s.contact_person || '');
    setDisplayOrder(s.display_order);
    setIsSimplesNacional(Boolean(s.is_simples_nacional));
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-heading">
            Fornecedores Ativos do Consórcio
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastro controlado dos fornecedores homologados para emissão de Ordens de Fornecimento
          </p>
        </div>

        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
          Adicionar Fornecedor
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suppliers?.map((s) => (
          <Card key={s.id} className="relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{s.name}</h3>
                    {s.display_order === 1 && (
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70">
                        Principal (~90%)
                      </span>
                    )}
                    {s.is_simples_nacional ? (
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        Simples Nacional (Isento IRRF)
                      </span>
                    ) : (
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        Regime Normal (Retenção 1,2% IRRF)
                      </span>
                    )}
                  </div>
                  {s.legal_name && <p className="text-xs text-slate-500 mt-0.5">{s.legal_name}</p>}
                  {s.cnpj && <p className="text-2xs text-slate-400 mt-0.5 font-mono">CNPJ: {s.cnpj}</p>}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs">
                    {s.email ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <Mail className="w-3.5 h-3.5" /> {s.email}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <Mail className="w-3.5 h-3.5" /> Sem e-mail cadastrado
                      </span>
                    )}
                    {s.phone && (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Phone className="w-3 h-3" /> {s.phone}
                      </span>
                    )}
                    {s.contact_person && (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <User className="w-3 h-3" /> {s.contact_person}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openEdit(s)}
                className="text-xs font-semibold text-slate-600 hover:text-emerald-700 px-2 py-1 rounded hover:bg-slate-100 cursor-pointer"
              >
                Editar
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Ordem de exibição: {s.display_order}</span>
              <Link
                to={`/notas?supplier_id=${s.id}`}
                className="text-emerald-700 font-semibold hover:underline flex items-center gap-1"
              >
                Ver Notas deste fornecedor <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal: Cadastro/Edição de Fornecedor */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Nome fantasia / identificação curta *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: MZ Bernardi ou Nacional"
            required
          />

          <Input
            label="Razão Social (opcional)"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="Nome empresarial completo..."
          />

          <Input
            label="CNPJ (opcional)"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
          />

          <Input
            label="E-mail para envio de OFs (Gmail)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="compras@fornecedor.com.br"
            helperText="Usado para abrir o Gmail automaticamente ao enviar Ordens de Fornecimento"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Telefone / WhatsApp (opcional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
            <Input
              label="Pessoa de contato (opcional)"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Ex: Maria Silva"
            />
          </div>

          <Input
            label="Ordem de exibição nas listas (menor aparece primeiro)"
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 100)}
            helperText="Defina 1 para MZ Bernardi aparecer no topo das listagens"
          />

          <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <input
              id="is-simples-nacional"
              type="checkbox"
              checked={isSimplesNacional}
              onChange={(e) => setIsSimplesNacional(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="is-simples-nacional" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <span className="font-semibold block text-slate-900 dark:text-slate-100">
                Optante pelo Simples Nacional
              </span>
              Fornecedores enquadrados no Simples Nacional possuem isenção de retenção na fonte (alíquota 0% de IRRF). Quando marcado, o pagamento de notas fiscais deste fornecedor virá pré-selecionado como isento de imposto.
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" loading={saving}>
              Salvar Fornecedor
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
