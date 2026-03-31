import React from 'react';

function coerceBool(v) {
  if (v === true) return true;
  if (v === false || v == null) return false;
  if (typeof v === 'number') return v === 1;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
}

function IconPlus({ className = '' }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M9 3V15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M3 9H15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function IconMinus({ className = '' }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M3.2 9H14.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function MenuProductCard({
  producto,
  qty = 0,
  priceFormatted,
  onAdd,
  onSub,
  orderStatusLabel = null,
}) {
  const nombre = producto?.nombre ?? '';
  const descripcion = producto?.descripcion ?? '';
  const imagen = producto?.imagen ?? '';

  const isPopular = coerceBool(
    producto?.popular ??
      producto?.isPopular ??
      producto?.esPopular ??
      producto?.popularidad ??
      producto?.popularidadScore ??
      producto?.is_popular
  );

  const ink = 'var(--mq-text)';
  const muted = 'var(--mq-text-secondary)';
  const surface = 'var(--mq-surface)';
  const border = 'var(--mq-border)';
  const btnBg = 'var(--mq-primary)';

  return (
    <div
      className="w-full overflow-hidden"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div
        className="overflow-hidden border"
        style={{
          borderRadius: 'var(--mq-radius-lg)',
          background: surface,
          borderColor: border,
          boxShadow: 'var(--mq-shadow-1)',
        }}
      >
        <div
          className="relative w-full aspect-square overflow-hidden"
          style={{
            background: 'var(--mq-bg-alt)',
          }}
        >
          {isPopular && (
            <div
              className="absolute top-3 left-3 z-10 uppercase px-2.5 py-1 text-[10px] font-bold tracking-[0.12em]"
              style={{
                borderRadius: 'var(--mq-radius-sm)',
                backgroundColor: 'rgba(234, 88, 12, 0.1)',
                color: 'var(--mq-accent)',
                border: '1px solid rgba(234, 88, 12, 0.25)',
              }}
            >
              Popular
            </div>
          )}

          {orderStatusLabel ? (
            <div
              className="absolute top-3 right-3 z-10 px-2.5 py-1 text-[11px] font-semibold tracking-[0.06em] shadow-sm max-w-[calc(100%-5rem)] truncate"
              style={{
                borderRadius: 'var(--mq-radius-sm)',
                backgroundColor: orderStatusLabel === 'En preparación' ? btnBg : '#ca8a04',
                color: '#fff',
              }}
              title={orderStatusLabel}
            >
              {orderStatusLabel}
            </div>
          ) : null}

          {imagen ? (
            <img src={imagen} alt={nombre} loading="lazy" className="w-full h-full object-cover block" />
          ) : (
            <div className="flex h-full w-full items-end p-5">
              <div
                className="px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
                style={{
                  borderRadius: 'var(--mq-radius-sm)',
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  color: muted,
                  border: `1px solid ${border}`,
                }}
              >
                Sin foto
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 p-5">
          <h3
            className="overflow-hidden text-[17px] font-bold leading-snug tracking-[-0.02em] [display:-webkit-box] [-webkit-line-clamp:1] [-webkit-box-orient:vertical]"
            title={nombre}
            style={{ color: ink }}
          >
            {nombre}
          </h3>

          {descripcion ? (
            <p
              className="min-h-[40px] overflow-hidden text-[14px] leading-[1.5] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]"
              style={{ color: muted }}
              title={descripcion}
            >
              {descripcion}
            </p>
          ) : (
            <div className="min-h-[40px]" />
          )}

          <div
            className="mt-auto flex items-center justify-between gap-3 border px-4 py-3"
            style={{
              borderRadius: 'var(--mq-radius-md)',
              backgroundColor: 'var(--mq-bg-alt)',
              borderColor: border,
            }}
          >
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--mq-text-muted)' }}>
                Precio
              </div>
              <div className="text-[17px] font-bold leading-none tracking-[-0.02em]" style={{ color: ink }}>
                {priceFormatted}
              </div>
            </div>

            {qty <= 0 ? (
              <button
                type="button"
                onClick={onAdd}
                aria-label={`Agregar ${nombre}`}
                className="flex h-10 w-10 items-center justify-center select-none text-white"
                style={{
                  borderRadius: 'var(--mq-radius-sm)',
                  backgroundColor: btnBg,
                }}
              >
                <IconPlus />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="flex h-10 items-center border px-1.5"
                  style={{
                    borderRadius: 'var(--mq-radius-sm)',
                    backgroundColor: 'var(--mq-surface)',
                    borderColor: border,
                  }}
                >
                  <button
                    type="button"
                    onClick={onSub}
                    aria-label={`Quitar ${nombre}`}
                    className="flex h-9 w-9 items-center justify-center select-none"
                    style={{
                      borderRadius: 'var(--mq-radius-sm)',
                      color: ink,
                    }}
                  >
                    <IconMinus />
                  </button>

                  <div className="min-w-[24px] text-center text-[15px] font-bold" style={{ color: ink }}>
                    {qty}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onAdd}
                  aria-label={`Sumar ${nombre}`}
                  className="flex h-10 w-10 items-center justify-center select-none text-white"
                  style={{
                    borderRadius: 'var(--mq-radius-sm)',
                    backgroundColor: btnBg,
                  }}
                >
                  <IconPlus />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
