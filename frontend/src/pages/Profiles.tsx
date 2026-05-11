import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight } from 'lucide-react';
import { useProfiles, useCreateProfile } from '@/hooks/useProfiles';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export function Profiles() {
  const navigate = useNavigate();
  const { setActiveProfile } = useAuthStore();
  const { data: profiles } = useProfiles();
  const create = useCreateProfile();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const profile = await create.mutateAsync({ name });
    setActiveProfile(profile);
    navigate('/dashboard');
  }

  function selectProfile(profile: any) {
    setActiveProfile(profile);
    navigate('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg">
            <span className="text-xl font-bold text-primary-foreground">O</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Selecionar Perfil</h1>
          <p className="mt-1 text-sm text-muted-foreground">Escolha um projeto para trabalhar</p>
        </div>

        <div className="space-y-3 mb-6">
          {profiles?.map(profile => (
            <button
              key={profile.id}
              onClick={() => selectProfile(profile)}
              className="w-full flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:bg-accent/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {profile.name[0].toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">{profile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {profile._count?.integrations ?? 0} integração(ões) · {profile._count?.campaigns ?? 0} campanha(s)
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>

        <Card>
          <CardContent className="p-4">
            {creating ? (
              <form onSubmit={handleCreate} className="flex gap-2">
                <Input
                  placeholder="Nome do perfil (ex: Rainha do Slot)"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />
                <Button type="submit" disabled={!name.trim() || create.isPending}>
                  Criar
                </Button>
                <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                  Cancelar
                </Button>
              </form>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                <Plus className="h-4 w-4" />
                Criar novo perfil
              </button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
