// frontend/src/views/Program.tsx
import * as React from "react";
import { useState, useEffect } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import api from "../utils/api";
import { useNavigate } from "react-router-dom";

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

export default function Program() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [method, setMethod] = useState<"crypto" | "wire">("crypto");
  const [amount, setAmount] = useState("");
  const [txid, setTxid] = useState("");
  const [status, setStatus] = useState("");
  const [expired, setExpired] = useState(false);

  const [timeLeft, setTimeLeft] = useState(14 * 60 + 49); // 14:49 default
  const [accountDetails, setAccountDetails] = useState<AccountDetails | null>(
    null
  );
  const [selectedCrypto, setSelectedCrypto] = useState<"BTC" | "ETH" | "USDT">(
    "USDT"
  );
  const [showWireModal, setShowWireModal] = useState(false);

  const navigate = useNavigate();

  // fetch account details (public)
  useEffect(() => {
    api
      .get("/account-details")
      .then((res) => setAccountDetails(res.data))
      .catch(() => setAccountDetails(null));
  }, []);

  // update deposit address when selectedCrypto or accountDetails changes
  const depositAddress = React.useMemo(() => {
    if (!accountDetails?.crypto) return "";
    if (selectedCrypto === "BTC") return accountDetails.crypto?.btc || "";
    if (selectedCrypto === "ETH") return accountDetails.crypto?.eth || "";
    return accountDetails.crypto?.usdt || "";
  }, [accountDetails, selectedCrypto]);

  // Countdown Timer
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

  // copy address to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Address copied to clipboard");
      setTimeout(() => setStatus(""), 2500);
    } catch {
      setStatus("Copy failed — please copy manually");
    }
  };

  // submit handler
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expired) {
      setStatus("Session expired");
      return;
    }

    // Basic validation
    if (!name || !email || !amount) {
      setStatus("Please complete required fields");
      return;
    }
    if (method === "crypto" && !depositAddress) {
      setStatus("Deposit address not available — contact admin");
      return;
    }

    const fd = new FormData();
    fd.append("name", name);
    fd.append("email", email);
    fd.append("method", method);
    fd.append("amount", amount);
    fd.append("txid", txid);
    fd.append("selectedNetwork", selectedCrypto);
    // id proof file field name -> idFile
    if (idFile) fd.append("idFile", idFile);
    // payment proof file field name -> paymentProof
    if (paymentProof) fd.append("paymentProof", paymentProof);

    try {
      const res = await api.post("/submissions", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setStatus("Submitted: " + res.data.id);
      // clear sensitive fields
      setIdFile(null);
      setPaymentProof(null);
      setTxid("");
      setAmount("");
    } catch (err: any) {
      setStatus(
        "Submission failed: " + (err?.response?.data?.message || err.message)
      );
    }
  };

  const restartProcess = () => {
    // reset state and navigate to program (start over)
    setTimeLeft(14 * 60 + 49);
    setExpired(false);
    setIdFile(null);
    setPaymentProof(null);
    setName("");
    setEmail("");
    navigate("/program");
    // don't reload; fresh state is fine
  };

  // bank details modal content for Request Details
  const renderBankDetails = () => {
    const b = accountDetails?.bank;
    if (!b)
      return <p className="text-sm text-gray-600">No bank details available</p>;
    return (
      <div className="space-y-1 text-sm">
        <div>
          <strong>Bank:</strong> {b.bankName || "-"}
        </div>
        <div>
          <strong>Account name:</strong> {b.accountName || "-"}
        </div>
        <div>
          <strong>Account number:</strong> {b.accountNumber || "-"}
        </div>
        {b.swift && (
          <div>
            <strong>SWIFT:</strong> {b.swift}
          </div>
        )}
        {b.notes && (
          <div className="text-xs text-gray-500">Notes: {b.notes}</div>
        )}
      </div>
    );
  };

  // UI
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Sticky countdown - changes color at <= 5mins */}
      <div
        className={`sticky top-0 z-50 p-3 text-white text-center font-semibold ${
          timeLeft <= 300 ? "bg-red-600" : "bg-blue-600"
        }`}
      >
        You have <span id="countdownTime">{formatTime(timeLeft)}</span> to
        complete the transaction
      </div>

      <main className="flex items-start justify-center min-h-screen p-6">
        <div className="w-full max-w-2xl bg-white p-8 rounded-lg shadow space-y-6">
          <img
            src="https://joinrobin.affiliatepartnerpath.pro/en/sam/program/logo.png"
            alt="Logo"
            className="w-56 mx-auto"
          />

          <h2 className="text-2xl font-bold text-center">Deposit Funds</h2>

          <form onSubmit={submit} className="space-y-4">
            {/* Basic fields */}
            <div>
              <label className="block text-sm font-medium">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border p-2 rounded"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border p-2 rounded"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium">
                Upload Proof of ID
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
                className="w-full"
              />
            </div>

            {/* Payment method tabs */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Payment Method
              </label>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setMethod("wire")}
                  className={`flex-1 p-2 rounded ${
                    method === "wire" ? "bg-gray-100 font-semibold" : "bg-white"
                  }`}
                >
                  Wire Transfer
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("crypto")}
                  className={`flex-1 p-2 rounded ${
                    method === "crypto"
                      ? "bg-gray-100 font-semibold"
                      : "bg-white"
                  }`}
                >
                  Crypto
                </button>
              </div>
            </div>

            {/* Wire Transfer */}
            {method === "wire" && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">
                  Wire Transfer Instructions
                </h3>
                <p className="text-sm text-gray-600">
                  Bank details will be provided upon request. Please ensure your
                  name and email are correct before requesting.
                </p>

                <button
                  type="button"
                  onClick={() => setShowWireModal(true)}
                  className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded w-full"
                >
                  Request Details
                </button>

                <div>
                  <label className="block text-sm font-medium">
                    Amount Sent (USD)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full border p-2 rounded"
                    placeholder="e.g., 500.00"
                    required
                  />
                </div>

                {/* payment proof upload field */}
                <div>
                  <label className="block text-sm font-medium">
                    Upload Payment Proof
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) =>
                      setPaymentProof(e.target.files?.[0] ?? null)
                    }
                    className="w-full"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded"
                  >
                    Submit Wire Payment
                  </button>
                </div>
              </div>
            )}

            {/* Crypto */}
            {method === "crypto" && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">
                  Crypto Deposit Instructions
                </h3>

                <div>
                  <label className="block text-sm font-medium">
                    Select Cryptocurrency
                  </label>
                  <select
                    className="w-full border p-2 rounded"
                    value={selectedCrypto}
                    onChange={(e) => setSelectedCrypto(e.target.value as any)}
                  >
                    <option value="USDT">Tether (USDT)</option>
                    <option value="BTC">Bitcoin (BTC)</option>
                    <option value="ETH">Ethereum (ETH)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">
                    Deposit Address
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={depositAddress}
                      className="w-full border p-2 rounded pr-12 bg-gray-50"
                    />
                    <button
                      type="button"
                      aria-label="Copy deposit address"
                      onClick={() => copyToClipboard(depositAddress)}
                      className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-600 hover:text-gray-900"
                    >
                      {/* simple copy icon */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M8 16h8M8 8h8m-8 0h8M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2h-4l-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs mt-1 text-red-600">
                    <strong>Important:</strong> Only send {selectedCrypto} (
                    {depositAddress || "address not available"}) to this
                    address. Sending other cryptos will result in loss of funds.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium">
                    Amount Sent (USD)
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full border p-2 rounded"
                    placeholder="e.g., 100.00"
                    required
                  />
                </div>

                {/* payment proof upload */}
                <div>
                  <label className="block text-sm font-medium">
                    Upload Payment Proof
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) =>
                      setPaymentProof(e.target.files?.[0] ?? null)
                    }
                    className="w-full"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded"
                  >
                    Submit Crypto Payment
                  </button>
                </div>
              </div>
            )}
          </form>

          {status && <div className="text-sm text-gray-700">{status}</div>}
        </div>
      </main>

      <Footer />

      {/* Wire details modal */}
      {showWireModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Wire Transfer Details</h3>
            <div>{renderBankDetails()}</div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowWireModal(false)}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                Close
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    JSON.stringify(accountDetails?.bank || {})
                  );
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Copy Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time expired modal */}
      {expired && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full text-center space-y-4">
            <h3 className="text-xl font-bold">TIME EXPIRED</h3>
            <p>
              We are sorry, too much time has passed. Please go back to restart
              this process.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={restartProcess}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Restart Process
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
