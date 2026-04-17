/**
 * Tipos alineados con Strapi (campos snake_case).
 * Sesión de caja: content-type `api::caja.caja` → REST `/api/cash-sessions`.
 */

export type CashSessionEstado = 'abierta' | 'cerrada';

export type CashMovementTipo = 'ingreso' | 'egreso';

export type StockMovementTipo = 'entrada' | 'salida';

export type StockItemCategoria = 'Bebidas' | 'Comida' | 'Insumos';

export type StockItemUnidad = 'un' | 'kg' | 'lt' | 'pack';

/** Identificador usable en URLs REST (Strapi 5: suele ser `documentId`; también puede existir `id` numérico). */
export type StrapiEntityId = string | number;

export interface StrapiRelationOne<T> {
  data?: T | null;
}

/** Entrada normalizada de sesión de caja (cash-session / caja). */
export interface CashSession {
  id?: StrapiEntityId;
  documentId?: string;
  fecha_apertura?: string | null;
  monto_inicial?: number | string | null;
  fecha_cierre?: string | null;
  monto_final?: number | string | null;
  estado?: CashSessionEstado | null;
  restaurante?: unknown;
  cash_movements?: CashMovement[] | StrapiRelationOne<CashMovement[]>;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
}

export interface CashMovement {
  id?: StrapiEntityId;
  documentId?: string;
  tipo?: CashMovementTipo | null;
  monto?: number | string | null;
  concepto?: string | null;
  cash_session?: CashSession | StrapiRelationOne<CashSession> | StrapiEntityId | null;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
}

export interface StockItemProductoRef {
  id?: StrapiEntityId;
  documentId?: string;
  name?: string;
  sku?: string | null;
  restaurante?: unknown;
}

export interface StockItem {
  id?: StrapiEntityId;
  documentId?: string;
  nombre?: string | null;
  sku?: string | null;
  stock_actual?: number | string | null;
  stock_minimo?: number | string | null;
  categoria?: StockItemCategoria | null;
  unidad?: StockItemUnidad | null;
  precio_costo?: number | string | null;
  estado?: boolean | null;
  producto?: StockItemProductoRef | StrapiRelationOne<StockItemProductoRef> | null;
  stock_movements?: StockMovement[] | StrapiRelationOne<StockMovement[]>;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
}

export interface StockMovement {
  id?: StrapiEntityId;
  documentId?: string;
  tipo?: StockMovementTipo | null;
  cantidad?: number | string | null;
  motivo?: string | null;
  stock_item?: StockItem | StrapiRelationOne<StockItem> | StrapiEntityId | null;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
}

export interface CreateCashSessionPayload {
  fecha_apertura: string;
  monto_inicial: number;
  estado: 'abierta';
  restaurante: StrapiEntityId;
}

export interface CreateCashMovementPayload {
  tipo: CashMovementTipo;
  monto: number;
  concepto?: string | null;
  cash_session: StrapiEntityId;
}

export interface UpdateStockItemPayload {
  estado: boolean;
}

/** Cierre de sesión de caja (PUT parcial). */
export interface UpdateCashSessionPayload {
  fecha_cierre?: string | null;
  monto_final?: number | null;
  estado?: 'abierta' | 'cerrada';
}
