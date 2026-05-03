import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function Sidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isGuest = !user;

  return (
    <div className="sidebar">

      {/* NORMAL USER */}
      {!isGuest && (
        <>
          <p className="text-sm">Welcome</p>

          {/* your normal sidebar items */}
        </>
      )}

      {/* GUEST USER */}
      {isGuest && (
        <>
          <p className="text-sm text-muted-foreground">
            You are using as Guest
          </p>

          <button
            onClick={() => navigate("/auth")}
            className="text-primary underline"
          >
            Create account
          </button>
        </>
      )}

    </div>
  );
}
