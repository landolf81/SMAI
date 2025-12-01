import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import ArticleIcon from "@mui/icons-material/Article";
import CampaignIcon from "@mui/icons-material/Campaign";
import StoreIcon from "@mui/icons-material/Store";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import SettingsIcon from "@mui/icons-material/Settings";
import DeveloperBoardIcon from "@mui/icons-material/DeveloperBoard";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ReportIcon from "@mui/icons-material/Report";
import VerifiedIcon from "@mui/icons-material/Verified";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import StorageIcon from "@mui/icons-material/Storage";
import CachedIcon from "@mui/icons-material/Cached";
import SpeedIcon from "@mui/icons-material/Speed";
import BackupIcon from "@mui/icons-material/Backup";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { useAdminPermissions } from "../hooks/usePermissions";

const AdminLeftbar = () => {
  const { currentUser } = useContext(AuthContext);
  const location = useLocation();
  const adminPermissions = useAdminPermissions();

  if (!adminPermissions.isAdmin) {
    return null;
  }

  const menuSections = [
    {
      title: "대시보드",
      items: [
        { 
          path: "/admin", 
          icon: DashboardIcon, 
          label: "메인 대시보드", 
          badge: null 
        },
        { 
          path: "/admin/analytics", 
          icon: AnalyticsIcon, 
          label: "통계 개요", 
          badge: null 
        }
      ]
    },
    {
      title: "사용자 관리",
      items: [
        { 
          path: "/admin/users", 
          icon: PeopleIcon, 
          label: "사용자 및 권한", 
          badge: null 
        },
        { 
          path: "/admin/badges", 
          icon: VerifiedIcon, 
          label: "뱃지 관리", 
          badge: null 
        }
      ]
    },
    {
      title: "콘텐츠 관리",
      items: [
        {
          path: "/admin/posts",
          icon: ArticleIcon,
          label: "게시물 관리",
          badge: null
        },
        {
          path: "/admin/reports",
          icon: ReportIcon,
          label: "신고 처리",
          badge: "3"
        }
      ]
    },
    {
      title: "광고 관리",
      items: [
        { 
          path: "/admin/ads", 
          icon: CampaignIcon, 
          label: "광고 관리", 
          badge: null 
        },
        { 
          path: "/admin/ads/analytics", 
          icon: TrendingUpIcon, 
          label: "광고 성과", 
          badge: null 
        },
        {
          path: "/admin/ads/revenue",
          icon: AttachMoneyIcon,
          label: "수익 통계",
          badge: null
        }
      ]
    },
    {
      title: "시장 데이터",
      items: [
        { 
          path: "/admin/markets", 
          icon: StoreIcon, 
          label: "시장 정보", 
          badge: null 
        },
        { 
          path: "/admin/prices", 
          icon: TrendingUpIcon, 
          label: "가격 데이터", 
          badge: null 
        }
      ]
    },
    {
      title: "시스템",
      items: [
        { 
          path: "/admin/settings", 
          icon: SettingsIcon, 
          label: "시스템 설정", 
          badge: null 
        },
        { 
          path: "/admin/backup", 
          icon: BackupIcon, 
          label: "백업 관리", 
          badge: null 
        },
        { 
          path: "/admin/database", 
          icon: StorageIcon, 
          label: "데이터베이스", 
          badge: null 
        },
        { 
          path: "/admin/cache", 
          icon: CachedIcon, 
          label: "캐시 관리", 
          badge: null 
        },
        { 
          path: "/admin/performance", 
          icon: SpeedIcon, 
          label: "성능 모니터링", 
          badge: null 
        }
      ]
    }
  ];

  const isActiveLink = (path) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="sticky top-0 z-30">
      <div className="drawer lg:drawer-open">
        <input id="admin-drawer" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content flex flex-col items-center justify-center">
          <label
            htmlFor="admin-drawer"
            className="btn btn-primary drawer-button lg:hidden"
          >
            관리자 메뉴
          </label>
        </div>
        <div className="drawer-side">
          <label
            htmlFor="admin-drawer"
            aria-label="close sidebar"
            className="drawer-overlay"
          ></label>
          <ul className="menu p-4 w-80 min-h-full bg-gradient-to-b from-red-50 to-red-100 text-base-content overflow-y-auto">
            
            {/* 관리자 프로필 */}
            <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-red-200">
              <div className="flex items-center gap-3">
                <div className="avatar">
                  <div className="w-12 rounded-full border-2 border-red-300">
                    <img
                      alt="관리자"
                      src={
                        currentUser.profilePic 
                          ? `/uploads/profiles/${currentUser.profilePic}` 
                          : "/default/default_profile.png"
                      }
                    />
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-gray-800 flex items-center gap-2">
                    {currentUser.username}
                    <AdminPanelSettingsIcon className="text-red-600 text-sm" />
                  </div>
                  <div className="text-sm text-red-600 font-medium">시스템 관리자</div>
                </div>
              </div>
            </div>

            {/* 관리자 메뉴 섹션들 */}
            {menuSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-3 px-2 text-sm uppercase tracking-wide">
                  {section.title}
                </h3>
                
                {section.items.map((item, itemIndex) => {
                  const IconComponent = item.icon;
                  const isActive = isActiveLink(item.path);
                  
                  return (
                    <Link 
                      key={itemIndex}
                      to={item.path} 
                      className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 mb-1 ${
                        isActive 
                          ? 'bg-red-600 text-white shadow-md transform scale-105' 
                          : 'hover:bg-white hover:shadow-sm text-gray-700'
                      }`}
                    >
                      <IconComponent className={`${isActive ? 'text-white' : 'text-red-600'}`} />
                      <span className="font-medium">{item.label}</span>
                      {item.badge && (
                        <span className={`badge badge-sm ml-auto ${
                          isActive ? 'badge-warning' : 'badge-error'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}

            {/* 개발자 도구 (별도 섹션) */}
            <div className="mt-auto pt-4 border-t border-red-200">
              <h3 className="font-semibold text-gray-700 mb-3 px-2 text-sm uppercase tracking-wide">
                개발자 도구
              </h3>
              <Link 
                to="/admin/developer" 
                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 mb-2 ${
                  isActiveLink("/admin/developer")
                    ? 'bg-red-600 text-white shadow-md' 
                    : 'hover:bg-white hover:shadow-sm text-gray-700'
                }`}
              >
                <DeveloperBoardIcon className={`${isActiveLink("/admin/developer") ? 'text-white' : 'text-red-600'}`} />
                <span className="font-medium">API & 도구</span>
              </Link>
            </div>

            {/* 푸터 */}
            <div className="mt-4 pt-4 border-t border-red-200">
              <div className="text-xs text-gray-500 px-2 text-center">
                <div className="font-semibold text-red-600 mb-1">Meridian Admin</div>
                <div>농업 커뮤니티 관리 시스템</div>
                <div className="mt-2 flex justify-center gap-1">
                  <span className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs">v1.0</span>
                </div>
              </div>
            </div>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminLeftbar;