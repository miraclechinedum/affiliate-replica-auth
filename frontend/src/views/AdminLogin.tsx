import * as React from "react";
import { useState } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import api from "../utils/api";
import { useAuth } from "../utils/auth";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("password123");
  const [err, setErr] = useState("");

  const { setLoggedIn } = useAuth() as any;
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/admin/login", { email, password });
      setLoggedIn(true);
      nav("/admin");
    } catch (error: any) {
      setErr(error?.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="container flex-1">
        <div className="max-w-md mx-auto mt-12 bg-white p-6 rounded shadow">
          <h3 className="text-xl font-semibold mb-4">Admin Login</h3>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-sm">Email</label>
              <input
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border p-2 rounded"
              />
            </div>

            <div>
              <label className="block text-sm">Password</label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border p-2 rounded"
              />
            </div>

            <div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded">
                Login
              </button>
            </div>

            {err && <div className="text-red-600">{err}</div>}
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
