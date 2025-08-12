import * as React from "react";
import { useEffect, useState } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import api from "../utils/api";
import { useAuth } from "../utils/auth";

export default function AdminDashboard() {
  const { setLoggedIn } = useAuth() as any;
  const [details, setDetails] = useState<any>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [pw, setPw] = useState("");

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  const load = async () => {
    const d = await api.get("/account-details");
    setDetails(d.data);
    try {
      const s = await api.get("/submissions");
      setSubs(s.data);
    } catch (e) {}
  };

  const save = async () => {
    await api.put("/account-details", details);
    alert("Saved");
  };

  const confirmOne = async (id: string) => {
    await api.put("/submissions/" + id + "/status", { status: "confirmed" });
    load();
  };

  const changePw = async () => {
    if (!pw) return alert("enter new password");
    await api.post("/admin/change-password", { password: pw });
    alert("Password changed");
    setPw("");
  };

  const logout = async () => {
    await api.post("/admin/logout");
    setLoggedIn(false);
    window.location.href = "/";
  };

  return (
    <>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="container flex-1">
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded shadow">
              <h4 className="font-semibold mb-2">Account Details</h4>
              <label className="block text-sm">Bank Account Name</label>
              <input
                className="w-full border p-2 rounded mb-2"
                value={details?.bankAccountName || ""}
                onChange={(e) =>
                  setDetails({ ...details, bankAccountName: e.target.value })
                }
              />
              <label className="block text-sm">Bank Account Number</label>
              <input
                className="w-full border p-2 rounded mb-2"
                value={details?.bankAccountNumber || ""}
                onChange={(e) =>
                  setDetails({ ...details, bankAccountNumber: e.target.value })
                }
              />
              <label className="block text-sm">Crypto Address (BTC)</label>
              <input
                className="w-full border p-2 rounded mb-2"
                value={details?.cryptoBtc || ""}
                onChange={(e) =>
                  setDetails({ ...details, cryptoBtc: e.target.value })
                }
              />
              <button
                onClick={save}
                className="bg-green-600 text-white px-4 py-2 rounded"
              >
                Save Details
              </button>
            </div>
            <div className="bg-white p-6 rounded shadow">
              <h4 className="font-semibold mb-2">Submissions</h4>
              <div className="space-y-3">
                {subs.map((s) => (
                  <div key={s.id} className="p-2 border rounded">
                    <div className="text-sm">
                      <strong>{s.name}</strong> — {s.email}
                    </div>
                    <div className="text-xs text-gray-600">
                      Method: {s.method} — Amount: {s.amount} — Status:{" "}
                      {s.status}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <a
                        className="text-blue-600"
                        href={s.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View ID
                      </a>
                      {s.status !== "confirmed" && (
                        <button
                          className="bg-blue-600 text-white px-2 py-1 rounded"
                          onClick={() => confirmOne(s.id)}
                        >
                          Mark Confirmed
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {subs.length === 0 && (
                  <div className="text-sm text-gray-600">
                    No submissions yet
                  </div>
                )}
              </div>
              <div className="mt-4">
                <h5 className="font-semibold">Admin Password</h5>
                <input
                  type="password"
                  className="w-full border p-2 rounded"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="New password"
                />
                <button
                  onClick={changePw}
                  className="mt-2 bg-yellow-600 text-white px-3 py-2 rounded"
                >
                  Change Password
                </button>
              </div>
              <div className="mt-4">
                <button
                  onClick={logout}
                  className="bg-red-600 text-white px-3 py-2 rounded"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
