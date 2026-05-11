import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

export function formatROAS(value: number) {
  return `${value.toFixed(2)}x`;
}

export function getGreeting(name: string) {
  const hour = new Date().getHours();
  if (hour < 12) return `Bom dia, ${name.split(' ')[0]}`;
  if (hour < 18) return `Boa tarde, ${name.split(' ')[0]}`;
  return `Boa noite, ${name.split(' ')[0]}`;
}
