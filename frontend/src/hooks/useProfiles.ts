import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Profile } from '@/types';
import { useAuthStore } from '@/store/authStore';

export function useProfiles() {
  const setProfiles = useAuthStore(s => s.setProfiles);

  return useQuery<Profile[]>({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await api.get('/profiles');
      setProfiles(data);
      return data;
    },
  });
}

export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; logoUrl?: string }) =>
      api.post('/profiles', body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });
}
