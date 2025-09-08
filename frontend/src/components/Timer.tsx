import React, { useEffect, useState } from "react";
export default function Timer({
  seconds = 900,
  onExpire,
  running = true,
}: {
  seconds?: number;
  onExpire?: () => void;
  running?: boolean;
}) {
  const [t, setT] = useState(seconds);
  useEffect(() => {
    if (!running) return;
    if (t <= 0) {
      onExpire && onExpire();
      return;
    }
    const id = setInterval(() => setT((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [t, running]);
  const mm = Math.floor(t / 60)
    .toString()
    .padStart(2, "0");
  const ss = (t % 60).toString().padStart(2, "0");
  return (
    <div className="text-sm text-gray-700">
      Time left: {mm}:{ss}
    </div>
  );
}
