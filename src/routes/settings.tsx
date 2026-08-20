import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { addRecord, DB_NAME, DB_VERSION, exportAll, importAll, type Product } from "@/lib/db";
import { parseNumber, todayJalali } from "@/lib/format";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "تنظیمات و پشتیبان‌گیری — پکیج‌یار" },
      { name: "description", content: "وضعیت دیتابیس، تهیه فایل پشتیبان و بازگردانی اطلاعات پکیج‌یار." },
      { property: "og:title", content: "تنظیمات و پشتیبان‌گیری — پکیج‌یار" },
      { property: "og:description", content: "پشتیبان‌گیری، بازگردانی و اطلاعات نسخه اپ." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/settings" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/settings" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const mdRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [installable, setInstallable] = useState(false);
  const promptRef = useRef<{ prompt: () => void } | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as unknown as { prompt: () => void };
      setInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const backup = async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `packageyar-backup-${todayJalali().replace(/\//g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("فایل پشتیبان ساخته شد ✓");
  };

  const restore = async (file: File) => {
    const text = await file.text();
    await importAll(JSON.parse(text));
    await qc.invalidateQueries();
    setMessage("اطلاعات بازگردانی شد ✓");
  };

  const importMarkdown = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    let imported = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("|")) continue;
      const parts = trimmed.split("|").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const name = parts[0] ?? "";
        const qty = parseNumber(parts[1] ?? "");
        const buyPrice = parts[2] ? parseNumber(parts[2]) : 0;
        const sellPrice = parts[3] ? parseNumber(parts[3]) : buyPrice;
        const product: Product = {
          name,
          code: "",
          unit: "عدد",
          qty: qty || 0,
          minQty: 1,
          buyPrice,
          sellPrice,
          createdAt: new Date().toISOString(),
        };
        await addRecord("products", product);
        imported++;
      }
    }
    await qc.invalidateQueries();
    setMessage(`${imported} کالا از Markdown وارد شد ✓`);
  };

  return (
    <AppShell title="تنظیمات" subtitle="پکیج‌یار نسخه ۱٫۰">
      <div className="py-card space-y-2 p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">وضعیت دیتابیس</span><span className="text-success">فعال ✓</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">نام دیتابیس</span><span>{DB_NAME}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">نسخه دیتابیس</span><span>{DB_VERSION}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">حالت کار</span><span>آفلاین روی همین دستگاه</span></div>
      </div>

      <div className="py-card mt-4 space-y-2 p-4">
        <h2 className="text-sm font-bold">💾 پشتیبان‌گیری</h2>
        <button className="py-btn w-full" onClick={backup}>دریافت فایل پشتیبان</button>
        <button className="py-btn py-btn-soft w-full" onClick={() => fileRef.current?.click()}>بازگردانی از فایل</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void restore(file);
          }}
        />
        {message ? <p className="text-xs text-success">{message}</p> : null}
      </div>

      {installable ? (
        <div className="py-card mt-4 space-y-2 p-4">
          <h2 className="text-sm font-bold">📲 نصب اپ</h2>
          <p className="text-xs text-muted-foreground">پکیج‌یار را روی صفحه اصلی گوشی یا دسکتاپ ویندوز نصب کنید.</p>
          <button className="py-btn py-btn-accent w-full" onClick={() => promptRef.current?.prompt()}>نصب پکیج‌یار</button>
        </div>
      ) : (
        <div className="py-card mt-4 p-4 text-xs text-muted-foreground">
          برای نصب روی آیفون: در سافاری دکمه اشتراک‌گذاری → «افزودن به صفحه اصلی». روی اندروید و ویندوز: منوی مرورگر → «نصب برنامه».
        </div>
      )}
    </AppShell>
  );
}
