import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combine multiple class values into a single Tailwind-compatible class string.
 *
 * @param inputs - Values accepted by `clsx` (strings, arrays, objects, etc.) representing CSS class names
 * @returns The combined class string with Tailwind utility conflicts resolved by `twMerge`
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}