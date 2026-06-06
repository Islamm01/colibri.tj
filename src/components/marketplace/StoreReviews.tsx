'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  customer_name: string | null;
  created_at: string;
}

interface Summary {
  rating: number;
  count: number;
  breakdown: Record<number, number>;
}

export function StoreReviews({ storeId, locale }: { storeId: string; locale: string }) {
  const t = useTranslations('reviews');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<Summary>({ rating: 0, count: 0, breakdown: {} });
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/stores/${storeId}/reviews`);
      const data = await res.json();
      setReviews(data.reviews ?? []);
      setSummary(data.summary ?? { rating: 0, count: 0, breakdown: {} });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [storeId]);

  if (loading) {
    return <div className="px-5 py-6"><div className="h-24 surface-soft rounded-2xl animate-pulse" /></div>;
  }

  return (
    <section className="px-5 pt-2 pb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-medium text-cream-100/45 tracking-[1.4px] uppercase">{t('title')}</h2>
        <button onClick={() => setWriting(true)} className="text-[12px] font-medium text-gold-300 hover:text-cream-100">
          {t('writeButton')}
        </button>
      </div>

      {summary.count === 0 ? (
        <div className="surface rounded-2xl border border-gold-300/10 p-6 text-center shadow-soft">
          <div className="text-[32px] mb-1">⭐</div>
          <p className="text-[13px] text-cream-100/55">{t('empty')}</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="surface rounded-2xl border border-gold-300/10 p-4 shadow-soft mb-3">
            <div className="flex items-center gap-4">
              <div className="text-center shrink-0">
                <div className="font-serif text-[34px] text-cream-100 leading-none">{summary.rating.toFixed(1)}</div>
                <Stars value={Math.round(summary.rating)} />
                <div className="text-[11px] text-cream-100/55 mt-1">{t('count', { count: summary.count })}</div>
              </div>
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const n = summary.breakdown[star] ?? 0;
                  const pct = summary.count > 0 ? (n / summary.count) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2">
                      <span className="text-[10px] text-cream-100/55 w-2">{star}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-forest-700 overflow-hidden">
                        <div className="h-full bg-gold-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Comments */}
          <div className="space-y-2.5">
            {reviews.filter((r) => r.comment).map((r) => (
              <div key={r.id} className="surface rounded-2xl border border-gold-300/10 p-4 shadow-soft">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-medium text-cream-100">{r.customer_name || t('anon')}</span>
                  <Stars value={r.rating} small />
                </div>
                <p className="text-[13px] text-cream-100 leading-relaxed">{r.comment}</p>
                <div className="text-[10px] text-cream-100/35 mt-1.5">
                  {new Date(r.created_at).toLocaleDateString(locale === 'tj' ? 'tg' : 'ru', { day: 'numeric', month: 'long' })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {writing && (
        <WriteReviewModal
          storeId={storeId}
          onClose={() => setWriting(false)}
          onDone={() => { setWriting(false); load(); }}
        />
      )}
    </section>
  );
}

function Stars({ value, small }: { value: number; small?: boolean }) {
  const sz = small ? 12 : 14;
  return (
    <div className="flex items-center gap-0.5 justify-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={sz} height={sz} viewBox="0 0 24 24" fill="currentColor" className={i <= value ? 'text-gold-400' : 'text-black/10'}>
          <path d="m12 2 3 7 7 .7-5.5 4.7 1.7 7L12 17.6 5.8 21.4l1.7-7L2 9.7 9 9l3-7Z" />
        </svg>
      ))}
    </div>
  );
}

function WriteReviewModal({ storeId, onClose, onDone }: { storeId: string; onClose: () => void; onDone: () => void }) {
  const t = useTranslations('reviews');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (rating < 1) { setError(t('pickRating')); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/stores/${storeId}/reviews/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(t.has(`errors.${data.error}`) ? t(`errors.${data.error}`) : t('errors.generic'));
        return;
      }
      onDone();
    } catch {
      setError(t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="bg-cream w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-[20px] text-cream-100 mb-1">{t('modalTitle')}</h3>
        <p className="text-[12px] text-cream-100/55 mb-4">{t('modalHint')}</p>

        <div className="flex items-center justify-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} onClick={() => setRating(i)} className="p-1">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className={i <= rating ? 'text-gold-400' : 'text-black/12'}>
                <path d="m12 2 3 7 7 .7-5.5 4.7 1.7 7L12 17.6 5.8 21.4l1.7-7L2 9.7 9 9l3-7Z" />
              </svg>
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder={t('commentPlaceholder')}
          className="w-full px-3.5 py-3 rounded-xl border border-gold-300/12 text-[14px] text-cream-100 placeholder:text-cream-100/35 focus:outline-none focus:border-fig-600/40 resize-none mb-3"
        />

        {error && <p className="text-[12px] text-berry mb-3 text-center">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gold-300/15 text-cream-100 text-[14px] font-medium">
            {t('cancel')}
          </button>
          <button onClick={submit} disabled={submitting} className="flex-1 btn-fig text-white py-3 rounded-xl text-[14px] font-medium disabled:opacity-60">
            {submitting ? '...' : t('submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
