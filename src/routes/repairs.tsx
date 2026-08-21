import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, EmptyState } from "@/components/AppShell";
import type { Product, Repair, RepairUsedPart } from "@/lib/db";
import { formatMoney, parseNumber, todayJalali } from "@/lib/format";
import { useCustomers, useProducts, useRemove, useRepairs, useSave, useStockDeltas } from "@/lib/queries";

export const Route = createFileRoute("/repairs")({
  head: () => ({
    meta: [
      { title: "سوابق تعمیرات — پکیج‌یار" },
      { name: "description", content: "ثبت و پیگیری تعمیرات پکیج با اجرت، هزینه قطعات و وضعیت کار." },
      { property: "og:title", content: "سوابق تعمیرات — پکیج‌یار" },
      { property: "og:description", content: "ثبت تعمیر جدید و مشاهده سوابق مشتریان." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/repairs" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/repairs" }],
  }),
  component: RepairsPage,
});

const STATUS: Record<Repair["status"], string> = {
  open: "در جریان",
  done: "انجام شد",
  delivered: "تحویل شد",
};

function emptyRepair(): Repair {
  return { customerId: 0, deviceId: null, date: todayJalali(), problem: "", action: "", wage: 0, partsCost: 0, usedParts: [], status: "open" };
}

function RepairsPage() {
  const customers = useCustomers().data ?? [];
  const products = useProducts().data ?? [];
  const { data: repairs = [] } = useRepairs();
  const save = useSave<Repair>("repairs");
  const saveProduct = useSave<Product>("products");
  const remove = useRemove("repairs");
  const stock = useStockDeltas();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Repair>(emptyRepair);

  return (
    <AppShell
      title="سوابق تعمیرات"
      subtitle={`${repairs.length} تعمیر ثبت شده`}
      action={
        <button className="py-btn py-btn-accent" onClick={() => setOpen((v) => !v)}>
          {open ? "بستن" : "+ ثبت تعمیر"}
        </button>
      }
    >
      {open ? (
        <form
          className="py-card mb-4 space-y-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.customerId) return;
            const partsTotal = (form.usedParts || []).reduce((sum, part) => sum + part.qty * part.price, 0);
            const payload = { ...form, partsCost: partsTotal };
            save.mutate(payload);
            for (const part of form.usedParts || []) {
              const product = products.find((p) => p.id === part.productId);
              if (product) {
                saveProduct.mutate({ ...product, qty: Math.max(0, (product.qty || 0) - part.qty) });
              }
            }
            setForm(emptyRepair());
            setOpen(false);
          }}
        >
          <select className="py-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: Number(e.target.value) })}>
            <option value={0}>انتخاب مشتری…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input className="py-field" placeholder="تاریخ" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input className="py-field" placeholder="ایراد دستگاه" value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} />
          <input className="py-field" placeholder="کار انجام شده" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} />
          <input className="py-field" inputMode="numeric" placeholder="اجرت (تومان)" onChange={(e) => setForm({ ...form, wage: parseNumber(e.target.value) })} />

          <select className="py-field" value={0} onChange={(e) => {
            const productId = Number(e.target.value);
            if (!productId) return;
            const product = products.find((p) => p.id === productId);
            if (!product) return;
            setForm((prev) => ({
              ...prev,
              usedParts: [...(prev.usedParts || []), { productId, name: product.name, qty: 1, price: product.sellPrice || 0 }],
            }));
          }}>
            <option value={0}>+ افزودن قطعه مصرفی…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {(form.usedParts || []).map((part, index) => (
            <div key={index} className="flex items-center gap-2 rounded-md bg-muted p-2 text-xs">
              <span className="flex-1">{part.name}</span>
              <input
                className="py-field w-16 py-1"
                inputMode="numeric"
                value={part.qty}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    usedParts: prev.usedParts?.map((it, i) => (i === index ? { ...it, qty: parseNumber(e.target.value) } : it)) || [],
                  }))
                }
              />
              <input
                className="py-field w-24 py-1"
                inputMode="numeric"
                value={part.price}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    usedParts: prev.usedParts?.map((it, i) => (i === index ? { ...it, price: parseNumber(e.target.value) } : it)) || [],
                  }))
                }
              />
              <button type="button" onClick={() => setForm((prev) => ({ ...prev, usedParts: prev.usedParts?.filter((_, i) => i !== index) || [] }))}>✕</button>
            </div>
          ))}

          <select className="py-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Repair["status"] })}>
            {Object.entries(STATUS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button className="py-btn w-full" type="submit">ذخیره تعمیر</button>
        </form>
      ) : null}

      {repairs.length === 0 ? (
        <EmptyState text="هنوز تعمیری ثبت نشده است." />
      ) : (
        <div className="py-card divide-y divide-border">
          {[...repairs].reverse().map((r) => (
            <div key={r.id} className="space-y-1 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{customers.find((c) => c.id === r.customerId)?.name ?? "—"}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.68rem]">{STATUS[r.status]}</span>
              </div>
              <div className="text-xs text-muted-foreground">{r.date} · {r.problem || "بدون توضیح"}</div>
              <div className="flex items-center justify-between text-xs">
                <span>{formatMoney((r.wage || 0) + (r.partsCost || 0))}</span>
                <button className="text-muted-foreground" onClick={() => r.id && remove.mutate(r.id)}>حذف</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
