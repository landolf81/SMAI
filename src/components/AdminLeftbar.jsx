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
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import YouTubeIcon from "@mui/icons-material/YouTube";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import StorageIcon from "@mui/icons-material/Storage";
import CachedIcon from "@mui/icons-material/Cached";
import SpeedIcon from "@mui/icons-material/Speed";
import BackupIcon from "@mui/icons-material/Backup";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ForumIcon from "@mui/icons-material/Forum";
import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { useAdminPermissions } from "../hooks/usePermissions";
import { reportService, storageService } from "../services";

const AdminLeftbar = () => {
  const { currentUser } = useContext(AuthContext);
  const location = useLocation();
  const adminPermissions = useAdminPermissions();
  const [pendingReportsCount, setPendingReportsCount] = useState(0);

  // 미처리 신고 건수 가져오기 (페이지 로딩 시)
  useEffect(() => {
    const fetchPendingReports = async () => {
      if (adminPermissions.isAdmin) {
        const count = await reportService.getPendingReportsCount();
        setPendingReportsCount(count);
      }
    };
    fetchPendingReports();
  }, [adminPermissions.isAdmin]);

  // 신고 처리 완료 이벤트 리스너
  useEffect(() => {
    const handleReportResolved = async () => {
      if (adminPermissions.isAdmin) {
        const count = await reportService.getPendingReportsCount();
        setPendingReportsCount(count);
      }
    };

    window.addEventListener('reportResolved', handleReportResolved);
    return () => window.removeEventListener('reportResolved', handleReportResolved);
  }, [adminPermissions.isAdmin]);

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
        },
        {
          path: "/admin/verification",
          icon: VerifiedUserIcon,
          label: "인증 관리",
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
          path: "/admin/youtube",
          icon: YouTubeIcon,
          label: "YouTube 관리",
          badge: null
        },
        {
          path: "/admin/reports",
          icon: ReportIcon,
          label: "신고 처리",
          badge: pendingReportsCount > 0 ? pendingReportsCount.toString() : null
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
          path: "/admin/market-settings",
          icon: StoreIcon,
          label: "시장정보 설정",
          badge: null
        },
        {
          path: "/admin/auction-times",
          icon: AccessTimeIcon,
          label: "경매시간 관리",
          badge: null
        },
        {
          path: "/admin/market-info",
          icon: InfoOutlinedIcon,
          label: "공판장 정보",
          badge: null
        },
        {
          path: "/admin/detail-grade-settings",
          icon: StoreIcon,
          label: "등급 세부 정렬",
          badge: null
        }
      ]
    },
    {
      title: "알림 / 메시지",
      items: [
        {
          path: "/admin/push",
          icon: NotificationsActiveIcon,
          label: "푸시 알림",
          badge: null
        },
        {
          path: "/admin/dm",
          icon: ForumIcon,
          label: "DM 발송",
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
          <ul className="menu p-4 w-80 min-h-full bg-base-200 border-r border-base-300 overflow-y-auto">

            {/* 관리자 프로필 */}
            <div className="mb-6 p-4 bg-base-200 rounded-xl border border-base-300">
              <div className="flex items-center gap-3">
                <div className="avatar">
                  <div className="w-12 rounded-full border-2 border-base-100">
                    <img
                      alt="관리자"
                      src={storageService.getProfileImageUrl(currentUser.profilePic || currentUser.profile_pic, currentUser.id)}
                    />
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-base-content flex items-center gap-2">
                    {currentUser.username}
                    <AdminPanelSettingsIcon className="text-[#004225] text-sm" />
                  </div>
                  <div className="text-sm text-[#004225] font-medium">시스템 관리자</div>
                </div>
              </div>
            </div>

            {/* 관리자 메뉴 섹션들 */}
            {menuSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="mb-5">
                <h3 className="font-semibold text-base-content/50 mb-2 px-3 text-xs uppercase tracking-wider">
                  {section.title}
                </h3>

                {section.items.map((item, itemIndex) => {
                  const IconComponent = item.icon;
                  const isActive = isActiveLink(item.path);

                  return (
                    <Link
                      key={itemIndex}
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 mb-1 ${
                        isActive
                          ? 'bg-[#004225] text-white shadow-md'
                          : 'hover:bg-base-200 text-base-content/70'
                      }`}
                    >
                      <IconComponent className={`text-lg ${isActive ? 'text-white' : 'text-[#004225]'}`} />
                      <span className="font-medium text-sm">{item.label}</span>
                      {item.badge && (
                        <span className={`badge badge-sm ml-auto ${
                          isActive ? 'bg-white text-[#004225]' : 'bg-orange-500 text-white border-none'
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
            <div className="mt-auto pt-4 border-t border-base-300">
              <h3 className="font-semibold text-base-content/50 mb-2 px-3 text-xs uppercase tracking-wider">
                개발자 도구
              </h3>
              <Link
                to="/admin/developer"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 mb-2 ${
                  isActiveLink("/admin/developer")
                    ? 'bg-[#004225] text-white shadow-md'
                    : 'hover:bg-base-200 text-base-content/70'
                }`}
              >
                <DeveloperBoardIcon className={`text-lg ${isActiveLink("/admin/developer") ? 'text-white' : 'text-[#004225]'}`} />
                <span className="font-medium text-sm">API & 도구</span>
              </Link>
            </div>

            {/* 푸터 */}
            <div className="mt-4 pt-4 border-t border-base-300">
              <div className="text-xs text-base-content/50 px-2 text-center">
                <div className="font-bold text-[#004225] mb-1">Meridian Admin</div>
                <div>농업 커뮤니티 관리 시스템</div>
                <div className="mt-2 flex justify-center gap-1">
                  <span className="px-2 py-1 bg-[#004225]/10 text-[#004225] rounded text-xs font-medium">v1.0</span>
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
