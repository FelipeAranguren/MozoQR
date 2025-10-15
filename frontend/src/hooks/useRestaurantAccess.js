import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

const ALLOWED_ROLES = new Set(['owner', 'staff']);
const INITIAL_STATE = {
  status: 'idle',
  role: null,
  restaurantName: null,
  error: null,
};

function extractRestaurantName(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  const data = raw.data ?? raw;
  const attrs = data.attributes ?? data;
  return attrs?.name ?? null;
}

function normalizeIdentifier(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length ? str : null;
}

export function useRestaurantAccess(slug, user) {
  const [state, setState] = useState(INITIAL_STATE);

  const identityFilters = useMemo(() => {
    if (!user) return [];

    const entries = [];
    const seen = new Set();

    const add = (path, op, rawValue) => {
      const value = normalizeIdentifier(rawValue);
      if (!value) return;
      const key = `${path}:${op}:${value}`;
      if (seen.has(key)) return;
      seen.add(key);
      entries.push({ path, op, value });
    };

    add('id', '$eq', user.id);
    add('id', '$eq', user._id);
    add('documentId', '$eq', user.documentId);
    add('document_id', '$eq', user.document_id);
    add('email', '$eq', user.email);
    add('email', '$eqi', user.email);
    add('username', '$eq', user.username);
    add('username', '$eqi', user.username);

    return entries;
  }, [user]);

  useEffect(() => {
    if (!slug || !user) {
      setState(INITIAL_STATE);
      return;
    }

    if (!identityFilters.length) {
      setState({ status: 'error', role: null, restaurantName: null, error: new Error('missing_user_identity') });
      return;
    }

    let isActive = true;
    setState({ status: 'loading', role: null, restaurantName: null, error: null });

    const params = new URLSearchParams();
    params.set('filters[restaurante][slug][$eq]', slug);
    params.set('populate[restaurante][fields][0]', 'name');
    params.set('fields[0]', 'role');
    params.set('pagination[pageSize]', '1');

    identityFilters.forEach((filter, index) => {
      params.set(
        `filters[$or][${index}][users_permissions_user][${filter.path}][${filter.op}]`,
        filter.value,
      );
    });

    api
      .get(`/restaurant-members?${params.toString()}`)
      .then((res) => {
        if (!isActive) return;
        const node = Array.isArray(res?.data?.data) ? res.data.data[0] : null;
        if (!node) {
          setState({ status: 'forbidden', role: null, restaurantName: null, error: null });
          return;
        }
        const attributes = node.attributes ?? node;
        const role = attributes?.role ?? null;
        const restaurantName = extractRestaurantName(attributes?.restaurante);
        if (!role || !ALLOWED_ROLES.has(String(role).toLowerCase())) {
          setState({ status: 'forbidden', role, restaurantName, error: null });
          return;
        }
        setState({ status: 'allowed', role, restaurantName, error: null });
      })
      .catch((err) => {
        if (!isActive) return;
        const status = err?.response?.status;
        if (status === 401) {
          setState({ status: 'unauthorized', role: null, restaurantName: null, error: null });
          return;
        }
        if (status === 403) {
          setState({ status: 'forbidden', role: null, restaurantName: null, error: null });
          return;
        }
        setState({ status: 'error', role: null, restaurantName: null, error: err });
      });

    return () => {
      isActive = false;
    };
  }, [slug, user, identityFilters]);

  return state;
}