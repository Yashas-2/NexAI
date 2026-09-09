import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";

const ROLE_PATHS: Record<string, string> = {
  CHIEF_SUPERINTENDENT: "/coe",
  HOD: "/hod",
  PAPER_SETTER: "/setter",
  EVALUATOR: "/evaluator",
  SCRUTINIZER: "/scrutinizer",
  SCANNING_OFFICER: "/scanning",
  FACULTY: "/faculty",
  INVIGILATOR: "/mobile-app",
  STUDENT: "/mobile-app",
};

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login/", form);
      login(data.user, data.access, data.refresh);
      toast.success(`Welcome, ${data.user.full_name}!`);
      navigate(ROLE_PATHS[data.user.role] ?? "/");
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors?.[0] ||
        (err?.message === 'Network Error' ? 'Cannot reach server. Is the backend running?' : 'Login failed. Please try again.');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-sans)",
      backgroundColor: "var(--color-bg-base)", // Dark green base
      position: "relative",
      overflow: "hidden",
      padding: "2rem"
    }}>
      {/* Background Vector Blobs */}
      <div style={{
        position: "absolute",
        top: "-10%",
        left: "-5%",
        width: "500px",
        height: "500px",
        borderRadius: "50%",
        background: "radial-gradient(circle, var(--color-primary-light) 0%, transparent 70%)",
        opacity: 0.15,
        filter: "blur(40px)"
      }} />
      <div style={{
        position: "absolute",
        bottom: "-20%",
        right: "-10%",
        width: "800px",
        height: "800px",
        borderRadius: "50%",
        background: "radial-gradient(circle, var(--color-primary) 0%, transparent 70%)",
        opacity: 0.2,
        filter: "blur(60px)"
      }} />

      {/* Main Solid Container (The split view) */}
      <div style={{
        width: "100%",
        maxWidth: "1100px",
        minHeight: "650px",
        backgroundColor: "var(--color-bg-surface)", // Global off-white
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        borderRadius: "var(--radius-xl)",
        display: "flex",
        flexDirection: "row", // Split screen inside the box
        padding: "16px",
        gap: "16px",
        position: "relative",
        zIndex: 1
      }}>
        
        {/* Left Side: Green Gradient / Vector panel inside the white box */}
        <div style={{
          flex: 1,
          background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-bg-base) 100%)",
          borderRadius: "var(--radius-lg)",
          padding: "3rem",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          color: "white",
          position: "relative",
          overflow: "hidden"
        }}>
          {/* Decorative fluid shapes inside the left panel */}
          <div style={{
            position: "absolute",
            top: "10%",
            right: "-20%",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            filter: "blur(30px)"
          }} />
          
          <div style={{ zIndex: 1 }}>
            <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.8)", marginBottom: "1rem" }}>
              Welcome to NexAI
            </p>
            <h1 style={{ fontSize: "3.5rem", fontWeight: 700, lineHeight: 1.1, marginBottom: "1.5rem", letterSpacing: "-1px" }}>
              Secure & Smart<br />Evaluation.
            </h1>
            <p style={{ fontSize: "1.125rem", color: "rgba(255, 255, 255, 0.7)", lineHeight: 1.6 }}>
              Streamline your examination process with zero-trust security and AI-powered analytics.
            </p>
          </div>
        </div>

        {/* Right Side: Login Form with Vectors */}
        <div style={{
          flex: 1,
          padding: "3rem 4rem",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          borderRadius: "var(--radius-lg)"
        }}>
          {/* Subtle Decorative Vectors on the right side */}
          <svg
            style={{ position: "absolute", top: "-15%", right: "-15%", zIndex: 0, opacity: 0.08 }}
            width="350" height="350" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path fill="var(--color-primary)" d="M42.7,-74.6C56.3,-68.8,69,-58.5,76.5,-45.1C84,-31.7,86.2,-15.8,84.5,-0.9C82.8,14,77.3,28,69.5,40.1C61.7,52.2,51.6,62.4,39.3,69.5C27,76.6,13.5,80.6,-0.6,81.6C-14.7,82.5,-29.4,80.4,-42.6,73.7C-55.8,67,-67.5,55.8,-75.6,42C-83.7,28.2,-88.2,14.1,-86.3,0.9C-84.4,-12.3,-76.1,-24.6,-66.9,-35.3C-57.7,-46,-47.6,-55.1,-35.6,-61.7C-23.6,-68.3,-11.8,-72.4,1.4,-74.8C14.6,-77.2,29.2,-78,42.7,-74.6Z" transform="translate(100 100)" />
          </svg>
          <svg
            style={{ position: "absolute", bottom: "-10%", left: "-20%", zIndex: 0, opacity: 0.06 }}
            width="450" height="450" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path fill="var(--color-primary)" d="M37.9,-61.6C51.5,-55.8,66.6,-49.2,76.2,-37.8C85.8,-26.4,89.9,-10.2,87.6,5.1C85.3,20.4,76.6,34.8,65.6,46.1C54.6,57.4,41.3,65.6,26.7,71.2C12.1,76.8,-3.8,79.8,-18.2,76C-32.6,72.2,-45.5,61.6,-56.3,49.2C-67.1,36.8,-75.8,22.6,-78.9,7.1C-82,-8.4,-79.5,-25.2,-71,-38.5C-62.5,-51.8,-48,-61.6,-33.6,-66.8C-19.2,-72,-4.8,-72.6,8.5,-73.4C21.8,-74.2,35.1,-75,37.9,-61.6Z" transform="translate(100 100)" />
          </svg>
          {/* Accent Shapes */}
          <div style={{
            position: "absolute",
            top: "40%",
            right: "10%",
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            backgroundColor: "var(--color-accent)",
            opacity: 0.15,
            zIndex: 0
          }} />
          <div style={{
            position: "absolute",
            bottom: "35%",
            left: "8%",
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            backgroundColor: "var(--color-accent)",
            opacity: 0.2,
            zIndex: 0
          }} />

          <div style={{ zIndex: 1, position: "relative", marginBottom: "2.5rem" }}>
            <h2 style={{ fontSize: "2.25rem", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "0.5rem" }}>
              Get Started Now
            </h2>
            <p style={{ color: "var(--color-text-secondary)" }}>
              Please log in to your account to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem", position: "relative", zIndex: 1 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "0.5rem" }}>
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@university.edu"
                style={{
                  width: "100%", 
                  padding: "14px 16px",
                  background: "var(--color-bg-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--color-text-primary)",
                  fontSize: "1rem",
                  outline: "none",
                  transition: "all var(--transition-fast)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-primary)';
                  e.target.style.boxShadow = '0 0 0 3px var(--color-primary-light)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "0.5rem" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  style={{
                    width: "100%", 
                    padding: "14px 16px",
                    paddingRight: "45px",
                    background: "var(--color-bg-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--color-text-primary)",
                    fontSize: "1rem",
                    outline: "none",
                    transition: "all var(--transition-fast)",
                    boxSizing: "border-box"
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-primary)';
                    e.target.style.boxShadow = '0 0 0 3px var(--color-primary-light)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--color-border)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--color-text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "4px"
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "0.5rem",
                width: "100%",
                padding: "14px",
                background: "var(--color-primary)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-md)",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "all var(--transition-fast)",
                boxShadow: "var(--shadow-sm)"
              }}
              onMouseOver={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseOut={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          {/* Quick Demo Access Bar */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⚡ Quick Operational Portals:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  login(
                    { id: 'scan-1', email: 'scanning.officer@univ.edu', full_name: 'Scanning Superintendent', role: 'SCANNING_OFFICER' },
                    'mock-access-token',
                    'mock-refresh-token'
                  );
                  navigate('/scanning');
                }}
                style={{
                  background: '#E8F5F1',
                  color: '#2F6852',
                  border: '1px solid #48977F',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                📷 Scanning Hub
              </button>

              <button
                type="button"
                onClick={() => {
                  login(
                    { id: 'fac-1', email: 'faculty@nexai.com', full_name: 'Prof. Alan Turing', role: 'FACULTY', department_code: 'CSE' },
                    'mock-access-token',
                    'mock-refresh-token'
                  );
                  navigate('/faculty');
                }}
                style={{
                  background: '#F5F3FF',
                  color: '#6D28D9',
                  border: '1px solid #C4B5FD',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                👨‍🏫 Faculty Portal
              </button>

              <button
                type="button"
                onClick={() => {
                  login(
                    { id: 'hod-1', email: 'hod@nexai.com', full_name: 'Dr. Grace Hopper', role: 'HOD', department_code: 'CSE' },
                    'mock-access-token',
                    'mock-refresh-token'
                  );
                  navigate('/hod');
                }}
                style={{
                  background: '#EFF6FF',
                  color: '#1D4ED8',
                  border: '1px solid #93C5FD',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🎓 HOD Portal
              </button>

              <button
                type="button"
                onClick={() => {
                  login(
                    { id: 'coe-1', email: 'coe@univ.edu', full_name: 'Dr. CoE Admin', role: 'CHIEF_SUPERINTENDENT' },
                    'mock-access-token',
                    'mock-refresh-token'
                  );
                  navigate('/coe');
                }}
                style={{
                  background: '#F1F5F9',
                  color: '#334155',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🏛️ CoE Admin
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
