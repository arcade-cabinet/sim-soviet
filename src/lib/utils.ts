import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Compose class values into a single class string and resolve Tailwind CSS class conflicts.
 *
 * @param inputs - Class values (strings, arrays, objects, or mixed values accepted by `clsx`) to combine
 * @returns The resulting class string with Tailwind utility conflicts merged according to `tailwind-merge`
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}