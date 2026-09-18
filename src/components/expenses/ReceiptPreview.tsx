import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Expense } from '../../types';

/**
 * Receipts stored by the API need the Authorization header, so a bare <img src> can't load them.
 * Fetch them as a blob instead. Externally hosted receipts (old demo data) are shown directly.
 */
export const ReceiptPreview: React.FC<{ expense: Expense }> = ({ expense }) => {
  const [file, setFile] = useState<{ url: string; type: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = expense.receiptUrl;
    setFile(null);
    setError(null);
    if (!url) return;
    if (!url.startsWith('/api/')) {
      setFile({ url, type: 'image/*' });
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    api
      .blobUrl(url)
      .then((result) => {
        objectUrl = result.url;
        if (cancelled) URL.revokeObjectURL(result.url);
        else setFile(result);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load the receipt.'));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [expense.receiptUrl]);

  if (error) return <p className="text-xs text-rose-700 p-4 text-center">{error}</p>;
  if (!file) return <p className="text-xs text-slate-400 p-4 text-center">Loading receipt…</p>;

  return file.type === 'application/pdf' ? (
    <iframe src={file.url} title="Receipt PDF" className="w-full h-full bg-white" />
  ) : (
    <img src={file.url} alt="Receipt preview" className="w-full h-full object-contain" />
  );
};
