import * as React from "react";
import { useState, useEffect } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import api from "../utils/api";
import { useNavigate } from "react-router-dom";

export default function Program() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [method, setMethod] = useState<"crypto" | "wire">("wire");
  const [amount, setAmount] = useState("");
  const [txid, setTxid] = useState("");
  const [status, setStatus] = useState("");
  const [expired, setExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState(14 * 60 + 49); // 14 min 49 sec
  const nav = useNavigate();

  // Countdown Timer Logic
  useEffect(() => {
    if (expired) return;
    if (timeLeft <= 0) {
      setExpired(true);
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, expired]);

  // Format time
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Submit handler
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expired) {
      setStatus("Session expired");
      return;
    }
    const fd = new FormData();
    fd.append("name", name);
    fd.append("email", email);
    fd.append("method", method);
    fd.append("amount", amount);
    fd.append("txid", txid);
    if (file) fd.append("file", file);
    try {
      const res = await api.post("/submissions", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setStatus("Submitted: " + res.data.id);
      setFile(null);
      setTxid("");
      setAmount("");
    } catch (err: any) {
      setStatus("Error: " + (err?.response?.data?.message || err.message));
    }
  };

  // Restart process
  const restartProcess = () => {
    nav("/program");
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Sticky Countdown Banner */}
      <div
        id="countdownBanner"
        className={`sticky top-0 z-50 p-3 text-white text-center font-bold ${
          timeLeft <= 300 ? "bg-red-600" : "bg-blue-600"
        }`}
      >
        You have <span id="countdownTime">{formatTime(timeLeft)}</span> minutes
        to complete the transaction
      </div>

      <main className="flex items-center justify-center min-h-screen p-4">
        <div className="card w-full max-w-xl p-8 space-y-6 rounded-xl">
          <img
            src="https://joinrobin.affiliatepartnerpath.pro/en/sam/program/logo.png"
            alt="Logo"
            className="w-[300px] mx-auto"
          />
          <h2 className="text-3xl font-bold text-gray-900 text-center">
            Deposit Funds
          </h2>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="john.doe@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Upload Proof of ID
              </label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="input-field p-2"
                accept="image/*,application/pdf"
              />
            </div>
          </div>

          {/* Payment Method Tabs */}
          <div className="space-y-4">
            <label className="block text-sm font-medium mb-1">
              Select Payment Method
            </label>
            <div className="flex space-x-2 p-1 bg-gray-100 rounded-md">
              <button
                type="button"
                className={`tab-button flex-1 ${
                  method === "wire" ? "bg-white shadow font-bold" : ""
                }`}
                onClick={() => setMethod("wire")}
              >
                Wire Transfer
              </button>
              <button
                type="button"
                className={`tab-button flex-1 ${
                  method === "crypto" ? "bg-white shadow font-bold" : ""
                }`}
                onClick={() => setMethod("crypto")}
              >
                Crypto
              </button>
            </div>
          </div>

          {/* Wire Transfer Section */}
          {method === "wire" && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">
                Wire Transfer Instructions
              </h3>
              <p className="text-sm text-gray-600">
                Bank details will be provided upon request.
              </p>
              <input
                type="number"
                placeholder="Amount Sent (USD)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field"
              />
              <button className="btn-primary w-full">
                I have paid via Wire
              </button>
            </div>
          )}

          {/* Crypto Section */}
          {method === "crypto" && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">
                Crypto Deposit Instructions
              </h3>
              <select className="input-field">
                <option>USDT</option>
                <option>BTC</option>
                <option>ETH</option>
              </select>
              <input
                type="number"
                placeholder="Amount Sent (USD)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field"
              />
              <button className="btn-primary w-full">
                I have paid via Crypto
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Time Expired Modal */}
      {expired && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full space-y-4 text-center">
            <h3 className="text-xl font-bold">TIME EXPIRED</h3>
            <p>
              We are sorry, too much time has passed. Please go back to restart
              this process.
            </p>
            <button
              onClick={restartProcess}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Restart Process
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
