import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Megaphone, ImagePlay, Users,
  Zap, Plug, ChevronDown, Plus, LogOut, Radio, Filter, MessageCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useProfiles } from '@/hooks/useProfiles';
import { useState } from 'react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/campaigns', icon: Megaphone, label: 'Anúncios' },
  { to: '/creatives', icon: ImagePlay, label: 'Criativos' },
  { to: '/audiences', icon: Users, label: 'Audiências' },
  { to: '/audience-funnel', icon: Filter, label: 'Funil de Público' },
  { to: '/crm-zap', icon: MessageCircle, label: 'CRM Zap' },
  { to: '/rules', icon: Zap, label: 'Automações' },
  { to: '/tracking', icon: Radio, label: 'Rastreamento' },
  { to: '/integrations', icon: Plug, label: 'Integrações' },
];

export function Sidebar() {
  const { user, activeProfile, logout, setActiveProfile } = useAuthStore();
  const { data: profiles } = useProfiles();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <span className="text-sm font-bold text-primary-foreground">O</span>
        </div>
        <span className="text-lg font-bold tracking-tight text-foreground">ORUS</span>
      </div>

      {/* Profile Selector */}
      <div className="px-3 py-3 border-b border-border">
        <button
          onClick={() => setProfileOpen(o => !o)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
        >
          <span className="font-medium truncate text-foreground">
            {activeProfile?.name ?? 'Selecionar Perfil'}
          </span>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', profileOpen && 'rotate-180')} />
        </button>

        {profileOpen && (
          <div className="mt-1 space-y-1 rounded-lg border border-border bg-background p-1 shadow-lg">
            {profiles?.map(p => (
              <button
                key={p.id}
                onClick={() => { setActiveProfile(p); setProfileOpen(false); }}
                className={cn(
                  'flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent',
                  activeProfile?.id === p.id && 'bg-accent text-accent-foreground font-medium'
                )}
              >
                {p.name}
              </button>
            ))}
            <button
              onClick={() => { navigate('/profiles/new'); setProfileOpen(false); }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Perfil
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-semibold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-foreground">{user?.name}</p>
            <p className="text-xs truncate text-muted-foreground">{user?.email}</p>
          </div>
          <button onClick={logout} className="text-muted-foreground hover:text-destructive transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
