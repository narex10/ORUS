import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Profile } from '@/types';
import { api } from '@/lib/api';

interface AuthState {
  token: string | null;
  user: User | null;
  activeProfile: Profile | null;
  profiles: Profile[];

  setToken: (token: string) => void;
  setUser: (user: User) => void;
  setActiveProfile: (profile: Profile) => void;
  setProfiles: (profiles: Profile[]) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      activeProfile: null,
      profiles: [],

      setToken: (token) => {
        localStorage.setItem('orus_token', token);
        set({ token });
      },
      setUser: (user) => set({ user }),
      setActiveProfile: (profile) => set({ activeProfile: profile }),
      setProfiles: (profiles) => set({ profiles }),
      logout: () => {
        localStorage.removeItem('orus_token');
        api.post('/auth/logout').catch(() => {});
        set({ token: null, user: null, activeProfile: null, profiles: [] });
      },
    }),
    {
      name: 'orus-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        activeProfile: state.activeProfile,
      }),
    }
  )
);
