import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
// import Header from "../components/Header";
import Footer from "../components/Footer";
import api from "../utils/api";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Clock,
  Copy,
  CheckCircle,
  AlertTriangle,
  Upload,
  CreditCard,
  Wallet,
  User,
  Mail,
  DollarSign,
  FileText,
  X,
  RefreshCw,
  Lock,
  Zap,
} from "lucide-react";

type AccountDetails = {
  bank?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    swift?: string;
    notes?: string;
  };
  crypto?: {
    btc?: string;
    eth?: string;
    usdt?: string;
    [key: string]: any;
  };
};

const LoadingSpinner = () => (
  <motion.div
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
  />
);

const SecurityBadge = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800"
  >
    <Shield className="h-4 w-4" />
    <span className="font-medium">256-bit SSL Encrypted</span>
  </motion.div>
);

export default function Program() {
  const [pageLoading, setPageLoading] = useState(true);
  const [loaderText, setLoaderText] = useState(
    "Initializing secure connection..."
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [method, setMethod] = useState<"crypto" | "wire">("crypto");
  const [amount, setAmount] = useState("");
  const [txid, setTxid] = useState("");
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);

  const [timeLeft, setTimeLeft] = useState(14 * 60 + 49);
  const [accountDetails, setAccountDetails] = useState<AccountDetails | null>(
    null
  );
  const [selectedCrypto, setSelectedCrypto] = useState<"BTC" | "ETH" | "USDT">(
    "USDT"
  );
  const [showWireModal, setShowWireModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const idFileRef = useRef<HTMLInputElement | null>(null);
  const paymentProofRef = useRef<HTMLInputElement | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const messages = [
      "Initializing secure connection...",
      "Verifying security protocols...",
      "Establishing encrypted tunnel...",
      "Loading payment interface...",
    ];

    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      setLoaderText(messages[messageIndex]);
    }, 1500);

    const t2 = setTimeout(() => {
      clearInterval(messageInterval);
      setPageLoading(false);
    }, 6000);

    return () => {
      clearInterval(messageInterval);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    api
      .get("/account-details")
      .then((res) => setAccountDetails(res.data))
      .catch(() => {
        setAccountDetails(null);
        toast.error("Failed to load payment details");
      });
  }, []);

  useEffect(() => {
    if (expired) return;
    if (timeLeft <= 0) {
      setExpired(true);
      return;
    }
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, expired]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const depositAddress = React.useMemo(() => {
    if (!accountDetails?.crypto) return "";
    if (selectedCrypto === "BTC") return accountDetails.crypto?.btc || "";
    if (selectedCrypto === "ETH") return accountDetails.crypto?.eth || "";
    return accountDetails.crypto?.usdt || "";
  }, [accountDetails, selectedCrypto]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Address copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy - please copy manually");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expired) {
      toast.error("Session expired - please restart");
      return;
    }
    if (!name || !email || !amount) {
      toast.error("Please complete all required fields");
      return;
    }
    if (method === "crypto" && !depositAddress) {
      toast.error("Deposit address not available - contact support");
      return;
    }

    const fd = new FormData();
    fd.append("name", name);
    fd.append("email", email);
    fd.append("method", method);
    fd.append("amount", amount);
    fd.append("txid", txid);
    fd.append("selectedNetwork", selectedCrypto);
    if (idFile) fd.append("idFile", idFile);
    if (paymentProof) fd.append("paymentProof", paymentProof);

    try {
      setLoading(true);
      await api.post("/submissions", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(
        "Payment submitted successfully! You will receive confirmation shortly."
      );

      setName("");
      setEmail("");
      setIdFile(null);
      setPaymentProof(null);
      setTxid("");
      setAmount("");
      setSelectedCrypto("USDT");
      setMethod("crypto");

      if (idFileRef.current) idFileRef.current.value = "";
      if (paymentProofRef.current) paymentProofRef.current.value = "";
    } catch (err: any) {
      toast.error(
        "Submission failed: " + (err?.response?.data?.message || err.message)
      );
    } finally {
      setLoading(false);
    }
  };

  const restartProcess = () => {
    setTimeLeft(14 * 60 + 49);
    setExpired(false);
    setIdFile(null);
    setPaymentProof(null);
    setName("");
    setEmail("");
    navigate("/program");
  };

  const renderBankDetails = () => {
    const b = accountDetails?.bank;
    if (!b)
      return (
        <div className="text-center py-4">
          <AlertTriangle className="h-8 w-8 text-orange-500 mx-auto mb-2" />
          <p className="text-gray-600">No bank details available</p>
        </div>
      );

    return (
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">Bank Name:</span>
            <span className="text-gray-900">{b.bankName || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">Account Name:</span>
            <span className="text-gray-900">{b.accountName || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">Account Number:</span>
            <span className="text-gray-900 font-mono">
              {b.accountNumber || "—"}
            </span>
          </div>
          {b.swift && (
            <div className="flex justify-between">
              <span className="font-medium text-gray-700">SWIFT/BIC:</span>
              <span className="text-gray-900 font-mono">{b.swift}</span>
            </div>
          )}
        </div>
        {b.notes && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Important Notes:</strong> {b.notes}
            </p>
          </div>
        )}
      </div>
    );
  };

  const getCryptoIcon = (crypto: string) => {
    switch (crypto) {
      case "BTC":
        return "₿";
      case "ETH":
        return "Ξ";
      case "USDT":
        return "₮";
      default:
        return "₿";
    }
  };

  if (pageLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white z-50"
      >
        <motion.div
          animate={{
            rotate: 360,
            scale: [1, 1.1, 1],
          }}
          transition={{
            rotate: { duration: 2, repeat: Infinity, ease: "linear" },
            scale: { duration: 1, repeat: Infinity },
          }}
          className="w-16 h-16 border-4 border-white border-t-transparent rounded-full mb-6"
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <p className="text-xl font-semibold mb-2">{loaderText}</p>
          <div className="flex items-center justify-center space-x-2 text-sm text-blue-200">
            <Lock className="h-4 w-4" />
            <span className="text-[#f2f2f2]">Secure Payment Portal</span>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* <Header /> */}

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

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`sticky top-0 z-40 transition-colors duration-300 ${
          timeLeft <= 300
            ? "bg-gradient-to-r from-red-600 to-red-700"
            : "bg-gradient-to-r from-blue-600 to-indigo-600"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-center space-x-3 text-white">
            <Clock className="h-5 w-5" />
            <span className="font-semibold">
              Session expires in:{" "}
              <span className="font-mono text-lg">{formatTime(timeLeft)}</span>
            </span>
            {timeLeft <= 300 && (
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <AlertTriangle className="h-5 w-5 text-yellow-300" />
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-gray-100">
            <div className="text-center space-y-4">
              <motion.img
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                src="https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg?auto=compress&cs=tinysrgb&w=200&h=60&fit=crop"
                alt="Secure Payment Portal"
                className="h-16 mx-auto rounded-lg shadow-sm"
              />
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Secure Payment Portal
                </h1>
                <p className="text-gray-600">
                  Complete your transaction safely and securely
                </p>
              </div>
              <SecurityBadge />
            </div>
          </div>

          <div className="p-8">
            <form onSubmit={submit} className="space-y-8">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-6"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Personal Information
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="Enter your full name"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="Enter your email address"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Proof of Identity *
                  </label>
                  <div className="relative">
                    <input
                      ref={idFileRef}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Upload a clear photo of your government-issued ID (passport,
                    driver's license, etc.)
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-6"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Payment Method
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setMethod("crypto")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      method === "crypto"
                        ? "border-blue-500 bg-blue-50 shadow-md"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Wallet
                        className={`h-6 w-6 ${
                          method === "crypto"
                            ? "text-blue-600"
                            : "text-gray-400"
                        }`}
                      />
                      <div className="text-left">
                        <div
                          className={`font-semibold ${
                            method === "crypto"
                              ? "text-blue-900"
                              : "text-gray-700"
                          }`}
                        >
                          Cryptocurrency
                        </div>
                        <div className="text-sm text-gray-500">
                          Bitcoin, Ethereum, USDT
                        </div>
                      </div>
                    </div>
                  </motion.button>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setMethod("wire")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      method === "wire"
                        ? "border-blue-500 bg-blue-50 shadow-md"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <CreditCard
                        className={`h-6 w-6 ${
                          method === "wire" ? "text-blue-600" : "text-gray-400"
                        }`}
                      />
                      <div className="text-left">
                        <div
                          className={`font-semibold ${
                            method === "wire"
                              ? "text-blue-900"
                              : "text-gray-700"
                          }`}
                        >
                          Wire Transfer
                        </div>
                        <div className="text-sm text-gray-500">
                          Bank to bank transfer
                        </div>
                      </div>
                    </div>
                  </motion.button>
                </div>
              </motion.div>

              <AnimatePresence>
                {method === "wire" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                      <div className="flex items-start space-x-3">
                        <CreditCard className="h-6 w-6 text-blue-600 mt-1" />
                        <div>
                          <h3 className="text-lg font-semibold text-blue-900 mb-2">
                            Wire Transfer Instructions
                          </h3>
                          <p className="text-blue-800 mb-4">
                            Click below to view our bank details. Ensure your
                            information is correct before requesting.
                          </p>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowWireModal(true)}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <FileText className="h-4 w-4" />
                            <span>View Bank Details</span>
                          </motion.button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount Sent (USD) *
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Proof
                      </label>
                      <input
                        ref={paymentProofRef}
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) =>
                          setPaymentProof(e.target.files?.[0] ?? null)
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Upload your wire transfer receipt or confirmation
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {method === "crypto" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="border border-black-200 rounded-xl p-6">
                      <div className="flex items-start space-x-3">
                        <Wallet className="h-6 w-6 text-blue-600 mt-1" />
                        <div>
                          <h3 className="text-lg font-semibold text-black-900 mb-2">
                            Cryptocurrency Payment
                          </h3>
                          <p className="text-black-800">
                            Send your cryptocurrency to the address below. Only
                            send the selected currency type.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Cryptocurrency
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {(["USDT", "BTC", "ETH"] as const).map((crypto) => (
                          <motion.button
                            key={crypto}
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedCrypto(crypto)}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              selectedCrypto === crypto
                                ? "border-blue-500 bg-blue-50 shadow-md"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                          >
                            <div className="text-center">
                              <div
                                className={`text-2xl mb-1 ${
                                  selectedCrypto === crypto
                                    ? "text-black-600"
                                    : "text-black-200"
                                }`}
                              >
                                {getCryptoIcon(crypto)}
                              </div>
                              <div
                                className={`font-semibold text-sm ${
                                  selectedCrypto === crypto
                                    ? "text-black-600"
                                    : "text-black-200"
                                }`}
                              >
                                {crypto}
                              </div>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Deposit Address
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          readOnly
                          value={depositAddress}
                          className="w-full pr-12 py-3 px-4 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                          placeholder="Loading address..."
                        />
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => copyToClipboard(depositAddress)}
                          className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-600 hover:text-blue-600 transition-colors"
                        >
                          {copied ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <Copy className="h-5 w-5" />
                          )}
                        </motion.button>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                        <div className="flex items-start space-x-2">
                          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-red-800">
                            <strong>Critical:</strong> Only send{" "}
                            {selectedCrypto} to this address. Sending other
                            cryptocurrencies will result in permanent loss of
                            funds.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount Sent (USD) *
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Proof
                      </label>
                      <input
                        ref={paymentProofRef}
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) =>
                          setPaymentProof(e.target.files?.[0] ?? null)
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Upload a screenshot of your transaction confirmation
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="pt-6 border-t border-gray-200"
              >
                <motion.button
                  type="submit"
                  disabled={loading || expired}
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  className={`w-full flex items-center justify-center space-x-3 px-6 py-4 rounded-xl font-semibold text-lg transition-all ${
                    loading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-black hover:bg-neutral-900 shadow-lg hover:shadow-xl"
                  } text-white`}
                >
                  {loading ? (
                    <>
                      <LoadingSpinner />
                      <span>Processing Payment...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        I have paid via{" "}
                        {method === "crypto" ? "Crypto" : "Wire"}
                      </span>
                      <Zap className="h-5 w-5" />
                    </>
                  )}
                </motion.button>
              </motion.div>
            </form>
          </div>
        </motion.div>
      </main>

      <Footer />

      <AnimatePresence>
        {showWireModal && (
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
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Wire Transfer Details
                  </h3>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowWireModal(false)}
                    className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </motion.button>
                </div>
              </div>

              <div className="p-6">
                {renderBankDetails()}

                <div className="flex space-x-3 mt-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowWireModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    Close
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      const details = JSON.stringify(
                        accountDetails?.bank || {},
                        null,
                        2
                      );
                      navigator.clipboard.writeText(details);
                      toast.success("Bank details copied!");
                    }}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Copy className="h-4 w-4" />
                    <span>Copy Details</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expired && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </motion.div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Session Expired
              </h3>
              <p className="text-gray-600 mb-6">
                Your session has timed out for security reasons. Please restart
                the process to continue.
              </p>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={restartProcess}
                className="flex items-center justify-center space-x-2 w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Restart Process</span>
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
