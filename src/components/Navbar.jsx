import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <div className="bg-transparent">
      <div className="max-w-md mx-auto p-4">
        <div className="flex items-center justify-center">
          <Link to="/" className="flex items-center text-xl font-bold text-[#004225]">
            <img src="/favicon.png" alt="로고" className="w-8 h-8 mr-2" />
            선남 참외 이야기
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Navbar;