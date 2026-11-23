import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { IconCard, IconRefresh, IconTrash } from '../components/Icons';
import { useApp } from '../context/AppContext';
import type { RfidCard } from '../types';
import { formatShortDate } from '../utils/format';

export function RfidPage() {
  const { session, api } = useApp();

  const uidInputRef = useRef<HTMLInputElement | null>(null);
  const labelInputRef = useRef<HTMLInputElement | null>(null);

  const [cards, setCards] = useState<RfidCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);

  const [cardUid, setCardUid] = useState('');
  const [label, setLabel] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ cardUid?: string; label?: string }>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadCards = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setError('');
    try {
      const list = await api.getRfidCards();
      setCards(list);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No pudimos cargar tus tarjetas de acceso.'
      );
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  if (!api || !session) return null;

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const cleanUid = cardUid.trim().toUpperCase().replace(/\s+/g, '');
    const cleanLabel = label.trim();

    const errors: { cardUid?: string; label?: string } = {};
    if (!cleanUid) errors.cardUid = 'Ingresa el código de la tarjeta.';
    if (!cleanLabel) errors.label = 'Agrega un nombre para identificarla.';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.cardUid) uidInputRef.current?.focus();
      else if (errors.label) labelInputRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const created = await api.createRfidCard(cleanUid, cleanLabel);
      setCards((prev) => [created, ...prev.filter((c) => c.cardUid !== created.cardUid)]);
      setCardUid('');
      setLabel('');
      setSuccess(`Tarjeta “${created.label}” agregada correctamente.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos registrar la tarjeta.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (card: RfidCard) => {
    setError('');
    setSuccess('');
    setDeletingUid(card.cardUid);
    try {
      await api.deleteRfidCard(card.cardUid);
      setCards((prev) => prev.filter((c) => c.cardUid !== card.cardUid));
      setConfirmDeleteUid(null);
      setSuccess(`Tarjeta “${card.label}” eliminada.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos eliminar la tarjeta.');
    } finally {
      setDeletingUid(null);
    }
  };

  return (
    <div className="stack-6">
      <div className="page-header">
        <div>
          <div className="page-eyebrow tabular">Departamento&nbsp;{session.department}</div>
          <h1 className="page-title">Tarjetas de acceso</h1>
          <p className="page-subtitle">
            Administra las llaves RFID autorizadas para entrar a tu departamento.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => void loadCards()}
          disabled={loading}
        >
          {loading ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <IconRefresh width={15} height={15} />
          )}
          Actualizar
        </button>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-ok" role="status">
            {success}
          </div>
        )}
      </div>

      <div className="grid-asymmetric">
        {/* Card List */}
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                Tus tarjetas <span className="tabular">({cards.length})</span>
              </h2>
              <p className="card-desc">Solo aparecen las tarjetas de tu departamento.</p>
            </div>
          </div>

          {loading && cards.length === 0 ? (
            <div className="stack-3">
              <div className="skeleton" style={{ height: 56 }} />
              <div className="skeleton" style={{ height: 56 }} />
            </div>
          ) : cards.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Aún no tienes tarjetas registradas. Agrega tu primera llave desde el formulario.
            </p>
          ) : (
            <div className="data-list">
              {cards.map((card) => {
                const confirming = confirmDeleteUid === card.cardUid;
                const deleting = deletingUid === card.cardUid;

                return (
                  <div key={card.cardUid} className="data-row">
                    <div className="row min-w-0" style={{ gap: 12, flex: 1 }}>
                      <div className="icon-chip accent">
                        <IconCard width={18} height={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate" style={{ fontWeight: 600, fontSize: 14 }}>
                          {card.label}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          <span className="mono" translate="no">
                            {card.cardUid}
                          </span>
                          {card.createdAt ? ` · Agregada el ${formatShortDate(card.createdAt)}` : ''}
                        </div>
                      </div>
                    </div>

                    {confirming ? (
                      <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={deleting}
                          onClick={() => void handleDelete(card)}
                        >
                          {deleting && <span className="spinner" aria-hidden="true" />}
                          Confirmar
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={deleting}
                          onClick={() => setConfirmDeleteUid(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--status-danger)', flexShrink: 0 }}
                        onClick={() => setConfirmDeleteUid(card.cardUid)}
                        aria-label={`Eliminar tarjeta ${card.label}`}
                      >
                        <IconTrash width={15} height={15} />
                        Eliminar…
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Register Form */}
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Agregar tarjeta</h2>
              <p className="card-desc">
                Quedará vinculada automáticamente al departamento {session.department}.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreate} noValidate className="stack-4">
            <div className="field">
              <label htmlFor="cardUid">Código de la tarjeta</label>
              <input
                ref={uidInputRef}
                id="cardUid"
                name="cardUid"
                className="input mono"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="A1B2C3D4…"
                value={cardUid}
                onChange={(e) => {
                  setCardUid(e.target.value);
                  if (fieldErrors.cardUid) {
                    setFieldErrors((prev) => ({ ...prev, cardUid: undefined }));
                  }
                }}
                aria-invalid={Boolean(fieldErrors.cardUid)}
                disabled={submitting}
              />
              {fieldErrors.cardUid ? (
                <span className="field-error" role="alert">
                  {fieldErrors.cardUid}
                </span>
              ) : (
                <span className="field-hint">Código impreso o leído en la tarjeta RFID.</span>
              )}
            </div>

            <div className="field">
              <label htmlFor="cardLabel">Nombre</label>
              <input
                ref={labelInputRef}
                id="cardLabel"
                name="cardLabel"
                className="input"
                type="text"
                placeholder="Llave principal…"
                value={label}
                onChange={(e) => {
                  setLabel(e.target.value);
                  if (fieldErrors.label) {
                    setFieldErrors((prev) => ({ ...prev, label: undefined }));
                  }
                }}
                aria-invalid={Boolean(fieldErrors.label)}
                disabled={submitting}
              />
              {fieldErrors.label && (
                <span className="field-error" role="alert">
                  {fieldErrors.label}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ width: '100%' }}
            >
              {submitting && <span className="spinner" aria-hidden="true" />}
              Agregar tarjeta
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
