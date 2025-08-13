// frontend/src/views/AdminDashboard.tsx
import React, { useEffect, useState } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import api from "../utils/api";

export default function AdminDashboard() {
  const [details, setDetails] = useState<any>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const d = await api.get("/account-details").catch(() => ({ data: {} }));
    setDetails(d.data || {});
    try {
      const s = await api.get("/submissions");
      setSubs(s.data || []);
    } catch {
      setSubs([]);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/account-details", details);
      alert("Saved");
    } catch (e) {
      alert("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container flex-1 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded shadow">
            <h4 className="font-semibold mb-4">Account / Bank Details</h4>

            <label className="block text-sm">Bank Name</label>
            <input
              className="w-full border p-2 rounded mb-2"
              value={details?.bank?.bankName || ""}
              onChange={(e) =>
                setDetails({
                  ...details,
                  bank: { ...details?.bank, bankName: e.target.value },
                })
              }
            />

            <label className="block text-sm">Account Name</label>
            <input
              className="w-full border p-2 rounded mb-2"
              value={details?.bank?.accountName || ""}
              onChange={(e) =>
                setDetails({
                  ...details,
                  bank: { ...details?.bank, accountName: e.target.value },
                })
              }
            />

            <label className="block text-sm">Account Number</label>
            <input
              className="w-full border p-2 rounded mb-2"
              value={details?.bank?.accountNumber || ""}
              onChange={(e) =>
                setDetails({
                  ...details,
                  bank: { ...details?.bank, accountNumber: e.target.value },
                })
              }
            />

            <label className="block text-sm">SWIFT / BIC</label>
            <input
              className="w-full border p-2 rounded mb-2"
              value={details?.bank?.swift || ""}
              onChange={(e) =>
                setDetails({
                  ...details,
                  bank: { ...details?.bank, swift: e.target.value },
                })
              }
            />

            <label className="block text-sm">Notes (optional)</label>
            <textarea
              className="w-full border p-2 rounded mb-2"
              value={details?.bank?.notes || ""}
              onChange={(e) =>
                setDetails({
                  ...details,
                  bank: { ...details?.bank, notes: e.target.value },
                })
              }
            />

            <h5 className="mt-4 font-semibold">Crypto Addresses</h5>
            <label className="block text-sm">BTC Address</label>
            <input
              className="w-full border p-2 rounded mb-2"
              value={details?.crypto?.btc || ""}
              onChange={(e) =>
                setDetails({
                  ...details,
                  crypto: { ...details?.crypto, btc: e.target.value },
                })
              }
            />

            <label className="block text-sm">ETH Address</label>
            <input
              className="w-full border p-2 rounded mb-2"
              value={details?.crypto?.eth || ""}
              onChange={(e) =>
                setDetails({
                  ...details,
                  crypto: { ...details?.crypto, eth: e.target.value },
                })
              }
            />

            <label className="block text-sm">USDT Address</label>
            <input
              className="w-full border p-2 rounded mb-2"
              value={details?.crypto?.usdt || ""}
              onChange={(e) =>
                setDetails({
                  ...details,
                  crypto: { ...details?.crypto, usdt: e.target.value },
                })
              }
            />

            <div className="flex gap-2 mt-4">
              <button
                onClick={save}
                className="px-4 py-2 bg-green-600 text-white rounded"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Details"}
              </button>
              <button onClick={load} className="px-4 py-2 bg-gray-200 rounded">
                Reload
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded shadow">
            <h4 className="font-semibold mb-3">Submissions</h4>
            <div className="space-y-3">
              {subs.length === 0 && (
                <div className="text-sm text-gray-600">No submissions yet</div>
              )}
              {subs.map((s) => (
                <div key={s.id} className="p-3 border rounded">
                  <div className="text-sm font-medium">
                    {s.name} — {s.email}
                  </div>
                  <div className="text-xs text-gray-600">
                    Method: {s.method} — Network: {s.selectedNetwork || "-"} —
                    Amount: {s.amount} — Status: {s.status}
                  </div>
                  <div className="mt-2 flex gap-2">
                    {s.idFileUrl && (
                      <a
                        className="text-blue-600"
                        href={s.idFileUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View ID
                      </a>
                    )}
                    {s.paymentProofUrl && (
                      <a
                        className="text-blue-600"
                        href={s.paymentProofUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View Payment Proof
                      </a>
                    )}
                    {s.status !== "confirmed" && (
                      <button
                        onClick={() =>
                          api
                            .put(`/submissions/${s.id}/status`, {
                              status: "confirmed",
                            })
                            .then(load)
                        }
                        className="px-2 py-1 bg-blue-600 text-white rounded"
                      >
                        Mark Confirmed
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
