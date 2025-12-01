import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useAdminPermissions } from "../hooks/usePermissions";
import { isDesktopDevice, isAdminAccess } from "../utils/deviceDetector";
import AdminLeftbar from "./AdminLeftbar";

const Leftbar = () => {
  const { currentUser } = useContext(AuthContext);
  const adminPermissions = useAdminPermissions();

  if (!currentUser) {
    return null;
  }

  // 관리자 페이지에 있거나 (PC + 관리자 권한)인 경우 관리자 메뉴 표시
  if (adminPermissions.isAdmin && (isAdminAccess() || isDesktopDevice())) {
    return <AdminLeftbar />;
  }

  return null;
};

export default Leftbar;
