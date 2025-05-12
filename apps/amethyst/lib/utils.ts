import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function capFirstLetter(str: string) {
  let arr = str.split("");
  let first = arr.shift()?.toUpperCase();
  return (first || "") + arr.join("");
}
