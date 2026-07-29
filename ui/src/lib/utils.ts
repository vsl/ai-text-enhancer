import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ERROR_MESSAGES } from "./constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns a user-friendly error message based on the error code.
 * Falls back to a generic message if the error code is not recognized.
 */
export function getErrorMessage(errorCode: string): string {
  return ERROR_MESSAGES[errorCode] || "An unexpected error occurred. Please try again.";
}
