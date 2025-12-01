import HomeIcon from "@mui/icons-material/Home";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ForumIcon from "@mui/icons-material/Forum";
import PersonIcon from "@mui/icons-material/Person";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import { useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthContext } from "../context/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { dmService } from "../services";

const MobileBottomNav = () => {
  const { currentUser } = useContext(AuthContext);
  const location = useLocation();
  const [isDMOpen, setIsDMOpen] = useState(false);

  // 읽지 않은 DM 수 조회
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: () => dmService.getUnreadCount(),
    enabled: !!currentUser,
    refetchInterval: 10000, // 10초마다 새로고침
  });

  // DM 창 열림 상태 감지
  useEffect(() => {
    const checkDMOpen = () => {
      setIsDMOpen(document.body.hasAttribute('data-dm-open'));
    };

    // 초기 체크
    checkDMOpen();

    // MutationObserver로 body 속성 변경 감지
    const observer = new MutationObserver(checkDMOpen);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-dm-open'] });

    return () => observer.disconnect();
  }, []);

  const navItems = [
    {
      path: "/",
      icon: HomeIcon,
      label: "홈",
      activeColor: "text-market-600"
    },
    {
      path: "/qna",
      icon: HelpOutlineIcon,
      label: "Q&A",
      activeColor: "text-blue-600"
    },
    {
      path: "/community",
      icon: ForumIcon,
      label: "커뮤니티",
      activeColor: "text-green-600"
    },
    {
      path: "/secondhand",
      icon: ShoppingBagIcon,
      label: "사고팔고",
      activeColor: "text-orange-600"
    },
    {
      path: currentUser ? `/profile/${currentUser.id}` : "/login",
      icon: PersonIcon,
      label: currentUser ? "프로필" : "로그인",
      activeColor: "text-purple-600"
    }
  ];

  const isActive = (path) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  // DM이 열려있으면 하단 메뉴 숨기기
  if (isDMOpen) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg md:hidden">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item, index) => {
          const IconComponent = item.icon;
          const active = isActive(item.path);
          const isProfile = item.label === "프로필";

          return (
            <Link
              key={index}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 py-2 px-1 transition-all duration-200 ${
                active
                  ? `${item.activeColor} transform -translate-y-1`
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className={`relative p-2 rounded-full transition-all duration-200 ${
                active ? 'bg-gray-100 shadow-sm' : ''
              }`}>
                <IconComponent
                  className={`${active ? 'text-lg' : 'text-base'}`}
                  fontSize="small"
                />
                {/* 프로필 아이콘에 읽지 않은 DM 뱃지 */}
                {isProfile && unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </div>
                )}
              </div>
              <span className={`text-xs mt-1 font-medium ${
                active ? 'font-semibold' : ''
              }`}>
                {item.label}
              </span>
              {active && (
                <div className={`w-1 h-1 rounded-full mt-1 ${item.activeColor.replace('text-', 'bg-')}`}></div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default MobileBottomNav;