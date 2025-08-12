import * as React from "react";
import { Routes, Route } from "react-router-dom";
import Landing from "./views/Landing";
import Program from "./views/Program";
import AdminLogin from "./views/AdminLogin";
import AdminDashboard from "./views/AdminDashboard";
import { AuthProvider, useAuth } from "./utils/auth";
import { JSX } from "react";
const Protected = ({ children }: { children: JSX.Element }) => {
  const { loggedIn } = useAuth();
  if (!loggedIn)
    return (
      <div className="p-8">
        Please{" "}
        <a href="/admin/login" className="text-blue-600">
          login
        </a>
      </div>
    );
  return children;
};
export default () => (
  <AuthProvider>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/program" element={<Program />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <Protected>
            <AdminDashboard />
          </Protected>
        }
      />
    </Routes>
  </AuthProvider>
);
