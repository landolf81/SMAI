import AgricultureIcon from "@mui/icons-material/Agriculture";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

const Navbar = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const controlNavbar = () => {
      const currentScrollY = window.scrollY;
      
      // 스크롤이 10px 이상일 때만 동작
      if (currentScrollY > 10) {
        if (currentScrollY > lastScrollY && currentScrollY > 80) {
          // 아래로 스크롤 중이고 80px 이상 스크롤됨 - 헤더 숨기기
          setIsVisible(false);
        } else if (currentScrollY < lastScrollY) {
          // 위로 스크롤 중 - 헤더 보이기
          setIsVisible(true);
        }
      } else {
        // 상단 근처에서는 항상 보이기
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', controlNavbar);
    return () => window.removeEventListener('scroll', controlNavbar);
  }, [lastScrollY]);

  return (
    <>
      {/* 상단 헤더 - 스크롤에 따라 숨김/보임 */}
      <div className={`fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="max-w-md mx-auto p-4">
          <div className="flex items-center justify-center">
            <Link to="/" className="flex items-center text-xl font-bold text-[#004225]">
              <AgricultureIcon className="mr-2" />
              성주참외 경락정보
            </Link>
          </div>
        </div>
      </div>

      {/* 헤더 높이만큼 상단 여백 추가 */}
      <div className="h-16"></div>

      {/* 하단 네비게이션은 MobileBottomNav 컴포넌트에서 처리 */}
    </>
  );
};

export default Navbar;