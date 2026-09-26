"use client";
import { useEffect } from 'react';
export default function PwaRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Browser tanpa service worker tetap mendukung input teks/screenshot/link.
    });
  }, []);
  return null;
}
