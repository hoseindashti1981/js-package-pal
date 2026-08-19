import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addRecord,
  deleteRecord,
  getAll,
  putRecord,
  type Customer,
  type CustomerPayment,
  type Product,
  type Repair,
  type SalesInvoice,
  type StoreName,
} from "./db";

export function useRows<T>(store: StoreName) {
  return useQuery({
    queryKey: [store],
    queryFn: () => getAll<T>(store),
    staleTime: 0,
  });
}

export function useSave<T extends { id?: number }>(store: StoreName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (value: T) => {
      const payload = { ...value, createdAt: (value as { createdAt?: string }).createdAt ?? new Date().toISOString() };
      if (value.id) return putRecord(store, payload);
      const { id: _omit, ...rest } = payload as Record<string, unknown> & { id?: number };
      return addRecord(store, rest);
    },
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useRemove(store: StoreName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteRecord(store, id),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useCustomers() {
  return useRows<Customer>("customers");
}
export function useProducts() {
  return useRows<Product>("products");
}
export function useRepairs() {
  return useRows<Repair>("repairs");
}
export function useSales() {
  return useRows<SalesInvoice>("salesInvoices");
}
export function usePayments() {
  return useRows<CustomerPayment>("customerPayments");
}

export function customerBalance(
  customerId: number,
  repairs: Repair[],
  sales: SalesInvoice[],
  payments: CustomerPayment[],
): number {
  const repairDebt = repairs
    .filter((r) => r.customerId === customerId)
    .reduce((sum, r) => sum + (r.wage || 0) + (r.partsCost || 0), 0);
  const salesDebt = sales
    .filter((s) => s.customerId === customerId)
    .reduce((sum, s) => sum + (s.total || 0) - (s.paid || 0), 0);
  const paid = payments
    .filter((p) => p.customerId === customerId)
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  return repairDebt + salesDebt - paid;
}
