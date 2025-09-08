import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "../components/Header";
import Footer from "../components/Footer";
import api from "../utils/api";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Save,
  RefreshCw,
  Download,
  X,
  Search,
  Filter,
  ChevronDown,
  ExternalLink,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  CreditCard,
  Wallet,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Check,
} from "lucide-react";

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

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        {trend && (
          <p
            className={`text-sm mt-2 ${
              trend > 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {trend > 0 ? "↗" : "↘"} {Math.abs(trend)}% vs last month
          </p>
        )}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
  </motion.div>
);

export default function AdminDashboard() {
  const [details, setDetails] = useState<DetailsShape | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);

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
      toast.success("Account details saved successfully!");
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
      toast.success("Submission marked as confirmed!");
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

    out.sort((a, b) => {
      let va: any = a[sortKey];
      let vb: any = b[sortKey];

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

  const stats = useMemo(() => {
    const total = subs.length;
    const pending = subs.filter(
      (s) => s.status === "pending" || !s.status
    ).length;
    const confirmed = subs.filter((s) => s.status === "confirmed").length;
    const totalAmount = subs.reduce((sum, s) => sum + Number(s.amount || 0), 0);

    return { total, pending, confirmed, totalAmount };
  }, [subs]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

  const SortButton = ({
    field,
    children,
  }: {
    field: typeof sortKey;
    children: React.ReactNode;
  }) => (
    <button
      className="flex items-center space-x-1 hover:text-gray-900 transition-colors"
      onClick={() => {
        if (sortKey === field) {
          setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
          setSortKey(field);
          setSortDir("desc");
        }
      }}
    >
      <span>{children}</span>
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"
          />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />

      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        toastClassName="shadow-lg"
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600 mt-2">
            Manage account details and payment submissions
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Submissions"
            value={stats.total}
            icon={Users}
            trend={12}
            color="bg-blue-500"
          />
          <StatCard
            title="Pending"
            value={stats.pending}
            icon={Clock}
            trend={-5}
            color="bg-orange-500"
          />
          <StatCard
            title="Confirmed"
            value={stats.confirmed}
            icon={CheckCircle}
            trend={18}
            color="bg-green-500"
          />
          <StatCard
            title="Total Amount"
            value={`$${stats.totalAmount.toLocaleString()}`}
            icon={DollarSign}
            trend={25}
            color="bg-purple-500"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="xl:col-span-1"
          >
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Account Details
                  </h3>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Bank Information
                  </h4>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bank Name
                      </label>
                      <input
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="Enter bank name"
                        value={details?.bank?.bankName || ""}
                        onChange={(e) =>
                          setDetails({
                            ...details!,
                            bank: {
                              ...details?.bank,
                              bankName: e.target.value,
                            },
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Account Name
                      </label>
                      <input
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="Enter account name"
                        value={details?.bank?.accountName || ""}
                        onChange={(e) =>
                          setDetails({
                            ...details!,
                            bank: {
                              ...details?.bank,
                              accountName: e.target.value,
                            },
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Account Number
                      </label>
                      <input
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="Enter account number"
                        value={details?.bank?.accountNumber || ""}
                        onChange={(e) =>
                          setDetails({
                            ...details!,
                            bank: {
                              ...details?.bank,
                              accountNumber: e.target.value,
                            },
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        SWIFT / BIC
                      </label>
                      <input
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="Enter SWIFT code"
                        value={details?.bank?.swift || ""}
                        onChange={(e) =>
                          setDetails({
                            ...details!,
                            bank: { ...details?.bank, swift: e.target.value },
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notes (optional)
                      </label>
                      <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        rows={3}
                        placeholder="Additional notes"
                        value={details?.bank?.notes || ""}
                        onChange={(e) =>
                          setDetails({
                            ...details!,
                            bank: { ...details?.bank, notes: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                    <Wallet className="h-4 w-4 mr-2" />
                    Crypto Addresses
                  </h4>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        BTC Address
                      </label>
                      <input
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors font-mono text-sm"
                        placeholder="Bitcoin address"
                        value={details?.crypto?.btc || ""}
                        onChange={(e) =>
                          setDetails({
                            ...details!,
                            crypto: { ...details?.crypto, btc: e.target.value },
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ETH Address
                      </label>
                      <input
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors font-mono text-sm"
                        placeholder="Ethereum address"
                        value={details?.crypto?.eth || ""}
                        onChange={(e) =>
                          setDetails({
                            ...details!,
                            crypto: { ...details?.crypto, eth: e.target.value },
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        USDT Address
                      </label>
                      <input
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors font-mono text-sm"
                        placeholder="USDT address"
                        value={details?.crypto?.usdt || ""}
                        onChange={(e) =>
                          setDetails({
                            ...details!,
                            crypto: {
                              ...details?.crypto,
                              usdt: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4 border-t border-gray-100">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={save}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {saving ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                      />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {saving ? "Saving..." : "Save Details"}
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={load}
                    disabled={loading}
                    className="flex items-center justify-center px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                    />
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="xl:col-span-2"
          >
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <FileText className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Payment Submissions
                      </h3>
                      <p className="text-sm text-gray-600">
                        Showing {filtered.length} of {subs.length} submissions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={exportCSV}
                      className="flex items-center px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={clearFilters}
                      className="flex items-center px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </motion.button>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      placeholder="Search name, email, ID, txid..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>

                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <select
                      value={filterMethod}
                      onChange={(e) => {
                        setFilterMethod(e.target.value as any);
                        setPage(1);
                      }}
                      className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors appearance-none bg-white"
                    >
                      <option value="">All methods</option>
                      <option value="crypto">Crypto</option>
                      <option value="wire">Wire</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>

                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <select
                      value={filterStatus}
                      onChange={(e) => {
                        setFilterStatus(e.target.value as any);
                        setPage(1);
                      }}
                      className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors appearance-none bg-white"
                    >
                      <option value="">All status</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <SortButton field="amount">Amount</SortButton>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <SortButton field="created_at">Date</SortButton>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <SortButton field="status">Status</SortButton>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    <AnimatePresence>
                      {pageRows.length === 0 && (
                        <motion.tr
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <td
                            colSpan={7}
                            className="px-6 py-12 text-center text-gray-500"
                          >
                            <div className="flex flex-col items-center">
                              <FileText className="h-12 w-12 text-gray-300 mb-4" />
                              <p className="text-lg font-medium text-gray-900 mb-1">
                                No submissions found
                              </p>
                              <p className="text-sm text-gray-500">
                                Try adjusting your search or filters
                              </p>
                            </div>
                          </td>
                        </motion.tr>
                      )}
                      {pageRows.map((submission) => (
                        <motion.tr
                          key={submission.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <span className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                              {submission.id.slice(0, 8)}...
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {submission.name || "—"}
                              </div>
                              <div className="text-sm text-gray-500">
                                {submission.email || "—"}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  submission.method === "crypto"
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {submission.method === "crypto" ? (
                                  <Wallet className="h-3 w-3 mr-1" />
                                ) : (
                                  <CreditCard className="h-3 w-3 mr-1" />
                                )}
                                {submission.method || "—"}
                              </span>
                              {submission.selectedNetwork && (
                                <span className="ml-2 text-xs text-gray-500">
                                  {submission.selectedNetwork}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-semibold text-gray-900">
                              ${Number(submission.amount || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-500">
                              {submission.created_at
                                ? new Date(
                                    submission.created_at
                                  ).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                submission.status === "confirmed"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {submission.status === "confirmed" ? (
                                <CheckCircle className="h-3 w-3 mr-1" />
                              ) : (
                                <Clock className="h-3 w-3 mr-1" />
                              )}
                              {submission.status || "pending"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2">
                              {submission.idFileUrl && (
                                <a
                                  href={submission.idFileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                  <FileText className="h-4 w-4" />
                                </a>
                              )}
                              {submission.paymentProofUrl && (
                                <a
                                  href={submission.paymentProofUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                  <ImageIcon className="h-4 w-4" />
                                </a>
                              )}
                              {submission.status !== "confirmed" && (
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  disabled={!!updatingIds[submission.id]}
                                  onClick={() => confirmMark(submission.id)}
                                  className="flex items-center px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  {updatingIds[submission.id] ? (
                                    <motion.div
                                      animate={{ rotate: 360 }}
                                      transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                        ease: "linear",
                                      }}
                                      className="w-3 h-3 border border-white border-t-transparent rounded-full mr-1"
                                    />
                                  ) : (
                                    <Check className="h-3 w-3 mr-1" />
                                  )}
                                  {updatingIds[submission.id]
                                    ? "..."
                                    : "Confirm"}
                                </motion.button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing{" "}
                    <span className="font-medium">
                      {(page - 1) * PAGE_SIZE + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-medium">
                      {Math.min(page * PAGE_SIZE, filtered.length)}
                    </span>{" "}
                    of <span className="font-medium">{filtered.length}</span>{" "}
                    results
                  </div>

                  <div className="flex items-center space-x-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </motion.button>

                    <div className="flex items-center space-x-1">
                      {Array.from(
                        { length: Math.min(5, totalPages) },
                        (_, i) => {
                          const pageNum =
                            Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                          return (
                            <motion.button
                              key={pageNum}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setPage(pageNum)}
                              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                                pageNum === page
                                  ? "bg-blue-600 text-white"
                                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              {pageNum}
                            </motion.button>
                          );
                        }
                      )}
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />

      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Confirm Submission
                </h3>
              </div>

              <p className="text-gray-600 mb-6">
                Are you sure you want to mark this submission as confirmed? This
                action cannot be undone.
              </p>

              <div className="flex space-x-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={doMarkConfirmed}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Confirm
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
