import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Dashboard = () => {
  const { user, logout } = useAuth();
const navigate = useNavigate();
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h2>MediBook</h2>

        <button
  onClick={() => {
    logout();
    navigate("/login");
  }}
>
  Logout
</button>
      </header>

      <main className="dashboard-content">
        <h1>Welcome, {user?.name}!</h1>

        <p>You are successfully logged in to MediBook.</p>

        <div className="dashboard-card">
          <h3>Your Account Information</h3>

          <p>
            <strong>Name:</strong> {user?.name}
          </p>

          <p>
            <strong>Email:</strong> {user?.email}
          </p>

          <p>
            <strong>Role:</strong> {user?.role}
          </p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;