// frontend/src/views/AdminDashboard.tsx
import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import api from "../utils/api";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type DetailsShape = {
  bank?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    swift?: string;
    notes?: string;
    [k: string]: any;
  };
  crypto?: {
    btc?: string;
    eth?: string;
    usdt?: string;
    [k: string]: any;
  };
  [k: string]: any;
};

type Submission = {
  id: string;
  name?: string;
  email?: string;
  method?: "wire" | "crypto";
  selectedNetwork?: string | null;
  amount?: string | number | null;
  txid?: string | null;
  idFileUrl?: string | null;
  paymentProofUrl?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export default function AdminDashboard() {
  const [details, setDetails] = useState<DetailsShape | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);

  // Table controls
  const [search, setSearch] = useState("");
  const [filterMethod, setFilterMethod] = useState<"" | "wire" | "crypto">("");
  const [filterStatus, setFilterStatus] = useState<
    "" | "pending" | "confirmed"
  >("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [sortKey, setSortKey] = useState<"created_at" | "amount" | "status">(
    "created_at"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get("/account-details");
      setDetails({
        bank: { ...(d.data?.bank || {}) },
        crypto: { ...(d.data?.crypto || {}) },
      });
    } catch (err) {
      toast.error("Failed to load account details");
      setDetails({ bank: {}, crypto: {} });
    }

    try {
      const s = await api.get("/submissions");
      setSubs(Array.isArray(s.data) ? s.data : []);
    } catch (err) {
      toast.error("Failed to load submissions (are you logged in?)");
      setSubs([]);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/account-details", {
        bank: details?.bank || {},
        crypto: details?.crypto || {},
      });
      toast.success("Account details saved");
    } catch (err: any) {
      console.error("Save failed", err);
      toast.error(err?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const requestReloadSubmissions = async () => {
    try {
      const s = await api.get("/submissions");
      setSubs(Array.isArray(s.data) ? s.data : []);
    } catch {
      toast.error("Failed to reload submissions");
    }
  };

  // Confirmation modal flow
  function confirmMark(id: string) {
    setConfirmTargetId(id);
    setShowConfirmModal(true);
  }

  async function doMarkConfirmed() {
    if (!confirmTargetId) return;
    const id = confirmTargetId;
    setShowConfirmModal(false);
    setUpdatingIds((s) => ({ ...s, [id]: true }));
    try {
      await api.put(`/submissions/${id}/status`, { status: "confirmed" });
      toast.success("Submission marked confirmed");
      await requestReloadSubmissions();
    } catch (err) {
      console.error("Mark confirmed failed", err);
      toast.error("Failed to mark confirmed");
    } finally {
      setUpdatingIds((s) => {
        const copy = { ...s };
        delete copy[id];
        return copy;
      });
      setConfirmTargetId(null);
    }
  }

  // Filters & search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = subs.slice();

    if (filterMethod) out = out.filter((r) => r.method === filterMethod);
    if (filterStatus)
      out = out.filter((r) => (r.status || "pending") === filterStatus);

    if (q) {
      out = out.filter((r) => {
        return (
          (r.name || "").toLowerCase().includes(q) ||
          (r.email || "").toLowerCase().includes(q) ||
          (r.id || "").toLowerCase().includes(q) ||
          (r.txid || "").toLowerCase().includes(q) ||
          (r.selectedNetwork || "").toLowerCase().includes(q)
        );
      });
    }

    // sorting
    out.sort((a, b) => {
      let va: any = a[sortKey];
      let vb: any = b[sortKey];

      // normalize created_at
      if (sortKey === "created_at") {
        va = a.created_at ? new Date(a.created_at).getTime() : 0;
        vb = b.created_at ? new Date(b.created_at).getTime() : 0;
      }
      if (sortKey === "amount") {
        va = Number(a.amount || 0);
        vb = Number(b.amount || 0);
      }
      if (va === vb) return 0;
      const comp = va > vb ? 1 : -1;
      return sortDir === "asc" ? comp : -comp;
    });

    return out;
  }, [subs, search, filterMethod, filterStatus, sortKey, sortDir]);

  // pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // CSV export for filtered rows
  const exportCSV = () => {
    const rows = filtered;
    if (!rows.length) {
      toast.info("No rows to export");
      return;
    }
    const header = [
      "id",
      "name",
      "email",
      "method",
      "selectedNetwork",
      "amount",
      "txid",
      "status",
      "created_at",
      "idFileUrl",
      "paymentProofUrl",
    ];
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        header
          .map((h) => {
            const v = (r as any)[h] ?? "";
            // escape quotes
            const s = typeof v === "string" ? v.replace(/"/g, '""') : String(v);
            return `"${s}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `submissions_export_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearch("");
    setFilterMethod("");
    setFilterStatus("");
    setPage(1);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
      />

      <main className="container flex-1 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Account editor */}
          <div className="bg-white p-6 rounded shadow">
            <h4 className="font-semibold mb-4">Account / Bank Details</h4>

            <label className="block text-sm">Bank Name</label>
            <input
              className="w-full border p-2 rounded mb-2"
              value={details?.bank?.bankName || ""}
              onChange={(e) =>
                setDetails({
                  ...details!,
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
                  ...details!,
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
                  ...details!,
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
                  ...details!,
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
                  ...details!,
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
                  ...details!,
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
                  ...details!,
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
                  ...details!,
                  crypto: { ...details?.crypto, usdt: e.target.value },
                })
              }
            />

            <div className="flex gap-2 mt-4">
              <button
                onClick={save}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Details"}
              </button>
              <button
                onClick={load}
                className="px-4 py-2 bg-gray-200 rounded"
                disabled={loading}
              >
                {loading ? "Loading..." : "Reload"}
              </button>
            </div>
          </div>

          {/* Submissions table */}
          <div className="bg-white p-6 rounded shadow">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">Submissions</h4>

              <div className="flex items-center gap-2">
                <button
                  onClick={exportCSV}
                  className="px-3 py-1 bg-gray-200 rounded text-sm"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => {
                    clearFilters();
                  }}
                  className="px-3 py-1 bg-gray-200 rounded text-sm"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* filters */}
            <div className="flex gap-2 mb-3">
              <input
                placeholder="Search name, email, id, txid..."
                className="flex-1 border p-2 rounded"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              <select
                value={filterMethod}
                onChange={(e) => {
                  setFilterMethod(e.target.value as any);
                  setPage(1);
                }}
                className="border p-2 rounded"
              >
                <option value="">All methods</option>
                <option value="crypto">Crypto</option>
                <option value="wire">Wire</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value as any);
                  setPage(1);
                }}
                className="border p-2 rounded"
              >
                <option value="">All status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
              </select>
            </div>

            {/* table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="p-2 text-xs">ID</th>
                    <th className="p-2 text-xs">Name</th>
                    <th className="p-2 text-xs">Email</th>
                    <th className="p-2 text-xs">Method</th>
                    <th className="p-2 text-xs">Network</th>
                    <th
                      className="p-2 text-xs cursor-pointer"
                      onClick={() => {
                        if (sortKey === "amount")
                          setSortDir(sortDir === "asc" ? "desc" : "asc");
                        else setSortKey("amount");
                      }}
                    >
                      Amount
                    </th>
                    <th
                      className="p-2 text-xs cursor-pointer"
                      onClick={() => {
                        if (sortKey === "created_at")
                          setSortDir(sortDir === "asc" ? "desc" : "asc");
                        else setSortKey("created_at");
                      }}
                    >
                      Date
                    </th>
                    <th className="p-2 text-xs">Status</th>
                    <th className="p-2 text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-2 text-sm text-gray-500">
                        No submissions found
                      </td>
                    </tr>
                  )}
                  {pageRows.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="p-2 text-xs break-all">{s.id}</td>
                      <td className="p-2 text-sm">{s.name || "-"}</td>
                      <td className="p-2 text-sm">{s.email || "-"}</td>
                      <td className="p-2 text-sm">{s.method || "-"}</td>
                      <td className="p-2 text-sm">
                        {s.selectedNetwork || "-"}
                      </td>
                      <td className="p-2 text-sm">{s.amount ?? "-"}</td>
                      <td className="p-2 text-sm">
                        {s.created_at
                          ? new Date(s.created_at).toLocaleString()
                          : "-"}
                      </td>
                      <td className="p-2 text-sm">{s.status || "-"}</td>
                      <td className="p-2 text-sm">
                        <div className="flex gap-2 items-center">
                          {s.idFileUrl && (
                            <a
                              className="text-blue-600 text-xs"
                              href={s.idFileUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              ID
                            </a>
                          )}
                          {s.paymentProofUrl && (
                            <a
                              className="text-blue-600 text-xs"
                              href={s.paymentProofUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Proof
                            </a>
                          )}
                          {s.status !== "confirmed" && (
                            <button
                              disabled={!!updatingIds[s.id]}
                              onClick={() => confirmMark(s.id)}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                            >
                              {updatingIds[s.id]
                                ? "Updating..."
                                : "Mark Confirmed"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* pagination */}
            <div className="flex items-center justify-between mt-3">
              <div className="text-sm text-gray-600">
                Showing {(page - 1) * PAGE_SIZE + 1} -{" "}
                {Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-1 bg-gray-200 rounded"
                >
                  Prev
                </button>
                <div className="px-2">{page}</div>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2 py-1 bg-gray-200 rounded"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Confirm modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full text-center space-y-4">
            <h3 className="text-xl font-bold">Confirm action</h3>
            <p>Are you sure you want to mark this submission as confirmed?</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Cancel
              </button>
              <button
                onClick={doMarkConfirmed}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Yes, confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
