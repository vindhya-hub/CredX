// import { BrowserRouter, Routes, Route } from "react-router-dom";
// import Hero from "./pages/Hero";
// import Login from "./pages/Login";
// import Dashboard from "./pages/Dashboard";
// import Wallet from "./pages/Wallet";
// import Cards from "./pages/Cards";
// import Loans from "./pages/Loans";
// import CardDetails from "./pages/CardDetails";
// import Navbar from "./components/Navbar";
// import Register from "./pages/Register";
// import ForgotPassword from "./pages/ForgotPassword";

// function Layout({ children }) {
//   return (
//     <>
//       <Navbar />
//       {children}
//     </>
//   );
// }

// function App() {
//   return (
//     <BrowserRouter>
//       <Routes>

//         {/* HERO */}
//         <Route path="/" element={<Hero />} />

//         {/* AUTH ROUTES */}
//         <Route path="/login" element={<Login />} />
//         <Route path="/register" element={<Register />} />
//         <Route path="/forgot-password" element={<ForgotPassword />} />

//         {/* PROTECTED PAGES */}
//         <Route
//           path="/dashboard"
//           element={
//             <Layout>
//               <Dashboard />
//             </Layout>
//           }
//         />

//         <Route
//           path="/wallet"
//           element={
//             <Layout>
//               <Wallet />
//             </Layout>
//           }
//         />

//         <Route
//           path="/cards"
//           element={
//             <Layout>
//               <Cards />
//             </Layout>
//           }
//         />

//         <Route
//           path="/cards/:id"
//           element={
//             <Layout>
//               <CardDetails />
//             </Layout>
//           }
//         />

//         <Route
//           path="/loans"
//           element={
//             <Layout>
//               <Loans />
//             </Layout>
//           }
//         />

//       </Routes>
//     </BrowserRouter>
//   );
// }

// export default App;
import { Routes, Route } from "react-router-dom";
import Hero from "./pages/Hero";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Wallet from "./pages/Wallet";
import Cards from "./pages/Cards";
import Loans from "./pages/Loans";
import CardDetails from "./pages/CardDetails";
import Navbar from "./components/Navbar";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";

function Layout({ children }) {
  return (
    <>
      <Navbar />
      {children}
    </>
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
      <Route
        path="/dashboard"
        element={
          <Layout>
            <Dashboard />
          </Layout>
        }
      />

      <Route
        path="/wallet"
        element={
          <Layout>
            <Wallet />
          </Layout>
        }
      />

      <Route
        path="/cards"
        element={
          <Layout>
            <Cards />
          </Layout>
        }
      />

      <Route
        path="/cards/:id"
        element={
          <Layout>
            <CardDetails />
          </Layout>
        }
      />

      <Route
        path="/loans"
        element={
          <Layout>
            <Loans />
          </Layout>
        }
      />

    </Routes>
  );
}

export default App;