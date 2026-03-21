import { useEffect, useState } from "react";
import API from "../services/api";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement);

export default function SpendAnalytics() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const res = await API.get("/cards/spendings");
    setData(res.data);
  };

  if (!data) return null;

  const chartData = {
    labels: data.transactions.map(t => t.merchant),
    datasets: [
      {
        label: "Spendings",
        data: data.transactions.map(t => t.amount),
        backgroundColor: "rgba(99,102,241,0.7)"
      }
    ]
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <h2 className="text-xl font-semibold mb-4">
        Spending Analytics
      </h2>
      <Bar data={chartData} />
    </div>
  );
}