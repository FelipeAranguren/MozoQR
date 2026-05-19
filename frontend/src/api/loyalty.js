import { api } from '../api';

export async function fetchLoyaltyProgram(slug) {
  const res = await api.get(`/restaurants/${slug}/loyalty/program`);
  return res.data?.data ?? res.data;
}

export async function fetchMyLoyalty(restaurantSlug) {
  const qs = restaurantSlug ? `?restaurant=${encodeURIComponent(restaurantSlug)}` : '';
  const res = await api.get(`/loyalty/me${qs}`);
  return res.data?.data ?? res.data;
}

export async function updateLoyaltyProfile(data) {
  const res = await api.put('/loyalty/profile', data);
  return res.data?.data ?? res.data;
}

export async function fetchLoyaltyTransactions(accountId) {
  const res = await api.get(`/loyalty/transactions?accountId=${accountId}`);
  return res.data?.data ?? res.data;
}

export async function redeemLoyaltyPoints(slug, tierPoints) {
  const res = await api.post(`/restaurants/${slug}/loyalty/redeem`, { tierPoints });
  return res.data?.data ?? res.data;
}

export async function fetchOwnerLoyaltyProgram(slug) {
  const res = await api.get(`/owner/${slug}/loyalty/program`);
  return res.data?.data ?? res.data;
}

export async function updateOwnerLoyaltyProgram(slug, data) {
  const res = await api.put(`/owner/${slug}/loyalty/program`, data);
  return res.data?.data ?? res.data;
}

export async function fetchOwnerLoyaltyAccounts(slug) {
  const res = await api.get(`/owner/${slug}/loyalty/accounts`);
  return res.data?.data ?? res.data;
}

export async function adjustOwnerLoyaltyAccount(slug, accountId, delta, notes) {
  const res = await api.post(`/owner/${slug}/loyalty/accounts/${accountId}/adjust`, { delta, notes });
  return res.data?.data ?? res.data;
}
