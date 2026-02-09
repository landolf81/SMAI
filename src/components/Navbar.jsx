import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <div className="bg-white/70 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
      <div className="max-w-md mx-auto p-4">
        <div className="flex items-center justify-center">
          <Link to="/" className="flex items-center text-2xl font-bold">
            <img src="/logo.svg" alt="로고" className="w-8 h-8 mr-2" />
            <span className="bg-gradient-to-r from-[#16A34A] to-[#1D4ED8] bg-clip-text text-transparent">
              참외 이야기
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Navbar;