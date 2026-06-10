import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...i: ClassValue[]): string { return twMerge(clsx(i)); }
