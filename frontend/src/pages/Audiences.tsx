import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Download, Users, Filter } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { Audience } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const FILTER_OPTIONS = [
  { key: 'type', label: 'Tipo de Conversão', values: ['LEAD', 'PURCHASE'] },
  { key: 'days', label: 'Últimos N dias', type: 'number' },
  { key: 'siteCampaignId', label: 'Campanha do Site', type: 'text' },
];

export function Audiences() {
  const { activeProfile } = useAuthStore();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', filters: {} as Record<string, unknown> });

  const { data: audiences, isLoading } = useQuery<Audience[]>({
    queryKey: ['audiences', activeProfile?.id],
    queryFn: () => api.get(`/audiences/profile/${activeProfile!.id}`).then(r => r.data),
    enabled: !!activeProfile,
  });

  const create = useMutation({
    mutationFn: (body: typeof form) =>
      api.post(`/audiences/profile/${activeProfile!.id}`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audiences', activeProfile?.id] });
      setShowForm(false);
    },
  });

  const handleExport = (id: string, name: string) => {
    const url = `${import.meta.env.VITE_API_URL ?? ''}/api/audiences/${id}/export`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.csv`;
    a.click();
  };

  if (!activeProfile) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Selecione um perfil.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audiências</h1>
          <p className="text-sm text-muted-foreground mt-1">{activeProfile.name}</p>
        </div>
        <Button onClick={() => setShowForm(s => !s)}>
          <Plus className="h-4 w-4" />
          Nova Audiência
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Criar Audiência</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
                <Input
                  placeholder="Ex: Compradores Últimos 30 dias"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
                <Input
                  placeholder="Descrição opcional"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Filter className="h-3 w-3" /> Filtros
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tipo de Evento</label>
                  <select
                    onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, type: e.target.value } }))}
                    className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                  >
                    <option value="">Todos</option>
                    <option value="LEAD">Leads</option>
                    <option value="PURCHASE">Compras</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Últimos N dias</label>
                  <Input
                    type="number"
                    placeholder="30"
                    onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, days: parseInt(e.target.value) } }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Campanha do Site</label>
                  <Input
                    placeholder="ID ou nome"
                    onChange={e => setForm(f => ({ ...f, filters: { ...f.filters, siteCampaignId: e.target.value } }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={() => create.mutate(form)} disabled={!form.name || create.isPending}>
                Criar Audiência
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{audiences?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Audiências</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {formatNumber(audiences?.reduce((a, b) => a + (b._count?.members ?? 0), 0) ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">Usuários Totais</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Filter className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {audiences?.filter(a => a.status === 'ACTIVE').length ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Ativas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-card animate-pulse border border-border" />
          ))
        ) : audiences?.map(audience => (
          <div
            key={audience.id}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{audience.name}</p>
                {audience.description && (
                  <p className="text-xs text-muted-foreground">{audience.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatNumber(audience._count?.members ?? 0)} usuários
                  {audience.lastBuiltAt && ` · atualizado ${format(new Date(audience.lastBuiltAt), "dd/MM 'às' HH:mm", { locale: ptBR })}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={audience.status === 'ACTIVE' ? 'success' : 'secondary'}>
                {audience.status === 'ACTIVE' ? 'Ativa' : 'Arquivada'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport(audience.id, audience.name)}
              >
                <Download className="h-3.5 w-3.5" />
                Exportar CSV
              </Button>
            </div>
          </div>
        ))}

        {!isLoading && !audiences?.length && (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">Nenhuma audiência criada.</p>
          </div>
        )}
      </div>
    </div>
  );
}
