import { Routes, Route } from "react-router-dom";
import Hero from "./pages/Hero";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Wallet from "./pages/Wallet";
import Cards from "./pages/Cards";
import Loans from "./pages/Loans";
import CardDetails from "./pages/CardDetails";
import Assistant from "./pages/Assistant";
import Navbar from "./components/Navbar";
import RequireAuth from "./components/RequireAuth";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";

function Layout({ children }) {
  return (
    <RequireAuth>
      <Navbar />
      {children}
    </RequireAuth>
  );
}

function App() {
  return (
    <Routes>

      {/* HERO */}
      <Route path="/" element={<Hero />} />

      {/* AUTH ROUTES */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* PROTECTED PAGES */}
      <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
      <Route path="/wallet" element={<Layout><Wallet /></Layout>} />
      <Route path="/cards" element={<Layout><Cards /></Layout>} />
      <Route path="/cards/:id" element={<Layout><CardDetails /></Layout>} />
      <Route path="/loans" element={<Layout><Loans /></Layout>} />
      <Route path="/assistant" element={<Layout><Assistant /></Layout>} />

    </Routes>
  );
}

export default App;
