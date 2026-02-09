import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <div className="bg-white/70 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
      <div className="max-w-md mx-auto px-4 py-2.5">
        <div className="flex items-center justify-center">
          <Link to="/" className="flex items-center text-2xl text-gray-800">
            <img src="/logo.svg" alt="로고" className="w-7 h-7 mr-1.5" />
            <span className="font-semibold">참외</span>
            <span className="font-semibold ml-0.5">이야기</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Navbar;