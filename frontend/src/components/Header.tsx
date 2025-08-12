import * as React from "react";
import { Link } from "react-router-dom";
export default () => (
  <header className="bg-white shadow">
    <div className="container flex items-center justify-between">
      <Link to="/" className="text-xl font-semibold">
        <img
          src="https://joinrobin.affiliatepartnerpath.pro/logo.png"
          alt="Logo"
          width="300"
        />
      </Link>
      <nav>
        <Link
          to="/program"
          className="xtext-gray-600 xhover:text-green-500 font-medium"
        >
          Affiliate Program
        </Link>
      </nav>
    </div>
  </header>
);
