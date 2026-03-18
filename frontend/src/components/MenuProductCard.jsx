import React from 'react';

function coerceBool(v) {
  if (v === true) return true;
  if (v === false || v == null) return false;
  if (typeof v === 'number') return v === 1;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
}

export default function MenuProductCard({
  producto,
  qty = 0,
  priceFormatted,
  onAdd,
  onSub,
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

  const teal = '#0f7c79';

  return (
    <div
      className="w-full h-full bg-white rounded-[28px] overflow-hidden border border-[#e7f6f3] shadow-[0_12px_35px_rgba(0,0,0,0.08)]"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="relative w-full aspect-square bg-[#f3f6f6] rounded-t-[28px] overflow-hidden">
        {isPopular && (
          <div
            className="absolute top-3 left-3 uppercase rounded-full px-3 py-1 text-white text-[12px] font-extrabold tracking-wide"
            style={{ backgroundColor: teal }}
          >
            POPULAR
          </div>
        )}

        {imagen ? (
          <img src={imagen} alt={nombre} loading="lazy" className="w-full h-full object-cover block" />
        ) : null}
      </div>

      <div className="p-4 flex flex-col h-full">
        <h3 className="text-black font-extrabold text-[18px] leading-snug">{nombre}</h3>

        {descripcion ? (
          <p
            className="mt-2 text-[#6b7280] text-[14px] leading-[1.35] overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]"
            title={descripcion}
          >
            {descripcion}
          </p>
        ) : (
          <div className="mt-2 h-[32px]" />
        )}

        <div className="mt-auto pt-3 flex items-center justify-between">
          <div className="text-[#0f7c79] font-extrabold text-[18px] leading-none">{priceFormatted}</div>

          {qty <= 0 ? (
            <button
              type="button"
              onClick={onAdd}
              aria-label={`Agregar ${nombre}`}
              className="w-11 h-11 rounded-full flex items-center justify-center select-none"
              style={{ backgroundColor: teal }}
            >
              <span className="text-white text-[26px] leading-none font-extrabold">+</span>
            </button>
          ) : (
            <div className="flex items-center bg-[#f3f6f6] border border-[#d9efec] rounded-full px-2 py-1 gap-2">
              <button
                type="button"
                onClick={onSub}
                aria-label={`Quitar ${nombre}`}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-white border border-[#d9efec] select-none"
                style={{ color: teal }}
              >
                <span className="text-[22px] leading-none font-extrabold">-</span>
              </button>

              <div className="min-w-[20px] text-center text-black font-extrabold text-[16px]">{qty}</div>

              <button
                type="button"
                onClick={onAdd}
                aria-label={`Sumar ${nombre}`}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-white border border-[#d9efec] select-none"
                style={{ color: teal }}
              >
                <span className="text-[22px] leading-none font-extrabold">+</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

